/**
 * Cofre do sistema (Keystore no Android, Keychain no iOS).
 * Senha Xtream e link M3U (que costuma levar usuário e senha) ficam só aqui.
 */
import * as SecureStore from 'expo-secure-store';

const chaveSenha = (id: number) => `lista_${id}_senha`;
const chaveUrl = (id: number) => `lista_${id}_url`;

export const cofre = {
  salvarSenha: (id: number, senha: string) => SecureStore.setItemAsync(chaveSenha(id), senha),
  senha: (id: number) => SecureStore.getItemAsync(chaveSenha(id)),
  salvarUrl: (id: number, url: string) => SecureStore.setItemAsync(chaveUrl(id), url),
  url: (id: number) => SecureStore.getItemAsync(chaveUrl(id)),
  async apagar(id: number) {
    await SecureStore.deleteItemAsync(chaveSenha(id));
    await SecureStore.deleteItemAsync(chaveUrl(id));
  },
};
