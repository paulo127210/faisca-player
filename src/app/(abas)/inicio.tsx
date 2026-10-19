import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { Botao, estilos, Miniatura, Vazio } from '@/components/ui';
import { abrirItem } from '@/lib/navegar';
import { continuarAssistindo, favoritos, listas, type ItemLista, type Playlist } from '@/lib/repo';
import { cores, espaco } from '@/lib/tema';
import { Toque } from '@/components/Toque';

function Linha({ titulo, itens }: { titulo: string; itens: ItemLista[] }) {
  if (itens.length === 0) return null;
  return (
    <View style={{ marginBottom: espaco.g }}>
      <Text style={[estilos.secao, { paddingHorizontal: espaco.m }]}>{titulo}</Text>
      <FlatList
        horizontal
        data={itens}
        keyExtractor={(i) => i.chave}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: espaco.m, gap: 12 }}
        renderItem={({ item }) => {
          const poster = item.tipo !== 'live';
          const w = poster ? 110 : 140;
          return (
            <Toque onPress={() => abrirItem(item)} style={() => [{ width: w }]}>
              <Miniatura uri={item.imagem} nome={item.titulo} largura={w} altura={poster ? 165 : 80} />
              {item.progresso ? (
                <View style={{ height: 3, backgroundColor: cores.borda, marginTop: 4 }}>
                  <View
                    style={{
                      height: 3,
                      width: `${Math.round(item.progresso * 100)}%`,
                      backgroundColor: cores.destaque,
                    }}
                  />
                </View>
              ) : null}
              <Text numberOfLines={2} style={{ color: cores.texto, fontSize: 12, marginTop: 4 }}>
                {item.titulo}
              </Text>
            </Toque>
          );
        }}
      />
    </View>
  );
}

export default function Inicio() {
  const [cont, setCont] = useState<ItemLista[]>([]);
  const [favs, setFavs] = useState<ItemLista[]>([]);
  const [pls, setPls] = useState<Playlist[]>([]);

  useFocusEffect(
    useCallback(() => {
      continuarAssistindo()
        .then(setCont)
        .catch(() => {});
      favoritos()
        .then(setFavs)
        .catch(() => {});
      listas()
        .then(setPls)
        .catch(() => {});
    }, []),
  );

  const totais = pls.reduce(
    (t, p) => ({ live: t.live + p.total_live, filmes: t.filmes + p.total_filmes, series: t.series + p.total_series }),
    { live: 0, filmes: 0, series: 0 },
  );

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={{ paddingVertical: espaco.m }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: espaco.m, marginBottom: espaco.g }}>
        {(
          [
            ['Ao vivo', totais.live, '/ao-vivo'],
            ['Filmes', totais.filmes, '/filmes'],
            ['Séries', totais.series, '/series'],
          ] as const
        ).map(([rotulo, n, rota]) => (
          <Toque
            key={rota}
            onPress={() => router.navigate(rota)}
            style={() => [{ flex: 1, backgroundColor: cores.superficie, borderRadius: 12, padding: 14 }]}
          >
            <Text style={{ color: cores.destaque, fontSize: 20, fontWeight: '700' }}>{n.toLocaleString('pt-BR')}</Text>
            <Text style={{ color: cores.textoFraco }}>{rotulo}</Text>
          </Toque>
        ))}
      </View>

      <Linha titulo="Continuar assistindo" itens={cont} />
      <Linha titulo="Favoritos" itens={favs} />

      {cont.length === 0 && favs.length === 0 ? (
        <Vazio
          icone="star-outline"
          titulo="Tudo pronto"
          texto="Os canais e filmes que você assistir ou marcar com estrela aparecem aqui."
        >
          <Botao titulo="Ver canais ao vivo" icone="tv-outline" aoTocar={() => router.navigate('/ao-vivo')} />
        </Vazio>
      ) : null}
    </ScrollView>
  );
}
