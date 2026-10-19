/**
 * Regras do PIN do controle parental, sem depender do aparelho
 * (a função de hash é recebida de fora, assim dá para testar no computador).
 * O PIN nunca é gravado: só "sal:hash" (SHA-256).
 */
export type Sha256 = (texto: string) => Promise<string>;

export const PIN_MIN = 4;
export const PIN_MAX = 6;

export function pinValido(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);
}

export async function gerarHash(pin: string, sal: string, sha256: Sha256): Promise<string> {
  if (!pinValido(pin)) throw new Error(`O PIN precisa ter de ${PIN_MIN} a ${PIN_MAX} números`);
  return `${sal}:${await sha256(`${sal}:${pin}`)}`;
}

export async function conferirHash(pin: string, armazenado: string, sha256: Sha256): Promise<boolean> {
  const i = armazenado.indexOf(':');
  if (i < 0 || !pinValido(pin)) return false;
  const sal = armazenado.slice(0, i);
  return (await gerarHash(pin, sal, sha256)) === armazenado;
}

/** Depois de 5 erros seguidos, espera 30 s antes de aceitar nova tentativa */
export class Tentativas {
  private erros = 0;
  private bloqueadoAte = 0;
  constructor(
    private limite = 5,
    private esperaMs = 30000,
  ) {}
  segundosRestantes(agora = Date.now()): number {
    return Math.max(0, Math.ceil((this.bloqueadoAte - agora) / 1000));
  }
  registrar(acertou: boolean, agora = Date.now()) {
    if (acertou) {
      this.erros = 0;
      return;
    }
    this.erros++;
    if (this.erros >= this.limite) {
      this.erros = 0;
      this.bloqueadoAte = agora + this.esperaMs;
    }
  }
}
