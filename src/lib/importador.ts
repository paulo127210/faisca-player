/**
 * Importa uma lista (M3U ou Xtream) para o banco local.
 * Grava em lotes dentro de uma transação e devolve o progresso,
 * para a tela mostrar "Importando 12.000 de 48.000".
 */
import type { Banco, Instrucao, Param } from './banco';
import { lerCabecalho, lerM3U, pareceM3U } from './m3u';
import { chaveConteudo, normalizar, type TipoConteudo } from './texto';
import { urlStream, xtream, type ContaXtream } from './xtream';

export interface Progresso {
  etapa: string;
  feitos: number;
  total?: number;
}
export type AoProgredir = (p: Progresso) => void;

export interface ResumoImportacao {
  live: number;
  filmes: number;
  series: number;
  urlEpg: string | null;
}

const LOTE = 1000;
const pausa = () => new Promise<void>((r) => setTimeout(r, 0));

/** Guarda o id de cada categoria já criada para não repetir consultas */
class Categorias {
  private cache = new Map<string, number>();
  private ordem = 0;
  constructor(
    private ins: Instrucao,
    private playlistId: number,
  ) {}
  async id(tipo: TipoConteudo, nome: string, extId: string | null = null): Promise<number> {
    const k = `${tipo}|${nome}`;
    const achado = this.cache.get(k);
    if (achado !== undefined) return achado;
    const r = await this.ins.executeAsync([this.playlistId, tipo, nome, extId, this.ordem++]);
    this.cache.set(k, r.lastInsertRowId);
    return r.lastInsertRowId;
  }
}

async function preparar(db: Banco) {
  return {
    categoria: await db.prepareAsync(
      'INSERT INTO categoria (playlist_id, tipo, nome, ext_id, ordem) VALUES (?, ?, ?, ?, ?)',
    ),
    canal: await db.prepareAsync(
      'INSERT INTO canal (playlist_id, categoria_id, nome, nome_busca, logo, url_stream, epg_id, numero, chave) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    filme: await db.prepareAsync(
      'INSERT INTO filme (playlist_id, categoria_id, titulo, nome_busca, capa, ano, sinopse, url_stream, chave) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    serie: await db.prepareAsync(
      'INSERT INTO serie (playlist_id, categoria_id, titulo, nome_busca, capa, ano, sinopse, ext_id, chave) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    episodio: await db.prepareAsync(
      'INSERT INTO episodio (serie_id, temporada, numero, titulo, url_stream) VALUES (?, ?, ?, ?, ?)',
    ),
  };
}
type Instrucoes = Awaited<ReturnType<typeof preparar>>;

async function finalizar(ins: Instrucoes) {
  for (const i of Object.values(ins)) await i.finalizeAsync();
}

/** Apaga o conteúdo antigo da lista (as categorias levam canais, filmes e séries junto) */
async function limpar(db: Banco, playlistId: number) {
  for (const t of ['canal', 'filme', 'serie', 'categoria'])
    await db.runAsync(`DELETE FROM ${t} WHERE playlist_id = ?`, [playlistId]);
}

async function gravarTotais(db: Banco, playlistId: number, r: ResumoImportacao) {
  await db.runAsync(
    `UPDATE playlist SET total_live = ?, total_filmes = ?, total_series = ?, url_epg = COALESCE(?, url_epg),
     atualizada_em = datetime('now') WHERE id = ?`,
    [r.live, r.filmes, r.series, r.urlEpg, playlistId],
  );
}

/* ---------------------------------- M3U ---------------------------------- */

export async function importarTextoM3U(
  db: Banco,
  playlistId: number,
  texto: string,
  aoProgredir: AoProgredir = () => {},
): Promise<ResumoImportacao> {
  if (!pareceM3U(texto)) throw new Error('O conteúdo recebido não é uma lista M3U válida');
  const resumo: ResumoImportacao = { live: 0, filmes: 0, series: 0, urlEpg: lerCabecalho(texto).urlEpg };

  await db.withTransactionAsync(async () => {
    await limpar(db, playlistId);
    const ins = await preparar(db);
    try {
      const cats = new Categorias(ins.categoria, playlistId);
      const series = new Map<string, number>();
      let n = 0;

      for (const item of lerM3U(texto)) {
        const catId = await cats.id(item.tipo, item.grupo);
        const busca = normalizar(item.nome);

        if (item.tipo === 'live') {
          await ins.canal.executeAsync([
            playlistId,
            catId,
            item.nome,
            busca,
            item.logo,
            item.url,
            item.tvgId,
            item.tvgChno,
            chaveConteudo('live', item.nome),
          ]);
          resumo.live++;
        } else if (item.tipo === 'filme') {
          await ins.filme.executeAsync([
            playlistId,
            catId,
            item.nome,
            busca,
            item.logo,
            null,
            null,
            item.url,
            chaveConteudo('filme', item.nome),
          ]);
          resumo.filmes++;
        } else if (item.serie) {
          const k = `${catId}|${item.serie.nome}`;
          let serieId = series.get(k);
          if (serieId === undefined) {
            const r = await ins.serie.executeAsync([
              playlistId,
              catId,
              item.serie.nome,
              normalizar(item.serie.nome),
              item.logo,
              null,
              null,
              null,
              chaveConteudo('serie', item.serie.nome),
            ]);
            serieId = r.lastInsertRowId;
            series.set(k, serieId);
            resumo.series++;
          }
          await ins.episodio.executeAsync([serieId, item.serie.temporada, item.serie.episodio, item.nome, item.url]);
        }

        if (++n % LOTE === 0) {
          aoProgredir({ etapa: 'Gravando itens', feitos: n });
          await pausa();
        }
      }
      aoProgredir({ etapa: 'Gravando itens', feitos: n, total: n });
    } finally {
      await finalizar(ins);
    }
  });

  await gravarTotais(db, playlistId, resumo);
  return resumo;
}

/** Baixa a lista pela internet, com limite de tempo e mensagem clara de erro */
export async function baixarTexto(url: string, aoProgredir: AoProgredir = () => {}): Promise<string> {
  aoProgredir({ etapa: 'Baixando a lista', feitos: 0 });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch(url.trim(), { signal: ctrl.signal });
    if (!r.ok) throw new Error(`O servidor da lista respondeu ${r.status}`);
    return await r.text();
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('A lista demorou mais de 2 minutos para baixar');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/* --------------------------------- Xtream -------------------------------- */

export async function importarXtream(
  db: Banco,
  playlistId: number,
  conta: ContaXtream,
  aoProgredir: AoProgredir = () => {},
): Promise<ResumoImportacao> {
  aoProgredir({ etapa: 'Baixando canais ao vivo', feitos: 0 });
  const [catLive, live] = await Promise.all([xtream.categoriasLive(conta), xtream.live(conta)]);
  aoProgredir({ etapa: 'Baixando filmes', feitos: 0 });
  const [catVod, vod] = await Promise.all([
    xtream.categoriasVod(conta).catch(() => []),
    xtream.vod(conta).catch(() => []),
  ]);
  aoProgredir({ etapa: 'Baixando séries', feitos: 0 });
  const [catSer, series] = await Promise.all([
    xtream.categoriasSeries(conta).catch(() => []),
    xtream.series(conta).catch(() => []),
  ]);

  const total = live.length + vod.length + series.length;
  const resumo: ResumoImportacao = { live: 0, filmes: 0, series: 0, urlEpg: xtream.urlEpg(conta) };

  await db.withTransactionAsync(async () => {
    await limpar(db, playlistId);
    const ins = await preparar(db);
    try {
      const cats = new Categorias(ins.categoria, playlistId);
      const mapa = async (tipo: TipoConteudo, lista: { category_id: string; category_name: string }[]) => {
        const m = new Map<string, number>();
        for (const c of lista ?? [])
          m.set(String(c.category_id), await cats.id(tipo, c.category_name, String(c.category_id)));
        return m;
      };
      const mLive = await mapa('live', catLive);
      const mVod = await mapa('filme', catVod);
      const mSer = await mapa('serie', catSer);
      const cat = async (m: Map<string, number>, tipo: TipoConteudo, id?: string | null) =>
        m.get(String(id)) ?? (await cats.id(tipo, 'Sem categoria'));

      let n = 0;
      const passo = async () => {
        if (++n % LOTE === 0) {
          aoProgredir({ etapa: 'Gravando itens', feitos: n, total });
          await pausa();
        }
      };

      for (const c of live ?? []) {
        const p: Param[] = [
          playlistId,
          await cat(mLive, 'live', c.category_id),
          c.name,
          normalizar(c.name),
          c.stream_icon || null,
          urlStream(conta, 'live', c.stream_id, 'ts'),
          c.epg_channel_id || null,
          c.num ?? null,
          chaveConteudo('live', c.name),
        ];
        await ins.canal.executeAsync(p);
        resumo.live++;
        await passo();
      }
      for (const f of vod ?? []) {
        await ins.filme.executeAsync([
          playlistId,
          await cat(mVod, 'filme', f.category_id),
          f.name,
          normalizar(f.name),
          f.stream_icon || null,
          f.year || null,
          f.plot || null,
          urlStream(conta, 'movie', f.stream_id, f.container_extension || 'mp4'),
          chaveConteudo('filme', f.name),
        ]);
        resumo.filmes++;
        await passo();
      }
      for (const s of series ?? []) {
        await ins.serie.executeAsync([
          playlistId,
          await cat(mSer, 'serie', s.category_id),
          s.name,
          normalizar(s.name),
          s.cover || null,
          s.year || s.releaseDate?.slice(0, 4) || null,
          s.plot || null,
          String(s.series_id),
          chaveConteudo('serie', s.name),
        ]);
        resumo.series++;
        await passo();
      }
      aoProgredir({ etapa: 'Gravando itens', feitos: total, total });
    } finally {
      await finalizar(ins);
    }
  });

  await gravarTotais(db, playlistId, resumo);
  return resumo;
}
