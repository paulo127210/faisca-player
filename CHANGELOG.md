# Histórico de mudanças

## 1.0.0 (19/10/2026)

Etapa 6: TV e APK.

- Suporte a Android TV, Google TV e Fire Stick: plugin `plugins/withAndroidTV.js` registra o app no menu da TV (LEANBACK_LAUNCHER) e marca tela de toque como opcional.
- Novo componente `Toque`: botões, categorias, canais e capas ganham destaque laranja quando recebem foco do controle remoto.
- Ícone próprio do app (faísca branca em fundo laranja) e ícone adaptativo do Android.
- Compilação automática do APK no GitHub Actions (`.github/workflows/apk-android.yml`), com testes antes do build e publicação na página Releases.
- APK gerado para armeabi-v7a e arm64-v8a, que cobrem celulares e TV boxes.
- Segunda compilação pela Expo (EAS Build) na conta paulo127210, com o fluxo `apk-expo.yml`; precisa do segredo EXPO_TOKEN no GitHub.
- O player VLC reserva foi adiado: o player nativo já abre HLS, TS e MP4, que são a grande maioria das listas.

## 0.2.0 (19/10/2026)

Etapa 5: guia de programação e controle parental.

- Guia de programação (EPG) em XMLTV e XMLTV compactado (.gz), lido com a biblioteca fflate.
- Programa no ar na lista de canais; atual, próximo e grade do dia no player.
- Canais sem tvg-id ligados ao guia pelo nome; ids com sufixo "@HD/@SD" reconhecidos.
- Guia atualizado depois de importar a lista e, ao abrir o app, quando tem mais de 12 horas.
- Nova tela Editar lista (nome e link do guia).
- Controle parental com PIN (hash SHA-256 com sal, via expo-crypto), bloqueio por categoria, trava de 30 s após 5 erros.
- Categorias com nome adulto entram bloqueadas; escolhas de bloqueio e de categorias ocultas são mantidas ao atualizar a lista.
- Banco na versão 2: coluna `categoria.bloqueada`, coluna `programa_epg.playlist_id` e novos índices. Quem já tinha a 0.1.0 é migrado sozinho.
- Link de guia escolhido pela pessoa não é mais substituído pelo do cabeçalho ao atualizar a lista.
- 35 testes automáticos (eram 18), incluindo as consultas reais das telas.

## 0.1.0 (19/10/2026)

Primeira versão do código.

- Projeto Expo SDK 58 com TypeScript e Expo Router.
- Banco local SQLite com tabelas playlist, categoria, canal, filme, serie, episodio, programa_epg, perfil, favorito, historico e config.
- Leitor M3U e cliente Xtream Codes, com importação em lotes e progresso.
- Telas de navegação, busca, detalhes e player com reconexão automática.
- 18 testes automáticos, incluindo importação de 50 mil canais e da lista real do iptv-org.

### Ajustes em relação ao documento de projeto

- Player principal: **expo-video** no lugar de react-native-video. Faz o mesmo (ExoPlayer e AVPlayer) e funciona dentro do Expo Go, o que permite testar no celular sem compilar.
- Busca: coluna `nome_busca` normalizada (sem acento, minúscula) com índice, no lugar do FTS5. Mais simples e rápida o bastante para 50 mil itens.
- Chave estável de favoritos: tipo + nome normalizado (sem HD, FHD, 4K e marcações entre colchetes), em vez de nome + categoria. Assim o favorito também sobrevive quando o provedor muda o canal de categoria.
