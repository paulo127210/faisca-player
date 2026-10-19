/**
 * Guia de programação (EPG) no formato XMLTV, compactado (.gz) ou não.
 * Só grava os programas dos canais que existem na lista e numa janela
 * de 3 horas atrás até 36 horas à frente, para o banco ficar pequeno.
 */
import { gunzipSync, strFromU8 } from 'fflate';
import type { Banco } from './banco';
import { chaveConteudo } from './texto';

export interface ProgramaXMLTV {
  canal: string;
  inicio: number; // segundos desde 1970
  fim: number;
  titulo: string;
  descricao: string | null;
}

export interface ResumoEPG {
  programas: number;
  canaisComGuia: number;
  canaisLigadosPeloNome: number;
}

/**
 * Forma comparável do id do canal no guia: minúsculo e sem o sufixo "@SD/@HD"
 * que listas como a do iptv-org colocam ("Globo.br@HD" encontra "globo.br").
 */
export function idGuia(id: string): string {
  return id.split('@')[0].trim().toLowerCase();
}
/** O mesmo que idGuia, em SQL, para usar nas consultas */
export const idGuiaSQL = (col: string) =>
  `lower(trim(CASE WHEN instr(${col}, '@') > 0 THEN substr(${col}, 1, instr(${col}, '@') - 1) ELSE ${col} END))`;

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodificar(t: string): string {
  return t
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
      if (e[0] !== '#') return ENTIDADES[e.toLowerCase()] ?? _;
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .trim();
}

/** "20261019213000 -0300" -> segundos UTC. Sem fuso, considera UTC. */
export function lerHorario(v: string): number | null {
  const m = v.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if (!m) return null;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) / 1000;
  if (!m[7]) return utc;
  const sinal = m[7][0] === '-' ? -1 : 1;
  const desloc = sinal * (parseInt(m[7].slice(1, 3), 10) * 3600 + parseInt(m[7].slice(3, 5), 10) * 60);
  return utc - desloc;
}

/** Bytes do arquivo (gzip ou texto puro) para texto */
export function bytesParaTexto(bytes: Uint8Array): string {
  const gzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  return strFromU8(gzip ? gunzipSync(bytes) : bytes);
}

const ATTR = (bloco: string, nome: string) => bloco.match(new RegExp(`\\b${nome}="([^"]*)"`))?.[1] ?? null;

/** Canais do guia: id -> nomes exibidos */
export function lerCanaisXMLTV(texto: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of texto.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel>/g)) {
    const id = ATTR(m[1], 'id');
    if (!id) continue;
    const nomes = [...m[2].matchAll(/<display-name[^>]*>([\s\S]*?)<\/display-name>/g)].map((d) => decodificar(d[1]));
    out.set(id, nomes);
  }
  return out;
}

export function* lerProgramasXMLTV(texto: string): Generator<ProgramaXMLTV> {
  for (const m of texto.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/g)) {
    const canal = ATTR(m[1], 'channel');
    const inicio = lerHorario(ATTR(m[1], 'start') ?? '');
    const fim = lerHorario(ATTR(m[1], 'stop') ?? '');
    const titulo = m[2].match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1];
    if (!canal || inicio === null || fim === null || !titulo) continue;
    const desc = m[2].match(/<desc[^>]*>([\s\S]*?)<\/desc>/)?.[1];
    yield { canal, inicio, fim, titulo: decodificar(titulo), descricao: desc ? decodificar(desc) : null };
  }
}

/**
 * Grava o guia da lista. Canais sem tvg-id são ligados ao guia pelo nome
 * ("Globo HD" na lista encontra "Globo" no guia), um problema comum
 * nos outros players.
 */
export async function importarEPG(
  db: Banco,
  playlistId: number,
  texto: string,
  agoraSeg = Math.floor(Date.now() / 1000),
): Promise<ResumoEPG> {
  if (!texto.includes('<tv')) throw new Error('O arquivo do guia não está no formato XMLTV');
  const de = agoraSeg - 3 * 3600;
  const ate = agoraSeg + 36 * 3600;
  const resumo: ResumoEPG = { programas: 0, canaisComGuia: 0, canaisLigadosPeloNome: 0 };

  await db.withTransactionAsync(async () => {
    // 1. ligar pelo nome os canais que vieram sem tvg-id
    const ligar = await db.prepareAsync(
      'UPDATE canal SET epg_id = ? WHERE playlist_id = ? AND epg_id IS NULL AND chave = ?',
    );
    try {
      for (const [id, nomes] of lerCanaisXMLTV(texto)) {
        for (const nome of nomes) {
          const r = await ligar.executeAsync([id, playlistId, chaveConteudo('live', nome)]);
          resumo.canaisLigadosPeloNome += r.changes;
        }
      }
    } finally {
      await ligar.finalizeAsync();
    }

    // 2. só os canais que existem na lista
    const usados = new Set(
      (
        await db.getAllAsync<{ e: string }>(
          `SELECT DISTINCT ${idGuiaSQL('epg_id')} AS e FROM canal WHERE playlist_id = ? AND epg_id IS NOT NULL`,
          [playlistId],
        )
      ).map((l) => l.e),
    );

    await db.runAsync('DELETE FROM programa_epg WHERE playlist_id = ?', [playlistId]);
    const ins = await db.prepareAsync(
      'INSERT INTO programa_epg (playlist_id, epg_id, titulo, descricao, inicio, fim) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const comGuia = new Set<string>();
    try {
      for (const p of lerProgramasXMLTV(texto)) {
        const id = idGuia(p.canal);
        if (!usados.has(id) || p.fim < de || p.inicio > ate) continue;
        await ins.executeAsync([playlistId, id, p.titulo, p.descricao, p.inicio, p.fim]);
        comGuia.add(id);
        resumo.programas++;
      }
    } finally {
      await ins.finalizeAsync();
    }
    resumo.canaisComGuia = comGuia.size;
  });

  return resumo;
}
