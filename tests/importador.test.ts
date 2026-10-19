import { describe, expect, it } from 'vitest';
import { migrar, type Banco } from '../src/lib/banco';
import { importarTextoM3U } from '../src/lib/importador';
import { bancoDeTeste } from './util';

const lista = `#EXTM3U x-tvg-url="http://epg/g.xml"
#EXTINF:-1 tvg-id="a" group-title="Abertos",Canal A
http://s/live/1.ts
#EXTINF:-1 group-title="Abertos",Canal B
http://s/live/2.ts
#EXTINF:-1 group-title="Filmes",Um Filme
http://s/movie/9.mp4
#EXTINF:-1 group-title="Séries",Show S01E01
http://s/series/1.mkv
#EXTINF:-1 group-title="Séries",Show S01E02
http://s/series/2.mkv
`;

async function novaLista(db: Banco) {
  const r = await db.runAsync("INSERT INTO playlist (nome, tipo) VALUES ('Teste', 'm3u')", []);
  return r.lastInsertRowId;
}

describe('importador M3U', () => {
  it('cria tabelas e perfil padrão', async () => {
    const db = bancoDeTeste();
    await migrar(db);
    await migrar(db); // segunda vez não pode quebrar
    expect(await db.getFirstAsync('SELECT nome FROM perfil WHERE id = 1', [])).toEqual({ nome: 'Principal' });
  });

  it('grava canais, filmes, séries e episódios', async () => {
    const db = bancoDeTeste();
    await migrar(db);
    const id = await novaLista(db);
    const r = await importarTextoM3U(db, id, lista);
    expect(r).toEqual({ live: 2, filmes: 1, series: 1, urlEpg: 'http://epg/g.xml' });
    expect(await db.getFirstAsync('SELECT COUNT(*) n FROM episodio', [])).toEqual({ n: 2 });
    const pl = await db.getFirstAsync<{ total_live: number; url_epg: string }>('SELECT * FROM playlist', []);
    expect(pl?.total_live).toBe(2);
    expect(pl?.url_epg).toBe('http://epg/g.xml');
  });

  it('reimportar substitui o conteúdo e mantém favoritos pela chave', async () => {
    const db = bancoDeTeste();
    await migrar(db);
    const id = await novaLista(db);
    await importarTextoM3U(db, id, lista);
    const canal = await db.getFirstAsync<{ chave: string }>("SELECT chave FROM canal WHERE nome = 'Canal A'", []);
    await db.runAsync("INSERT INTO favorito (perfil_id, chave, tipo) VALUES (1, ?, 'live')", [canal!.chave]);

    // provedor trocou o link e colocou "HD" no nome
    await importarTextoM3U(db, id, lista.replace('Canal A', 'Canal A HD').replace('live/1.ts', 'live/999.ts'));
    expect(await db.getFirstAsync('SELECT COUNT(*) n FROM canal', [])).toEqual({ n: 2 });
    const fav = await db.getFirstAsync('SELECT c.url_stream FROM favorito f JOIN canal c ON c.chave = f.chave', []);
    expect(fav).toEqual({ url_stream: 'http://s/live/999.ts' });
  });

  it('recusa conteúdo que não é M3U sem apagar a lista atual', async () => {
    const db = bancoDeTeste();
    await migrar(db);
    const id = await novaLista(db);
    await importarTextoM3U(db, id, lista);
    await expect(importarTextoM3U(db, id, '<html>Acesso negado</html>')).rejects.toThrow('não é uma lista M3U');
    expect(await db.getFirstAsync('SELECT COUNT(*) n FROM canal', [])).toEqual({ n: 2 });
  });

  it('importa 50 mil canais', async () => {
    const db = bancoDeTeste();
    await migrar(db);
    const id = await novaLista(db);
    const p = ['#EXTM3U'];
    for (let i = 0; i < 50000; i++) p.push(`#EXTINF:-1 group-title="G${i % 50}",Canal ${i}`, `http://s/live/${i}.ts`);
    const ini = Date.now();
    const r = await importarTextoM3U(db, id, p.join('\n'));
    expect(r.live).toBe(50000);
    console.log(`50 mil canais importados em ${Date.now() - ini} ms (Node)`);
  }, 30000);
});

describe('lista real (iptv-org, canais abertos do Brasil)', () => {
  it('importa a lista pública sem perder itens', async () => {
    const { readFileSync } = await import('node:fs');
    const texto = readFileSync(new URL('./fixtures/br-iptv-org.m3u', import.meta.url), 'utf8');
    const esperado = (texto.match(/^#EXTINF/gm) ?? []).length;
    const db = bancoDeTeste();
    await migrar(db);
    const id = await novaLista(db);
    const r = await importarTextoM3U(db, id, texto);
    expect(r.live + r.filmes + r.series).toBe(esperado);
    console.log(`iptv-org BR: ${r.live} canais ao vivo, ${r.filmes} filmes, ${r.series} séries`);
  });
});
