/**
 * Utilidades de texto usadas na busca e na chave estável de favoritos.
 */

/** Remove acentos, deixa minúsculo e junta espaços. "Ação  HD" -> "acao hd" */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Tira marcações de qualidade que mudam de uma lista para outra: "Globo HD [BR]" -> "globo" */
export function nomeBase(nome: string): string {
  return normalizar(
    nome.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\b(fhd|uhd|hd|sd|4k|8k|h265|hevc|alt|backup)\b/gi, ' '),
  );
}

export type TipoConteudo = 'live' | 'filme' | 'serie';

/**
 * Chave estável de um conteúdo. Favoritos e histórico usam esta chave
 * em vez da URL, assim nada se perde quando o provedor troca o link.
 */
export function chaveConteudo(tipo: TipoConteudo, nome: string): string {
  return `${tipo}:${nomeBase(nome) || normalizar(nome)}`;
}
