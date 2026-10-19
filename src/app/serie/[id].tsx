import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { Botao, Carregando, estilos, Miniatura, Vazio } from '@/components/ui';
import { carregarEpisodiosXtream } from '@/lib/listas';
import { alternarFavorito, ehFavorito, episodios, serie, type Episodio, type Serie } from '@/lib/repo';
import { cores, espaco } from '@/lib/tema';
import { Toque } from '@/components/Toque';

export default function DetalheSerie() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<Serie | null>(null);
  const [eps, setEps] = useState<Episodio[] | null>(null);
  const [fav, setFav] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sid = Number(id);
      const dados = await serie(sid);
      setS(dados);
      if (!dados) return;
      setFav(await ehFavorito(dados.chave));
      let lista = await episodios(sid);
      if (lista.length === 0 && dados.ext_id) {
        // Xtream: episódios vêm do servidor na primeira vez que a série é aberta
        await carregarEpisodiosXtream(sid);
        lista = await episodios(sid);
      }
      setEps(lista);
    })().catch((e: Error) => {
      setErro(e.message);
      setEps([]);
    });
  }, [id]);

  const secoes = useMemo(() => {
    const m = new Map<number, Episodio[]>();
    for (const e of eps ?? []) m.set(e.temporada, [...(m.get(e.temporada) ?? []), e]);
    return [...m.entries()].map(([t, data]) => ({ title: `Temporada ${t}`, data }));
  }, [eps]);

  if (!s) return <Carregando />;

  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ title: s.titulo }} />
      <SectionList
        sections={secoes}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ padding: espaco.m, paddingBottom: espaco.g }}
        ListHeaderComponent={
          <View style={{ gap: espaco.m, marginBottom: espaco.m }}>
            <View style={{ flexDirection: 'row', gap: espaco.m }}>
              <Miniatura uri={s.capa} nome={s.titulo} largura={110} altura={165} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={estilos.titulo}>{s.titulo}</Text>
                {s.ano ? <Text style={estilos.subtitulo}>{s.ano}</Text> : null}
              </View>
            </View>
            <Botao
              titulo={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              variante="secundario"
              icone={fav ? 'star' : 'star-outline'}
              aoTocar={async () => setFav(await alternarFavorito(s.chave, 'serie'))}
            />
            {s.sinopse ? <Text style={[estilos.subtitulo, { color: cores.texto }]}>{s.sinopse}</Text> : null}
            {eps === null ? <Carregando texto="Carregando episódios" /> : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[estilos.secao, { marginTop: espaco.m }]}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Toque
            onPress={() => router.push({ pathname: '/player', params: { tipo: 'episodio', id: String(item.id) } })}
            style={({ pressed }) => [
              { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: cores.borda, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ color: cores.texto, fontSize: 15 }} numberOfLines={2}>
              {item.numero > 0 ? `${item.numero}. ` : ''}
              {item.titulo}
            </Text>
          </Toque>
        )}
        ListEmptyComponent={
          eps !== null ? (
            <Vazio
              icone="albums-outline"
              titulo="Sem episódios"
              texto={erro ?? 'O provedor não enviou episódios desta série.'}
            />
          ) : undefined
        }
      />
    </View>
  );
}
