/**
 * Roda as consultas reais das telas (repo.ts) contra o SQLite do Node,
 * para garantir que o SQL está certo e que o controle parental filtra.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { migrar, type Banco } from '../src/lib/banco';
import { importarEPG } from '../src/lib/epg';
import { importarTextoM3U } from '../src/lib/importador';
import { bancoDeTeste } from './util';

let db: Banco;
let esconder = false;
vi.mock('../src/lib/db', () => ({ obterBanco: async () => db }));
vi.mock('../src/lib/parental', () => ({ esconderBloqueados: async () => esconder }));

const repo = await import('../src/lib/repo');

const agora = Math.floor(Date.now() / 1000);
const xmltvHora = (seg: number) => new Date(seg * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14) + ' +0000';

const lista = `#EXTM3U
#EXTINF:-1 tvg-id="news.br@HD" group-title="Notícias",Canal Notícias HD
http://s/1.m3u8
#EXTINF:-1 group-title="Adultos",Canal Adulto
http://s/2.m3u8
#EXTINF:-1 group-title="Filmes Ação",Filme Bom
http://s/movie/3.mp4
#EXTINF:-1 group-title="Adultos XXX",Filme Adulto
http://s/movie/4.mp4
#EXTINF:-1 group-title="Séries",Série Legal S01E01
http://s/series/5.mkv
`;

const guia = `<tv>
<programme start="${xmltvHora(agora - 600)}" stop="${xmltvHora(agora + 600)}" channel="news.br"><title>Jornal</title></programme>
<programme start="${xmltvHora(agora + 600)}" stop="${xmltvHora(agora + 4200)}" channel="news.br"><title>Esporte</title></programme>
</tv>`;

beforeAll(async () => {
  db = bancoDeTeste();
  await migrar(db);
  const { lastInsertRowId: id } = await db.runAsync("INSERT INTO playlist (nome, tipo) VALUES ('t','m3u')", []);
  await importarTextoM3U(db, id, lista);
  await importarEPG(db, id, guia);
});

describe('consultas das telas', () => {
  it('lista canais com o programa no ar', async () => {
    const c = await repo.canais(null);
    expect(c.map((x) => [x.nome, x.agora])).toEqual([
      ['Canal Notícias HD', 'Jornal'],
      ['Canal Adulto', null],
    ]);
  });

  it('guia do canal começa no programa atual', async () => {
    const id = (await repo.canais(null))[0].id;
    expect((await repo.guiaDoCanal(id)).map((p) => p.titulo)).toEqual(['Jornal', 'Esporte']);
  });

  it('categorias mostram o cadeado nas adultas', async () => {
    const cats = await repo.categorias('live');
    expect(cats.map((c) => [c.nome, c.bloqueada, c.total])).toEqual([
      ['Notícias', 0, 1],
      ['Adultos', 1, 1],
    ]);
  });

  it('com PIN ativo, esconde bloqueados de Todos, busca, filmes e favoritos', async () => {
    const adulto = (await repo.canais(null)).find((c) => c.nome === 'Canal Adulto')!;
    await repo.alternarFavorito(adulto.chave, 'live');

    esconder = false;
    expect((await repo.canais(null)).length).toBe(2);
    expect((await repo.filmes(null)).length).toBe(2);
    expect((await repo.buscar('canal')).length).toBe(2);
    expect((await repo.favoritos()).length).toBe(1);

    esconder = true;
    expect((await repo.canais(null)).map((c) => c.nome)).toEqual(['Canal Notícias HD']);
    expect((await repo.filmes(null)).map((f) => f.titulo)).toEqual(['Filme Bom']);
    expect((await repo.buscar('canal')).map((b) => b.titulo)).toEqual(['Canal Notícias HD']);
    expect(await repo.favoritos()).toEqual([]);
    esconder = false;
  });

  it('histórico e continuar assistindo', async () => {
    const filme = (await repo.filmes(null)).find((f) => f.titulo === 'Filme Bom')!;
    await repo.registrarHistorico(filme.chave, 'filme', 'Filme Bom', 600, 6000);
    expect(await repo.posicaoSalva(filme.chave)).toBe(600);
    const cont = await repo.continuarAssistindo();
    expect(cont[0]).toMatchObject({ tipo: 'filme', titulo: 'Filme Bom', progresso: 0.1 });
  });

  it('séries, episódios e configurações', async () => {
    const s = (await repo.series(null))[0];
    expect(s.titulo).toBe('Série Legal');
    expect((await repo.episodios(s.id)).length).toBe(1);
    await repo.gravarConfig('x', '1');
    await repo.gravarConfig('x', '2');
    expect(await repo.lerConfig('x')).toBe('2');
  });
});
