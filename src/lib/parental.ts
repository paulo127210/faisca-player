/**
 * Controle parental. Sem PIN definido, nada fica bloqueado.
 * Com PIN, categorias marcadas como bloqueadas somem de "Todos", da busca,
 * dos favoritos e do "Continuar assistindo", e só abrem depois do PIN.
 * O desbloqueio vale até o app ser fechado ou a pessoa bloquear de novo.
 */
import * as Crypto from 'expo-crypto';
import { obterBanco } from './db';
import { conferirHash, gerarHash, Tentativas } from './pin';

const sha256 = (t: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, t);
const tentativas = new Tentativas();

let hashCache: string | null | undefined; // undefined = ainda não lido
let liberado = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export function aoMudar(f: () => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

async function hashAtual(): Promise<string | null> {
  if (hashCache === undefined) {
    const db = await obterBanco();
    const r = await db.getFirstAsync<{ pin_hash: string | null }>('SELECT pin_hash FROM perfil WHERE id = 1', []);
    hashCache = r?.pin_hash ?? null;
  }
  return hashCache;
}

export async function temPin(): Promise<boolean> {
  return (await hashAtual()) !== null;
}

/** true quando o conteúdo bloqueado deve ficar escondido agora */
export async function esconderBloqueados(): Promise<boolean> {
  return !liberado && (await temPin());
}

export function estaLiberado() {
  return liberado;
}

export async function desbloquear(pin: string): Promise<{ ok: boolean; mensagem?: string }> {
  const espera = tentativas.segundosRestantes();
  if (espera > 0) return { ok: false, mensagem: `Muitas tentativas. Aguarde ${espera} s.` };
  const h = await hashAtual();
  const ok = h === null || (await conferirHash(pin, h, sha256));
  tentativas.registrar(ok);
  if (ok) {
    liberado = true;
    avisar();
    return { ok };
  }
  return { ok, mensagem: 'PIN incorreto.' };
}

export function bloquearDeNovo() {
  liberado = false;
  avisar();
}

export async function definirPin(novo: string, atual?: string): Promise<void> {
  const h = await hashAtual();
  if (h !== null && !(atual && (await conferirHash(atual, h, sha256)))) throw new Error('PIN atual incorreto.');
  const novoHash = await gerarHash(novo, Crypto.randomUUID(), sha256);
  const db = await obterBanco();
  await db.runAsync('UPDATE perfil SET pin_hash = ? WHERE id = 1', [novoHash]);
  hashCache = novoHash;
  liberado = false;
  avisar();
}

export async function removerPin(atual: string): Promise<void> {
  const h = await hashAtual();
  if (h !== null && !(await conferirHash(atual, h, sha256))) throw new Error('PIN incorreto.');
  const db = await obterBanco();
  await db.runAsync('UPDATE perfil SET pin_hash = NULL WHERE id = 1', []);
  hashCache = null;
  liberado = false;
  avisar();
}

export async function marcarCategoria(id: number, bloqueada: boolean) {
  const db = await obterBanco();
  await db.runAsync('UPDATE categoria SET bloqueada = ? WHERE id = ?', [bloqueada ? 1 : 0, id]);
  avisar();
}
