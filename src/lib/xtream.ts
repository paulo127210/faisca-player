/**
 * Cliente da API Xtream Codes (player_api.php).
 * A senha nunca é gravada no banco: as URLs guardadas levam o marcador
 * {SENHA}, que só é trocado pela senha real (do cofre) na hora de tocar.
 */

export const MARCADOR_SENHA = '{SENHA}';

export interface ContaXtream {
  servidor: string; // ex.: http://exemplo.com:8080
  usuario: string;
  senha: string;
}

export interface CategoriaXtream {
  category_id: string;
  category_name: string;
}
export interface LiveXtream {
  stream_id: number;
  name: string;
  stream_icon?: string;
  epg_channel_id?: string | null;
  category_id?: string | null;
  num?: number;
}
export interface VodXtream {
  stream_id: number;
  name: string;
  stream_icon?: string;
  category_id?: string | null;
  container_extension?: string;
  year?: string;
  plot?: string;
}
export interface SerieXtream {
  series_id: number;
  name: string;
  cover?: string;
  category_id?: string | null;
  plot?: string;
  year?: string;
  releaseDate?: string;
}
export interface InfoConta {
  user_info?: { auth?: number; status?: string; exp_date?: string | null; max_connections?: string };
}

/** Limpa o endereço digitado: tira barra final e player_api.php; põe http:// se faltar */
export function normalizarServidor(servidor: string): string {
  let s = servidor
    .trim()
    .replace(/\/+(player_api\.php|get\.php).*$/i, '')
    .replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  return s;
}

/** Reconhece um link M3U de painel Xtream e extrai a conta: get.php?username=..&password=.. */
export function contaDeLinkM3U(link: string): ContaXtream | null {
  try {
    const u = new URL(link.trim());
    const usuario = u.searchParams.get('username');
    const senha = u.searchParams.get('password');
    if (!usuario || !senha || !/get\.php$/i.test(u.pathname)) return null;
    return { servidor: `${u.protocol}//${u.host}`, usuario, senha };
  } catch {
    return null;
  }
}

function urlApi(c: ContaXtream, acao?: string): string {
  const base = `${normalizarServidor(c.servidor)}/player_api.php?username=${encodeURIComponent(
    c.usuario,
  )}&password=${encodeURIComponent(c.senha)}`;
  return acao ? `${base}&action=${acao}` : base;
}

async function pedir<T>(url: string, tempoMs = 30000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), tempoMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`O servidor respondeu ${r.status}`);
    return (await r.json()) as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('O servidor demorou demais para responder');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function testarConta(c: ContaXtream): Promise<InfoConta> {
  const info = await pedir<InfoConta>(urlApi(c), 15000);
  if (!info?.user_info || info.user_info.auth === 0) throw new Error('Usuário ou senha inválidos');
  if (info.user_info.status && info.user_info.status !== 'Active')
    throw new Error(`Conta com status "${info.user_info.status}"`);
  return info;
}

export const xtream = {
  categoriasLive: (c: ContaXtream) => pedir<CategoriaXtream[]>(urlApi(c, 'get_live_categories')),
  live: (c: ContaXtream) => pedir<LiveXtream[]>(urlApi(c, 'get_live_streams'), 90000),
  categoriasVod: (c: ContaXtream) => pedir<CategoriaXtream[]>(urlApi(c, 'get_vod_categories')),
  vod: (c: ContaXtream) => pedir<VodXtream[]>(urlApi(c, 'get_vod_streams'), 90000),
  categoriasSeries: (c: ContaXtream) => pedir<CategoriaXtream[]>(urlApi(c, 'get_series_categories')),
  series: (c: ContaXtream) => pedir<SerieXtream[]>(urlApi(c, 'get_series'), 90000),
  urlEpg: (c: ContaXtream) =>
    `${normalizarServidor(c.servidor)}/xmltv.php?username=${encodeURIComponent(c.usuario)}&password=${MARCADOR_SENHA}`,
};

/** URL de reprodução com {SENHA} no lugar da senha */
export function urlStream(
  c: Pick<ContaXtream, 'servidor' | 'usuario'>,
  tipo: 'live' | 'movie' | 'series',
  id: number | string,
  ext: string,
): string {
  return `${normalizarServidor(c.servidor)}/${tipo}/${encodeURIComponent(c.usuario)}/${MARCADOR_SENHA}/${id}.${ext}`;
}

export function aplicarSenha(url: string, senha: string | null): string {
  return senha ? url.split(MARCADOR_SENHA).join(encodeURIComponent(senha)) : url;
}
