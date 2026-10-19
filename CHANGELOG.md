# Histórico de mudanças

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
