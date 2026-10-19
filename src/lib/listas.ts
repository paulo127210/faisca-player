/** Adicionar, atualizar e remover listas; montar a URL final para tocar */
import { obterBanco } from './db';
import { baixarTexto, importarTextoM3U, importarXtream, type AoProgredir, type ResumoImportacao } from './importador';
import { bytesParaTexto, importarEPG, type ResumoEPG } from './epg';
import { gravarConfig, lerConfig, type Playlist } from './repo';
import { cofre } from './seguro';
import {
  aplicarSenha,
  contaDeLinkM3U,
  normalizarServidor,
  testarConta,
  urlStream,
  MARCADOR_SENHA,
  type ContaXtream,
} from './xtream';

export type NovaLista =
  | { tipo: 'm3u'; nome: string; url?: string; texto?: string }
  | { tipo: 'xtream'; nome: string; servidor: string; usuario: string; senha: string };

export async function adicionarLista(nova: NovaLista, aoProgredir?: AoProgredir): Promise<ResumoComGuia> {
  const db = await obterBanco();

  // Link get.php de painel Xtream colado como M3U: vira Xtream (senha no cofre, filmes e séries organizados)
  if (nova.tipo === 'm3u' && nova.url) {
    const conta = contaDeLinkM3U(nova.url);
    if (conta) return adicionarLista({ tipo: 'xtream', nome: nova.nome, ...conta }, aoProgredir);
  }

  if (nova.tipo === 'xtream') {
    const conta: ContaXtream = {
      servidor: normalizarServidor(nova.servidor),
      usuario: nova.usuario.trim(),
      senha: nova.senha,
    };
    aoProgredir?.({ etapa: 'Conferindo usuário e senha', feitos: 0 });
    await testarConta(conta);
    const r = await db.runAsync("INSERT INTO playlist (nome, tipo, servidor, usuario) VALUES (?, 'xtream', ?, ?)", [
      nova.nome.trim() || 'Minha lista',
      conta.servidor,
      conta.usuario,
    ]);
    const id = r.lastInsertRowId;
    await cofre.salvarSenha(id, conta.senha);
    try {
      return await comGuia(id, await importarXtream(db, id, conta, aoProgredir), aoProgredir);
    } catch (e) {
      await removerLista(id);
      throw e;
    }
  }

  const texto = nova.texto ?? (await baixarTexto(nova.url ?? '', aoProgredir));
  const r = await db.runAsync("INSERT INTO playlist (nome, tipo) VALUES (?, 'm3u')", [
    nova.nome.trim() || 'Minha lista',
  ]);
  const id = r.lastInsertRowId;
  if (nova.url) await cofre.salvarUrl(id, nova.url.trim());
  try {
    return await comGuia(id, await importarTextoM3U(db, id, texto, aoProgredir), aoProgredir);
  } catch (e) {
    await removerLista(id);
    throw e;
  }
}

/** Baixa de novo e substitui o conteúdo. Favoritos e histórico continuam. */
export async function atualizarLista(p: Playlist, aoProgredir?: AoProgredir): Promise<ResumoComGuia> {
  const db = await obterBanco();
  if (p.tipo === 'xtream') {
    const senha = await cofre.senha(p.id);
    if (!senha || !p.servidor || !p.usuario)
      throw new Error('Senha desta lista não encontrada. Remova e adicione de novo.');
    return comGuia(
      p.id,
      await importarXtream(db, p.id, { servidor: p.servidor, usuario: p.usuario, senha }, aoProgredir),
      aoProgredir,
    );
  }
  const url = await cofre.url(p.id);
  if (!url) throw new Error('Esta lista veio de um arquivo. Para atualizar, adicione o arquivo novo.');
  return comGuia(p.id, await importarTextoM3U(db, p.id, await baixarTexto(url, aoProgredir), aoProgredir), aoProgredir);
}

/* ------------------------------ Guia (EPG) ------------------------------ */

export type ResumoComGuia = ResumoImportacao & { guia: ResumoEPG | null; erroGuia?: string };

/** Depois de importar a lista, tenta baixar o guia. Falha no guia não desfaz a lista. */
async function comGuia(id: number, r: ResumoImportacao, aoProgredir?: AoProgredir): Promise<ResumoComGuia> {
  try {
    aoProgredir?.({ etapa: 'Baixando guia de programação', feitos: 0 });
    return { ...r, guia: await atualizarGuia(id) };
  } catch (e) {
    return { ...r, guia: null, erroGuia: (e as Error).message };
  }
}

async function baixarBytes(url: string): Promise<Uint8Array> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 180000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`O servidor do guia respondeu ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('O guia demorou mais de 3 minutos para baixar');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Baixa e grava o guia da lista. Devolve null quando a lista não tem guia. */
export async function atualizarGuia(playlistId: number): Promise<ResumoEPG | null> {
  const db = await obterBanco();
  const p = await db.getFirstAsync<{ url_epg: string | null }>('SELECT url_epg FROM playlist WHERE id = ?', [
    playlistId,
  ]);
  if (!p?.url_epg) return null;
  const url = await urlParaTocar(p.url_epg, playlistId);
  const r = await importarEPG(db, playlistId, bytesParaTexto(await baixarBytes(url)));
  await gravarConfig(`epg_${playlistId}`, String(Date.now()));
  return r;
}

/** Ao abrir o app: atualiza em segundo plano os guias com mais de 12 horas */
export async function atualizarGuiasAntigos(): Promise<void> {
  const db = await obterBanco();
  const pls = await db.getAllAsync<{ id: number }>('SELECT id FROM playlist WHERE url_epg IS NOT NULL', []);
  for (const { id } of pls) {
    const ultima = Number((await lerConfig(`epg_${id}`)) ?? 0);
    if (Date.now() - ultima < 12 * 3600 * 1000) continue;
    await atualizarGuia(id).catch(() => {});
  }
}

/** Nome da lista e link do guia escolhidos pela pessoa */
export async function editarLista(id: number, nome: string, urlEpg: string | null) {
  const db = await obterBanco();
  await db.runAsync('UPDATE playlist SET nome = ?, url_epg = ? WHERE id = ?', [
    nome.trim() || 'Minha lista',
    urlEpg?.trim() || null,
    id,
  ]);
}

export async function removerLista(id: number) {
  const db = await obterBanco();
  await db.runAsync('DELETE FROM playlist WHERE id = ?', [id]); // categorias, canais etc. saem em cascata
  await cofre.apagar(id);
}

/** Troca o marcador {SENHA} pela senha do cofre, só na hora de tocar */
export async function urlParaTocar(url: string, playlistId: number): Promise<string> {
  if (!url.includes(MARCADOR_SENHA)) return url;
  return aplicarSenha(url, await cofre.senha(playlistId));
}

/** Séries Xtream: os episódios só são baixados quando a pessoa abre a série */
export async function carregarEpisodiosXtream(serieId: number): Promise<void> {
  const db = await obterBanco();
  const s = await db.getFirstAsync<{
    ext_id: string | null;
    servidor: string | null;
    usuario: string | null;
    playlist_id: number;
  }>(
    'SELECT s.ext_id, p.servidor, p.usuario, s.playlist_id FROM serie s JOIN playlist p ON p.id = s.playlist_id WHERE s.id = ? AND p.tipo = ?',
    [serieId, 'xtream'],
  );
  if (!s?.ext_id || !s.servidor || !s.usuario) return;
  const conta = { servidor: s.servidor, usuario: s.usuario };
  const senha = await cofre.senha(s.playlist_id);
  if (!senha) return;

  const url = `${normalizarServidor(s.servidor)}/player_api.php?username=${encodeURIComponent(s.usuario)}&password=${encodeURIComponent(
    senha,
  )}&action=get_series_info&series_id=${encodeURIComponent(s.ext_id)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`O servidor respondeu ${r.status}`);
  const dados = (await r.json()) as {
    episodes?: Record<string, { id: string; episode_num?: number; title?: string; container_extension?: string }[]>;
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM episodio WHERE serie_id = ?', [serieId]);
    for (const [temp, eps] of Object.entries(dados.episodes ?? {})) {
      for (const e of eps) {
        await db.runAsync(
          'INSERT INTO episodio (serie_id, temporada, numero, titulo, url_stream) VALUES (?, ?, ?, ?, ?)',
          [
            serieId,
            Number(temp) || 1,
            Number(e.episode_num) || 0,
            e.title || `Episódio ${e.episode_num ?? ''}`.trim(),
            urlStream(conta, 'series', e.id, e.container_extension || 'mp4'),
          ],
        );
      }
    }
  });
}
