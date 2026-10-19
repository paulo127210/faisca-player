# Faísca Player

Player de IPTV para Android (e futuramente iOS e Android TV). O app não vende nem inclui canais: ele só reproduz listas M3U ou Xtream que o próprio usuário cadastra.

Versão atual: **1.0.0** (etapas 1 a 6 concluídas; o player VLC reserva ficou para uma próxima versão).

## O que é necessário para funcionar

### Para testar no celular (desenvolvimento)

1. **Node.js 22 LTS ou mais novo** instalado no computador ([nodejs.org](https://nodejs.org)). Confira com `node -v`.
2. **Celular Android com o app Expo Go** instalado pela Play Store. O projeto usa o Expo SDK 58, então o Expo Go precisa estar atualizado.
3. **Computador e celular na mesma rede Wi-Fi.** Se a rede bloquear, use o modo túnel (`npx expo start --tunnel`).
4. **Uma lista para testar.** Pode ser a lista pública e legal de canais abertos do Brasil do projeto iptv-org:
   `https://iptv-org.github.io/iptv/countries/br.m3u`

### Para gerar o APK instalável

O jeito principal é automático: a cada envio para a branch `main` do GitHub, o arquivo `.github/workflows/apk-android.yml` roda os testes, compila o APK nos servidores do GitHub e publica o arquivo na página **Releases** do repositório, pronto para baixar no celular. Não precisa de conta Expo nem de Android Studio.

Também é possível gerar pela Expo (EAS):

5. **Conta gratuita na Expo** ([expo.dev](https://expo.dev)). O APK é compilado na nuvem da Expo, sem precisar do Android Studio.
6. Rodar `npx eas-cli@latest build -p android --profile preview` (o primeiro build pede login e cria o projeto na conta).

### Para publicar na Play Store

7. **Conta de desenvolvedor Google Play** (taxa única), política de privacidade publicada, ícone, capturas de tela e a declaração de que o app não fornece conteúdo.

### Para as próximas versões

8. **Projeto no Supabase** (plano gratuito) para backup e sincronização na versão 1.1.
9. **Android TV ou Fire Stick** para testar o layout de TV na etapa 6.
10. **Build de desenvolvimento** (`npx expo run:android` ou EAS) quando entrar o player VLC reserva, que não funciona dentro do Expo Go.

## Como rodar

```bash
cd faisca-player
npm install
npx expo start
```

Abra o Expo Go no celular e leia o QR Code que aparece no terminal.

Testes automáticos e verificação de tipos:

```bash
npm test            # 35 testes: leitor M3U, Xtream, importador, guia, controle parental e consultas das telas
npm run typecheck   # TypeScript sem erros
```

## O que já funciona

- Adicionar lista por **link M3U**, **arquivo .m3u** ou **Xtream Codes** (servidor, usuário e senha).
- Link `get.php` de painel Xtream colado como M3U é convertido para Xtream automaticamente.
- Importação para banco local SQLite em lotes, com tela de progresso. Testado com 50 mil canais.
- Telas: Boas-vindas, Adicionar lista, Início, Ao vivo, Filmes, Séries, Detalhe do filme, Episódios da série, Busca e Ajustes.
- Player nativo (expo-video) com reconexão automática de canal ao vivo (3 tentativas), troca de canal pelas setas, retomada de filmes de onde parou e mensagens de erro em português.
- Favoritos e "Continuar assistindo" presos a uma chave estável (tipo + nome), que sobrevive à troca de link pelo provedor.
- Atualizar, editar e remover listas em Ajustes.
- **Guia de programação (EPG)** em XMLTV, compactado (.gz) ou não. O link vem do cabeçalho da lista M3U, do servidor Xtream ou pode ser informado à mão em Ajustes > Editar.
  - Mostra o programa no ar em cada canal da lista e, no player, o atual, o próximo e a programação do dia.
  - Canais sem tvg-id são ligados ao guia pelo nome, e ids com sufixo "@HD" também são reconhecidos.
  - Só guarda de 3 horas atrás até 36 horas à frente, e só dos canais da lista. Atualiza sozinho a cada 12 horas ao abrir o app.
- **Controle parental** com PIN de 4 a 6 números.
  - Categorias com nome adulto já entram bloqueadas; as outras podem ser marcadas em Ajustes > Controle parental.
  - Com PIN, conteúdo bloqueado some de "Todos", da busca, dos favoritos e do "Continuar assistindo", e a categoria pede o PIN para abrir.
  - O desbloqueio vale até fechar o app ou tocar em "Bloquear agora". Depois de 5 PINs errados, espera 30 segundos.
  - As escolhas de bloqueio continuam depois de atualizar a lista.

- **Android TV, Google TV e Fire Stick:** o APK aparece no menu da TV, não exige tela de toque e todos os botões e listas mostram destaque quando recebem foco do controle remoto.
- Ícone próprio (faísca branca em fundo laranja).

## Segurança

- Senha Xtream e link M3U ficam só no cofre do sistema (expo-secure-store: Keystore no Android, Keychain no iOS).
- No banco, as URLs de canais Xtream guardam o marcador `{SENHA}`, trocado pela senha real apenas na hora de tocar.
- O PIN do controle parental nunca é gravado: só um hash SHA-256 com sal aleatório.
- O app não envia nenhum dado de uso para fora do aparelho.

## Estrutura

```
src/
  app/                 telas (Expo Router: cada arquivo é uma rota)
    (abas)/            Início, Ao vivo, Filmes, Séries, Ajustes
    adicionar-lista.tsx, boas-vindas.tsx, busca.tsx, player.tsx, parental.tsx
    lista/[id].tsx     editar nome da lista e link do guia
    filme/[id].tsx, serie/[id].tsx
  components/          botões, campos, miniaturas, grade de capas
  lib/
    m3u.ts             leitor de listas M3U
    xtream.ts          cliente da API Xtream Codes
    banco.ts           esquema do banco e migrações (versão 2)
    epg.ts             leitor do guia XMLTV e gravação no banco
    pin.ts, parental.ts  regras do PIN e controle parental
    importador.ts      grava a lista no banco em lotes
    listas.ts          adicionar, atualizar, remover lista
    repo.ts            consultas das telas
    seguro.ts          cofre do sistema
tests/                 testes automáticos (Vitest)
```

## Próximas etapas

- Player VLC reserva para formatos que o nativo não abre (RTMP, UDP). Exige build de desenvolvimento.
- Versão 1.1: perfis, backup na nuvem (Supabase) e guia em grade completa.

O histórico de mudanças está em `CHANGELOG.md`.
