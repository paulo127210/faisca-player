import { createHash } from 'node:crypto';
import { gzipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { migrar } from '../src/lib/banco';
import { bytesParaTexto, decodificar, idGuia, importarEPG, lerHorario, lerProgramasXMLTV } from '../src/lib/epg';
import { importarTextoM3U } from '../src/lib/importador';
import { conferirHash, gerarHash, pinValido, Tentativas } from '../src/lib/pin';
import { bancoDeTeste } from './util';

const AGORA = Date.UTC(2026, 9, 19, 20, 0, 0) / 1000; // 19/10/2026 17:00 em Brasília

const guia = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="tvbrasil.br"><display-name>TV Brasil</display-name></channel>
  <channel id="cultura.br"><display-name lang="pt">TV Cultura</display-name></channel>
  <channel id="outro.br"><display-name>Canal que não está na lista</display-name></channel>
  <programme start="20261019160000 -0300" stop="20261019180000 -0300" channel="tvbrasil.br">
    <title lang="pt">Repórter Brasil &amp; Cia</title><desc>Jornal da &quot;tarde&quot;</desc>
  </programme>
  <programme start="20261019180000 -0300" stop="20261019190000 -0300" channel="tvbrasil.br">
    <title><![CDATA[Filme <Especial>]]></title>
  </programme>
  <programme start="20261019170000 -0300" stop="20261019180000 -0300" channel="cultura.br">
    <title>Castelo Rá-Tim-Bum</title>
  </programme>
  <programme start="20261019170000 -0300" stop="20261019180000 -0300" channel="outro.br">
    <title>Não deve entrar</title>
  </programme>
  <programme start="20261010170000 -0300" stop="20261010180000 -0300" channel="tvbrasil.br">
    <title>Antigo demais</title>
  </programme>
</tv>`;

const lista = `#EXTM3U
#EXTINF:-1 tvg-id="TVBrasil.br@HD" group-title="Abertos",TV Brasil
http://s/1.m3u8
#EXTINF:-1 group-title="Abertos",TV Cultura HD
http://s/2.m3u8
#EXTINF:-1 group-title="Adultos +18",Canal X
http://s/3.m3u8
`;

describe('leitor XMLTV', () => {
  it('converte horário com fuso para UTC', () => {
    expect(lerHorario('20261019170000 -0300')).toBe(AGORA);
    expect(lerHorario('20261019200000')).toBe(AGORA);
    expect(lerHorario('lixo')).toBeNull();
  });
  it('decodifica entidades e CDATA', () => {
    expect(decodificar('A &amp; B &#233; &#x41;')).toBe('A & B é A');
    expect(decodificar('<![CDATA[<x>]]>')).toBe('<x>');
  });
  it('lê programas', () => {
    const p = [...lerProgramasXMLTV(guia)];
    expect(p).toHaveLength(5);
    expect(p[0]).toMatchObject({
      canal: 'tvbrasil.br',
      titulo: 'Repórter Brasil & Cia',
      descricao: 'Jornal da "tarde"',
    });
    expect(p[1].titulo).toBe('Filme <Especial>');
  });
  it('abre arquivo .gz e texto puro', () => {
    expect(bytesParaTexto(gzipSync(strToU8(guia)))).toBe(guia);
    expect(bytesParaTexto(strToU8('<tv/>'))).toBe('<tv/>');
  });
  it('ignora sufixo @HD no id', () => {
    expect(idGuia('TVBrasil.br@HD')).toBe('tvbrasil.br');
  });
});

describe('importar guia', () => {
  it('liga canais por id (com @HD) e pelo nome, filtra janela e canais fora da lista', async () => {
    const db = bancoDeTeste();
    await migrar(db);
    const { lastInsertRowId: id } = await db.runAsync("INSERT INTO playlist (nome, tipo) VALUES ('t','m3u')", []);
    await importarTextoM3U(db, id, lista);
    const r = await importarEPG(db, id, guia, AGORA);

    expect(r.canaisLigadosPeloNome).toBe(1); // "TV Cultura HD" achou "TV Cultura"
    expect(r.canaisComGuia).toBe(2);
    expect(r.programas).toBe(3); // sem "outro.br" e sem o programa antigo

    const agora = await db.getAllAsync<{ nome: string; titulo: string }>(
      `SELECT c.nome, p.titulo FROM canal c JOIN programa_epg p
         ON p.playlist_id = c.playlist_id
        AND p.epg_id = lower(CASE WHEN instr(c.epg_id,'@')>0 THEN substr(c.epg_id,1,instr(c.epg_id,'@')-1) ELSE c.epg_id END)
       WHERE p.inicio <= ? AND p.fim > ? ORDER BY c.nome`,
      [AGORA, AGORA],
    );
    expect(agora).toEqual([
      { nome: 'TV Brasil', titulo: 'Repórter Brasil & Cia' },
      { nome: 'TV Cultura HD', titulo: 'Castelo Rá-Tim-Bum' },
    ]);
  });

  it('recusa arquivo que não é XMLTV', async () => {
    const db = bancoDeTeste();
    await migrar(db);
    await expect(importarEPG(db, 1, '<html>erro</html>')).rejects.toThrow('XMLTV');
  });
});

describe('controle parental', () => {
  const sha256 = async (t: string) => createHash('sha256').update(t).digest('hex');

  it('valida o formato do PIN', () => {
    expect(pinValido('1234')).toBe(true);
    expect(pinValido('123')).toBe(false);
    expect(pinValido('12a4')).toBe(false);
  });
  it('não guarda o PIN em texto e confere corretamente', async () => {
    const h = await gerarHash('2580', 'sal-fixo', sha256);
    expect(h).not.toContain('2580');
    expect(await conferirHash('2580', h, sha256)).toBe(true);
    expect(await conferirHash('0000', h, sha256)).toBe(false);
  });
  it('trava por 30 s depois de 5 erros', () => {
    const t = new Tentativas();
    for (let i = 0; i < 5; i++) t.registrar(false, 1000);
    expect(t.segundosRestantes(1000)).toBe(30);
    expect(t.segundosRestantes(31000)).toBe(0);
  });
  it('categoria adulta entra bloqueada e a escolha da pessoa sobrevive à atualização da lista', async () => {
    const db = bancoDeTeste();
    await migrar(db);
    const { lastInsertRowId: id } = await db.runAsync("INSERT INTO playlist (nome, tipo) VALUES ('t','m3u')", []);
    await importarTextoM3U(db, id, lista);
    const cats = () =>
      db.getAllAsync<{ nome: string; bloqueada: number; oculta: number }>(
        'SELECT nome, bloqueada, oculta FROM categoria ORDER BY nome',
        [],
      );
    expect(await cats()).toEqual([
      { nome: 'Abertos', bloqueada: 0, oculta: 0 },
      { nome: 'Adultos +18', bloqueada: 1, oculta: 0 },
    ]);

    await db.runAsync("UPDATE categoria SET bloqueada = 1, oculta = 1 WHERE nome = 'Abertos'", []);
    await db.runAsync("UPDATE categoria SET bloqueada = 0 WHERE nome = 'Adultos +18'", []);
    await importarTextoM3U(db, id, lista);
    expect(await cats()).toEqual([
      { nome: 'Abertos', bloqueada: 1, oculta: 1 },
      { nome: 'Adultos +18', bloqueada: 0, oculta: 0 },
    ]);
  });
});
