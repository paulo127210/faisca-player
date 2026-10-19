/**
 * Banco local (SQLite). O app inteiro lê daqui; a lista do provedor
 * é importada uma vez e as telas nunca leem o arquivo M3U direto.
 *
 * A interface `Banco` é o pedaço do expo-sqlite que usamos. Isso permite
 * testar o importador no computador com o SQLite do Node.
 */

export type Param = string | number | null;

export interface Instrucao {
  executeAsync(params: Param[]): Promise<{ lastInsertRowId: number; changes: number }>;
  finalizeAsync(): Promise<void>;
}

export interface Banco {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: Param[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params: Param[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: Param[]): Promise<T | null>;
  prepareAsync(sql: string): Promise<Instrucao>;
  withTransactionAsync(tarefa: () => Promise<void>): Promise<void>;
}

const VERSAO = 2;

const ESQUEMA_V1 = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS playlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('m3u','xtream')),
  servidor TEXT,
  usuario TEXT,
  url_epg TEXT,
  total_live INTEGER NOT NULL DEFAULT 0,
  total_filmes INTEGER NOT NULL DEFAULT 0,
  total_series INTEGER NOT NULL DEFAULT 0,
  criada_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizada_em TEXT
);

CREATE TABLE IF NOT EXISTS categoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL REFERENCES playlist(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('live','filme','serie')),
  nome TEXT NOT NULL,
  ext_id TEXT,
  oculta INTEGER NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  UNIQUE (playlist_id, tipo, nome)
);

CREATE TABLE IF NOT EXISTS canal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL REFERENCES playlist(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES categoria(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  nome_busca TEXT NOT NULL,
  logo TEXT,
  url_stream TEXT NOT NULL,
  epg_id TEXT,
  numero INTEGER,
  chave TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canal_cat ON canal(categoria_id, numero, nome);
CREATE INDEX IF NOT EXISTS idx_canal_busca ON canal(nome_busca);
CREATE INDEX IF NOT EXISTS idx_canal_chave ON canal(chave);

CREATE TABLE IF NOT EXISTS filme (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL REFERENCES playlist(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES categoria(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  nome_busca TEXT NOT NULL,
  capa TEXT,
  ano TEXT,
  sinopse TEXT,
  url_stream TEXT NOT NULL,
  chave TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_filme_cat ON filme(categoria_id, titulo);
CREATE INDEX IF NOT EXISTS idx_filme_busca ON filme(nome_busca);

CREATE TABLE IF NOT EXISTS serie (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL REFERENCES playlist(id) ON DELETE CASCADE,
  categoria_id INTEGER REFERENCES categoria(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  nome_busca TEXT NOT NULL,
  capa TEXT,
  ano TEXT,
  sinopse TEXT,
  ext_id TEXT,
  chave TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_serie_cat ON serie(categoria_id, titulo);
CREATE INDEX IF NOT EXISTS idx_serie_busca ON serie(nome_busca);

CREATE TABLE IF NOT EXISTS episodio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serie_id INTEGER NOT NULL REFERENCES serie(id) ON DELETE CASCADE,
  temporada INTEGER NOT NULL,
  numero INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  url_stream TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_episodio_serie ON episodio(serie_id, temporada, numero);

CREATE TABLE IF NOT EXISTS programa_epg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epg_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  inicio INTEGER NOT NULL,
  fim INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_epg ON programa_epg(epg_id, inicio);

CREATE TABLE IF NOT EXISTS perfil (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  avatar TEXT,
  pin_hash TEXT,
  infantil INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorito (
  perfil_id INTEGER NOT NULL REFERENCES perfil(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  tipo TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (perfil_id, chave)
);

CREATE TABLE IF NOT EXISTS historico (
  perfil_id INTEGER NOT NULL REFERENCES perfil(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  posicao_seg REAL NOT NULL DEFAULT 0,
  duracao_seg REAL NOT NULL DEFAULT 0,
  assistido_em TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (perfil_id, chave)
);

CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT
);

INSERT INTO perfil (id, nome) SELECT 1, 'Principal' WHERE NOT EXISTS (SELECT 1 FROM perfil WHERE id = 1);
`;

/** Versão 2: controle parental por categoria e guia ligado à lista de origem */
const ESQUEMA_V2 = `
ALTER TABLE categoria ADD COLUMN bloqueada INTEGER NOT NULL DEFAULT 0;
ALTER TABLE programa_epg ADD COLUMN playlist_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_epg_playlist ON programa_epg(playlist_id);
CREATE INDEX IF NOT EXISTS idx_epg_agora ON programa_epg(fim, inicio);
`;

/** Cria ou atualiza as tabelas conforme a versão gravada no próprio banco */
export async function migrar(db: Banco): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const linha = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const atual = linha?.user_version ?? 0;
  if (atual >= VERSAO) return;
  if (atual < 1) await db.execAsync(ESQUEMA_V1);
  if (atual < 2) await db.execAsync(ESQUEMA_V2);
  // futuras versões: if (atual < 3) await db.execAsync(ESQUEMA_V3);
  await db.execAsync(`PRAGMA user_version = ${VERSAO}`);
}
