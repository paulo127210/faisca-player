/** Consultas usadas pelas telas. Tudo lê do banco local. */
import { obterBanco } from './db';
import { idGuiaSQL } from './epg';
import { esconderBloqueados } from './parental';
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
  bloqueada: number;
}
export interface Canal {
  id: number;
  nome: string;
  logo: string | null;
  numero: number | null;
  chave: string;
  /** Programa no ar agora, quando a lista tem guia */
  agora: string | null;
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
export interface Programa {
  id: number;
  titulo: string;
  descricao: string | null;
  inicio: number;
  fim: number;
}

const TABELA = { live: 'canal', filme: 'filme', serie: 'serie' } as const;
const agoraSeg = () => Math.floor(Date.now() / 1000);

/** Trecho SQL que tira itens de categorias bloqueadas (tabela com apelido x) */
async function filtroParental(): Promise<string> {
  return (await esconderBloqueados())
    ? 'AND NOT EXISTS (SELECT 1 FROM categoria k WHERE k.id = x.categoria_id AND k.bloqueada = 1)'
    : '';
}

/** Junta o canal (apelido x) ao programa no ar */
const JUNTA_AGORA = `LEFT JOIN programa_epg p ON p.playlist_id = x.playlist_id
  AND p.epg_id = ${idGuiaSQL('x.epg_id')} AND p.inicio <= ? AND p.fim > ?`;

export async function listas(): Promise<Playlist[]> {
  const db = await obterBanco();
  return db.getAllAsync<Playlist>('SELECT * FROM playlist ORDER BY id', []);
}

export async function categorias(tipo: TipoConteudo): Promise<Categoria[]> {
  const db = await obterBanco();
  const t = TABELA[tipo];
  return db.getAllAsync<Categoria>(
    `SELECT c.id, c.nome, c.bloqueada, COUNT(x.id) AS total FROM categoria c
     JOIN ${t} x ON x.categoria_id = c.id
     WHERE c.tipo = ? AND c.oculta = 0
     GROUP BY c.id ORDER BY c.playlist_id, c.ordem`,
    [tipo],
  );
}

/** Todas as categorias de um tipo, inclusive ocultas (tela de controle parental) */
export async function todasCategorias(): Promise<(Categoria & { tipo: TipoConteudo })[]> {
  const db = await obterBanco();
  return db.getAllAsync(
    `SELECT id, nome, tipo, bloqueada, 0 AS total FROM categoria ORDER BY bloqueada DESC, tipo, playlist_id, ordem`,
    [],
  );
}

export async function canais(categoriaId: number | null): Promise<Canal[]> {
  const db = await obterBanco();
  const t = agoraSeg();
  if (categoriaId === null) {
    const filtro = await filtroParental();
    return db.getAllAsync<Canal>(
      `SELECT x.id, x.nome, x.logo, x.numero, x.chave, MIN(p.titulo) AS agora FROM canal x ${JUNTA_AGORA}
       LEFT JOIN categoria c ON c.id = x.categoria_id
       WHERE COALESCE(c.oculta, 0) = 0 ${filtro} GROUP BY x.id ORDER BY x.id`,
      [t, t],
    );
  }
  return db.getAllAsync<Canal>(
    `SELECT x.id, x.nome, x.logo, x.numero, x.chave, MIN(p.titulo) AS agora FROM canal x ${JUNTA_AGORA}
     WHERE x.categoria_id = ? GROUP BY x.id ORDER BY COALESCE(x.numero, 999999), x.id`,
    [t, t, categoriaId],
  );
}

async function catalogo(tabela: 'filme' | 'serie', categoriaId: number | null): Promise<Filme[]> {
  const db = await obterBanco();
  if (categoriaId !== null)
    return db.getAllAsync<Filme>(
      `SELECT id, titulo, capa, ano, chave FROM ${tabela} WHERE categoria_id = ? ORDER BY id DESC`,
      [categoriaId],
    );
  const filtro = await filtroParental();
  return db.getAllAsync<Filme>(
    `SELECT x.id, x.titulo, x.capa, x.ano, x.chave FROM ${tabela} x
     LEFT JOIN categoria c ON c.id = x.categoria_id
     WHERE COALESCE(c.oculta, 0) = 0 ${filtro} ORDER BY x.id DESC`,
    [],
  );
}
export const filmes = (categoriaId: number | null) => catalogo('filme', categoriaId);
export const series = (categoriaId: number | null) => catalogo('serie', categoriaId);

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

/* ---------------------------- Guia (EPG) ---------------------------- */

/** Programação do canal a partir do programa no ar (até 24 h à frente) */
export async function guiaDoCanal(canalId: number): Promise<Programa[]> {
  const db = await obterBanco();
  const t = agoraSeg();
  return db.getAllAsync<Programa>(
    `SELECT p.id, p.titulo, p.descricao, p.inicio, p.fim FROM canal x
     JOIN programa_epg p ON p.playlist_id = x.playlist_id AND p.epg_id = ${idGuiaSQL('x.epg_id')}
     WHERE x.id = ? AND p.fim > ? AND p.inicio < ? ORDER BY p.inicio LIMIT 40`,
    [canalId, t, t + 24 * 3600],
  );
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
  const filtro = await filtroParental();
  return db.getAllAsync<ItemLista>(
    `SELECT * FROM (
       SELECT 'live' AS tipo, MIN(x.id) AS id, x.nome AS titulo, x.logo AS imagem, f.chave, f.criado_em
         FROM favorito f JOIN canal x ON x.chave = f.chave WHERE f.perfil_id = ? ${filtro} GROUP BY f.chave
       UNION ALL
       SELECT 'filme', MIN(x.id), x.titulo, x.capa, f.chave, f.criado_em
         FROM favorito f JOIN filme x ON x.chave = f.chave WHERE f.perfil_id = ? ${filtro} GROUP BY f.chave
       UNION ALL
       SELECT 'serie', MIN(x.id), x.titulo, x.capa, f.chave, f.criado_em
         FROM favorito f JOIN serie x ON x.chave = f.chave WHERE f.perfil_id = ? ${filtro} GROUP BY f.chave
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
  const filtro = await filtroParental();
  return db.getAllAsync<ItemLista>(
    `SELECT * FROM (
       SELECT 'live' AS tipo, MIN(x.id) AS id, x.nome AS titulo, x.logo AS imagem, h.chave, NULL AS progresso, h.assistido_em
         FROM historico h JOIN canal x ON x.chave = h.chave
         WHERE h.perfil_id = ? AND h.tipo = 'live' ${filtro} GROUP BY h.chave
       UNION ALL
       SELECT 'filme', MIN(x.id), x.titulo, x.capa, h.chave, h.posicao_seg * 1.0 / h.duracao_seg, h.assistido_em
         FROM historico h JOIN filme x ON x.chave = h.chave
         WHERE h.perfil_id = ? AND h.duracao_seg > 0 AND h.posicao_seg * 1.0 / h.duracao_seg < 0.95 ${filtro}
         GROUP BY h.chave
     ) ORDER BY assistido_em DESC LIMIT 20`,
    [PERFIL, PERFIL],
  );
}

/* -------------------------------- Busca -------------------------------- */

export async function buscar(texto: string): Promise<ItemLista[]> {
  const termo = normalizar(texto);
  if (termo.length < 2) return [];
  const db = await obterBanco();
  const filtro = await filtroParental();
  const like = `%${termo}%`;
  return db.getAllAsync<ItemLista>(
    `SELECT * FROM (SELECT 'live' AS tipo, x.id, x.nome AS titulo, x.logo AS imagem, x.chave FROM canal x
                    WHERE x.nome_busca LIKE ? ${filtro} LIMIT 60)
     UNION ALL SELECT * FROM (SELECT 'filme', x.id, x.titulo, x.capa, x.chave FROM filme x
                    WHERE x.nome_busca LIKE ? ${filtro} LIMIT 60)
     UNION ALL SELECT * FROM (SELECT 'serie', x.id, x.titulo, x.capa, x.chave FROM serie x
                    WHERE x.nome_busca LIKE ? ${filtro} LIMIT 60)`,
    [like, like, like],
  );
}

/* ---------------------------- Configurações ---------------------------- */

export async function lerConfig(chave: string): Promise<string | null> {
  const db = await obterBanco();
  return (
    (await db.getFirstAsync<{ valor: string | null }>('SELECT valor FROM config WHERE chave = ?', [chave]))?.valor ??
    null
  );
}

export async function gravarConfig(chave: string, valor: string) {
  const db = await obterBanco();
  await db.runAsync(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor',
    [chave, valor],
  );
}
