import { describe, expect, it } from 'vitest';
import { lerCabecalho, lerM3U, pareceM3U } from '../src/lib/m3u';
import { chaveConteudo, normalizar } from '../src/lib/texto';
import { aplicarSenha, contaDeLinkM3U, normalizarServidor, urlStream } from '../src/lib/xtream';

const exemplo = `#EXTM3U url-tvg="http://epg.exemplo/guia.xml.gz"
#EXTINF:-1 tvg-id="tvbrasil.br" tvg-name="TV Brasil" tvg-logo="http://l/tvb.png" tvg-chno="2" group-title="Abertos",TV Brasil HD
#EXTVLCOPT:http-user-agent=VLC
http://srv/live/u/p/1.ts
#EXTINF:-1 tvg-name="Filme, o retorno" group-title="Filmes | Ação",Filme, o retorno (2020)
http://srv/movie/u/p/55.mp4
#EXTINF:-1 group-title="Séries",Minha Série S02E05
http://srv/series/u/p/77.mkv
#EXTINF:-1,Sem Grupo
#EXTGRP:Notícias
https://cdn/news/index.m3u8
http://url-solta-sem-info.ts
`;

describe('lerM3U', () => {
  const itens = [...lerM3U(exemplo)];

  it('lê todos os itens com #EXTINF', () => {
    expect(itens).toHaveLength(4);
  });
  it('lê atributos e nome', () => {
    expect(itens[0]).toMatchObject({
      nome: 'TV Brasil HD',
      grupo: 'Abertos',
      logo: 'http://l/tvb.png',
      tvgId: 'tvbrasil.br',
      tvgChno: 2,
      tipo: 'live',
      url: 'http://srv/live/u/p/1.ts',
    });
  });
  it('nome com vírgula usa a última vírgula fora das aspas', () => {
    expect(itens[1].nome).toBe('o retorno (2020)');
    expect(itens[1].tipo).toBe('filme');
  });
  it('reconhece episódio de série', () => {
    expect(itens[2].tipo).toBe('serie');
    expect(itens[2].serie).toEqual({ nome: 'Minha Série', temporada: 2, episodio: 5 });
  });
  it('usa #EXTGRP quando não há group-title', () => {
    expect(itens[3].grupo).toBe('Notícias');
    expect(itens[3].tipo).toBe('live');
  });
  it('lê o EPG do cabeçalho', () => {
    expect(lerCabecalho(exemplo).urlEpg).toBe('http://epg.exemplo/guia.xml.gz');
    expect(pareceM3U(exemplo)).toBe(true);
    expect(pareceM3U('<html>erro</html>')).toBe(false);
  });
  it('aguenta 50 mil itens rapidamente', () => {
    const partes = ['#EXTM3U'];
    for (let i = 0; i < 50000; i++)
      partes.push(
        `#EXTINF:-1 tvg-logo="http://l/${i}.png" group-title="G${i % 40}",Canal ${i}`,
        `http://s/live/u/p/${i}.ts`,
      );
    const ini = Date.now();
    let n = 0;
    for (const _ of lerM3U(partes.join('\n'))) n++;
    expect(n).toBe(50000);
    expect(Date.now() - ini).toBeLessThan(3000);
  });
});

describe('texto', () => {
  it('normaliza acentos e símbolos', () => {
    expect(normalizar('  Ação & Aventura ')).toBe('acao aventura');
  });
  it('chave estável ignora qualidade e tags', () => {
    expect(chaveConteudo('live', 'Globo HD [BR]')).toBe(chaveConteudo('live', 'GLOBO FHD'));
  });
});

describe('xtream', () => {
  it('normaliza servidor', () => {
    expect(normalizarServidor('exemplo.com:8080/')).toBe('http://exemplo.com:8080');
    expect(normalizarServidor('https://a.b/player_api.php?x=1')).toBe('https://a.b');
  });
  it('extrai conta de link get.php', () => {
    expect(contaDeLinkM3U('http://srv.tv:8080/get.php?username=ana&password=123&type=m3u_plus')).toEqual({
      servidor: 'http://srv.tv:8080',
      usuario: 'ana',
      senha: '123',
    });
    expect(contaDeLinkM3U('http://srv.tv/lista.m3u')).toBeNull();
  });
  it('URL guarda marcador e recebe a senha só na hora de tocar', () => {
    const u = urlStream({ servidor: 'srv.tv', usuario: 'ana' }, 'live', 10, 'ts');
    expect(u).toBe('http://srv.tv/live/ana/{SENHA}/10.ts');
    expect(aplicarSenha(u, 'p@ss')).toBe('http://srv.tv/live/ana/p%40ss/10.ts');
  });
});
