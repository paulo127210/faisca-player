/** Consultas usadas pelas telas. Tudo lê do banco local. */
import { obterBanco } from './db';
import { normalizar, type TipoConteudo } from './texto';

export const PERFIL = 1; // perfis múltiplos chegam na versão 1.1

export interface Playlist {
  id: number;
  nome: string;
  tipo: 'm3u' | 'xtream';
  servidor: string | null;
  usuario: string | null;
  url_epg: string | null;
  total_live: number;
  total_filmes: number;
  total_series: number;
  atualizada_em: string | null;
}
export interface Categoria {
  id: number;
  nome: string;
  total: number;
}
export interface Canal {
  id: number;
  nome: string;
  logo: string | null;
  numero: number | null;
  chave: string;
}
export interface Filme {
  id: number;
  titulo: string;
  capa: string | null;
  ano: string | null;
  chave: string;
}
export interface Serie extends Filme {
  sinopse: string | null;
  ext_id: string | null;
  playlist_id: number;
}
export interface Episodio {
  id: number;
  temporada: number;
  numero: number;
  titulo: string;
}
export interface ItemTocavel {
  titulo: string;
  url: string;
  chave: string;
  playlist_id: number;
  tipo: TipoConteudo;
}
export interface ItemLista {
  tipo: TipoConteudo;
  id: number;
  titulo: string;
  imagem: string | null;
  chave: string;
  progresso?: number;
}

const TABELA = { live: 'canal', filme: 'filme', serie: 'serie' } as const;

export async function listas(): Promise<Playlist[]> {
  const db = await obterBanco();
  return db.getAllAsync<Playlist>('SELECT * FROM playlist ORDER BY id', []);
}

export async function categorias(tipo: TipoConteudo): Promise<Categoria[]> {
  const db = await obterBanco();
  const t = TABELA[tipo];
  return db.getAllAsync<Categoria>(
    `SELECT c.id, c.nome, COUNT(x.id) AS total FROM categoria c
     JOIN ${t} x ON x.categoria_id = c.id
     WHERE c.tipo = ? AND c.oculta = 0
     GROUP BY c.id ORDER BY c.playlist_id, c.ordem`,
    [tipo],
  );
}

export async function canais(categoriaId: number | null): Promise<Canal[]> {
  const db = await obterBanco();
  return categoriaId === null
    ? db.getAllAsync<Canal>(
        `SELECT x.id, x.nome, x.logo, x.numero, x.chave FROM canal x
         LEFT JOIN categoria c ON c.id = x.categoria_id WHERE COALESCE(c.oculta, 0) = 0 ORDER BY x.id`,
        [],
      )
    : db.getAllAsync<Canal>(
        'SELECT id, nome, logo, numero, chave FROM canal WHERE categoria_id = ? ORDER BY COALESCE(numero, 999999), id',
        [categoriaId],
      );
}

export async function filmes(categoriaId: number | null): Promise<Filme[]> {
  const db = await obterBanco();
  return db.getAllAsync<Filme>(
    `SELECT id, titulo, capa, ano, chave FROM filme ${categoriaId === null ? '' : 'WHERE categoria_id = ?'} ORDER BY id DESC`,
    categoriaId === null ? [] : [categoriaId],
  );
}

export async function series(categoriaId: number | null): Promise<Filme[]> {
  const db = await obterBanco();
  return db.getAllAsync<Filme>(
    `SELECT id, titulo, capa, ano, chave FROM serie ${categoriaId === null ? '' : 'WHERE categoria_id = ?'} ORDER BY id DESC`,
    categoriaId === null ? [] : [categoriaId],
  );
}

export async function serie(id: number): Promise<Serie | null> {
  const db = await obterBanco();
  return db.getFirstAsync<Serie>('SELECT * FROM serie WHERE id = ?', [id]);
}

export async function episodios(serieId: number): Promise<Episodio[]> {
  const db = await obterBanco();
  return db.getAllAsync<Episodio>(
    'SELECT id, temporada, numero, titulo FROM episodio WHERE serie_id = ? ORDER BY temporada, numero, id',
    [serieId],
  );
}

/** Dados para o player. tipo 'episodio' busca na tabela de episódios. */
export async function itemTocavel(tipo: 'live' | 'filme' | 'episodio', id: number): Promise<ItemTocavel | null> {
  const db = await obterBanco();
  if (tipo === 'live')
    return db.getFirstAsync<ItemTocavel>(
      "SELECT nome AS titulo, url_stream AS url, chave, playlist_id, 'live' AS tipo FROM canal WHERE id = ?",
      [id],
    );
  if (tipo === 'filme')
    return db.getFirstAsync<ItemTocavel>(
      "SELECT titulo, url_stream AS url, chave, playlist_id, 'filme' AS tipo FROM filme WHERE id = ?",
      [id],
    );
  return db.getFirstAsync<ItemTocavel>(
    `SELECT e.titulo, e.url_stream AS url, s.chave || ':s' || e.temporada || 'e' || e.numero AS chave,
     s.playlist_id, 'serie' AS tipo FROM episodio e JOIN serie s ON s.id = e.serie_id WHERE e.id = ?`,
    [id],
  );
}

/** Canal anterior / próximo da mesma categoria, para trocar de canal no player */
export async function canalVizinho(id: number, direcao: 1 | -1): Promise<number | null> {
  const db = await obterBanco();
  const r = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM canal WHERE categoria_id = (SELECT categoria_id FROM canal WHERE id = ?)
     AND id ${direcao === 1 ? '>' : '<'} ? ORDER BY id ${direcao === 1 ? 'ASC' : 'DESC'} LIMIT 1`,
    [id, id],
  );
  return r?.id ?? null;
}

/* ------------------------------ Favoritos ------------------------------ */

export async function ehFavorito(chave: string): Promise<boolean> {
  const db = await obterBanco();
  return !!(await db.getFirstAsync('SELECT 1 AS s FROM favorito WHERE perfil_id = ? AND chave = ?', [PERFIL, chave]));
}

export async function alternarFavorito(chave: string, tipo: TipoConteudo): Promise<boolean> {
  const db = await obterBanco();
  if (await ehFavorito(chave)) {
    await db.runAsync('DELETE FROM favorito WHERE perfil_id = ? AND chave = ?', [PERFIL, chave]);
    return false;
  }
  await db.runAsync('INSERT INTO favorito (perfil_id, chave, tipo) VALUES (?, ?, ?)', [PERFIL, chave, tipo]);
  return true;
}

/** Favoritos ligados ao conteúdo atual pela chave (sobrevivem à troca de link) */
export async function favoritos(): Promise<ItemLista[]> {
  const db = await obterBanco();
  return db.getAllAsync<ItemLista>(
    `SELECT * FROM (
       SELECT 'live' AS tipo, MIN(c.id) AS id, c.nome AS titulo, c.logo AS imagem, f.chave, f.criado_em
         FROM favorito f JOIN canal c ON c.chave = f.chave WHERE f.perfil_id = ? GROUP BY f.chave
       UNION ALL
       SELECT 'filme', MIN(x.id), x.titulo, x.capa, f.chave, f.criado_em
         FROM favorito f JOIN filme x ON x.chave = f.chave WHERE f.perfil_id = ? GROUP BY f.chave
       UNION ALL
       SELECT 'serie', MIN(x.id), x.titulo, x.capa, f.chave, f.criado_em
         FROM favorito f JOIN serie x ON x.chave = f.chave WHERE f.perfil_id = ? GROUP BY f.chave
     ) ORDER BY criado_em DESC`,
    [PERFIL, PERFIL, PERFIL],
  );
}

/* ------------------------------ Histórico ------------------------------ */

export async function registrarHistorico(
  chave: string,
  tipo: TipoConteudo,
  titulo: string,
  posicao: number,
  duracao: number,
) {
  const db = await obterBanco();
  await db.runAsync(
    `INSERT INTO historico (perfil_id, chave, tipo, titulo, posicao_seg, duracao_seg, assistido_em)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (perfil_id, chave) DO UPDATE SET posicao_seg = excluded.posicao_seg,
       duracao_seg = excluded.duracao_seg, titulo = excluded.titulo, assistido_em = excluded.assistido_em`,
    [PERFIL, chave, tipo, titulo, Math.floor(posicao), Math.floor(duracao)],
  );
}

export async function posicaoSalva(chave: string): Promise<number> {
  const db = await obterBanco();
  const r = await db.getFirstAsync<{ posicao_seg: number; duracao_seg: number }>(
    'SELECT posicao_seg, duracao_seg FROM historico WHERE perfil_id = ? AND chave = ?',
    [PERFIL, chave],
  );
  if (!r || r.duracao_seg <= 0) return 0;
  // perto do fim conta como assistido: recomeça do início
  return r.posicao_seg / r.duracao_seg > 0.95 ? 0 : r.posicao_seg;
}

/** "Continuar assistindo": filmes começados e canais vistos por último */
export async function continuarAssistindo(): Promise<ItemLista[]> {
  const db = await obterBanco();
  return db.getAllAsync<ItemLista>(
    `SELECT * FROM (
       SELECT 'live' AS tipo, MIN(c.id) AS id, c.nome AS titulo, c.logo AS imagem, h.chave, NULL AS progresso, h.assistido_em
         FROM historico h JOIN canal c ON c.chave = h.chave WHERE h.perfil_id = ? AND h.tipo = 'live' GROUP BY h.chave
       UNION ALL
       SELECT 'filme', MIN(x.id), x.titulo, x.capa, h.chave, h.posicao_seg * 1.0 / h.duracao_seg, h.assistido_em
         FROM historico h JOIN filme x ON x.chave = h.chave
         WHERE h.perfil_id = ? AND h.duracao_seg > 0 AND h.posicao_seg * 1.0 / h.duracao_seg < 0.95 GROUP BY h.chave
     ) ORDER BY assistido_em DESC LIMIT 20`,
    [PERFIL, PERFIL],
  );
}

/* -------------------------------- Busca -------------------------------- */

export async function buscar(texto: string): Promise<ItemLista[]> {
  const termo = normalizar(texto);
  if (termo.length < 2) return [];
  const db = await obterBanco();
  const like = `%${termo}%`;
  return db.getAllAsync<ItemLista>(
    `SELECT * FROM (SELECT 'live' AS tipo, id, nome AS titulo, logo AS imagem, chave FROM canal WHERE nome_busca LIKE ? LIMIT 60)
     UNION ALL SELECT * FROM (SELECT 'filme', id, titulo, capa, chave FROM filme WHERE nome_busca LIKE ? LIMIT 60)
     UNION ALL SELECT * FROM (SELECT 'serie', id, titulo, capa, chave FROM serie WHERE nome_busca LIKE ? LIMIT 60)`,
    [like, like, like],
  );
}
