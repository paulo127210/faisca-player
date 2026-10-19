/**
 * Leitor de listas M3U / M3U8 (formato #EXTM3U com #EXTINF).
 * Funciona como gerador para que o importador processe aos poucos
 * sem travar a tela, mesmo com listas de dezenas de milhares de itens.
 */
import type { TipoConteudo } from './texto';

export interface ItemM3U {
  nome: string;
  url: string;
  grupo: string;
  logo: string | null;
  tvgId: string | null;
  tvgChno: number | null;
  tipo: TipoConteudo;
  /** Preenchido quando o item é episódio de série */
  serie?: { nome: string; temporada: number; episodio: number };
}

export interface CabecalhoM3U {
  /** URL do guia (EPG) informada no cabeçalho, quando existe */
  urlEpg: string | null;
}

const ATRIBUTO = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
const EXT_VOD = /\.(mp4|mkv|avi|mov|wmv|flv|m4v|webm)(\?.*)?$/i;
const EPISODIO = /^(.*?)[\s._-]*S(\d{1,2})\s*E(\d{1,3})\b/i;

function lerAtributos(linha: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of linha.matchAll(ATRIBUTO)) out[m[1].toLowerCase()] = m[2];
  return out;
}

/** Nome depois da última vírgula fora de aspas: #EXTINF:-1 tvg-name="a,b",Nome do Canal */
function lerNome(linha: string): string {
  let dentroAspas = false;
  let ultimaVirgula = -1;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') dentroAspas = !dentroAspas;
    else if (c === ',' && !dentroAspas) ultimaVirgula = i;
  }
  return ultimaVirgula >= 0 ? linha.slice(ultimaVirgula + 1).trim() : '';
}

export function classificar(url: string, nome: string, grupo: string): Pick<ItemM3U, 'tipo' | 'serie'> {
  const u = url.toLowerCase();
  const ep = nome.match(EPISODIO);
  if (u.includes('/series/') || (ep && EXT_VOD.test(u))) {
    if (ep) {
      return {
        tipo: 'serie',
        serie: { nome: ep[1].trim() || nome, temporada: Number(ep[2]), episodio: Number(ep[3]) },
      };
    }
    return { tipo: 'serie', serie: { nome: grupo || nome, temporada: 1, episodio: 0 } };
  }
  if (u.includes('/movie/') || EXT_VOD.test(u)) return { tipo: 'filme' };
  return { tipo: 'live' };
}

export function lerCabecalho(texto: string): CabecalhoM3U {
  const primeira = texto.slice(0, 2000).split(/\r?\n/, 1)[0] ?? '';
  if (!primeira.trim().startsWith('#EXTM3U')) return { urlEpg: null };
  const a = lerAtributos(primeira);
  const epg = a['url-tvg'] || a['x-tvg-url'] || null;
  return { urlEpg: epg ? epg.split(',')[0].trim() : null };
}

export function pareceM3U(texto: string): boolean {
  const ini = texto.slice(0, 2000).trimStart();
  return ini.startsWith('#EXTM3U') || ini.includes('#EXTINF');
}

export function* lerM3U(texto: string): Generator<ItemM3U> {
  const linhas = texto.split(/\r?\n/);
  let info: string | null = null;
  let grupoExtgrp = '';

  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) continue;

    if (linha.startsWith('#EXTINF')) {
      info = linha;
      grupoExtgrp = '';
      continue;
    }
    if (linha.startsWith('#EXTGRP:')) {
      grupoExtgrp = linha.slice(8).trim();
      continue;
    }
    if (linha.startsWith('#')) continue; // #EXTVLCOPT, #KODIPROP etc.

    // linha de URL
    if (!info) continue; // URL solta sem #EXTINF é ignorada
    const a = lerAtributos(info);
    const nome = lerNome(info) || a['tvg-name'] || 'Sem nome';
    const grupo = a['group-title'] || grupoExtgrp || 'Sem categoria';
    const chno = a['tvg-chno'] ? Number.parseInt(a['tvg-chno'], 10) : NaN;
    const { tipo, serie } = classificar(linha, nome, grupo);

    yield {
      nome,
      url: linha,
      grupo,
      logo: a['tvg-logo'] || null,
      tvgId: a['tvg-id'] || null,
      tvgChno: Number.isFinite(chno) ? chno : null,
      tipo,
      serie,
    };
    info = null;
  }
}
