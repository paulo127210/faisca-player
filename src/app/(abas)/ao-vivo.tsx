import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Carregando, Chips, estilos, Miniatura, Vazio } from '@/components/ui';
import { alternarFavorito, canais, categorias, favoritos, type Canal, type Categoria } from '@/lib/repo';
import { cores, espaco } from '@/lib/tema';

export default function AoVivo() {
  const [cats, setCats] = useState<Categoria[] | null>(null);
  const [ativa, setAtiva] = useState<number | null>(null);
  const [lista, setLista] = useState<Canal[] | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      categorias('live')
        .then(setCats)
        .catch(() => setCats([]));
      favoritos()
        .then((f) => setFavs(new Set(f.map((x) => x.chave))))
        .catch(() => {});
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      setLista(null);
      canais(ativa)
        .then((r) => vivo && setLista(r))
        .catch(() => vivo && setLista([]));
      return () => {
        vivo = false;
      };
    }, [ativa]),
  );

  const favoritar = async (c: Canal) => {
    const agora = await alternarFavorito(c.chave, 'live');
    setFavs((s) => {
      const n = new Set(s);
      if (agora) n.add(c.chave);
      else n.delete(c.chave);
      return n;
    });
  };

  if (cats && cats.length === 0)
    return (
      <View style={estilos.tela}>
        <Vazio icone="tv-outline" titulo="Nenhum canal ao vivo" texto="Adicione ou atualize uma lista em Ajustes." />
      </View>
    );

  return (
    <View style={estilos.tela}>
      <Chips itens={[{ id: null, nome: 'Todos' }, ...(cats ?? [])]} ativo={ativa} aoEscolher={setAtiva} />
      {lista === null ? (
        <Carregando />
      ) : (
        <FlashList
          data={lista}
          keyExtractor={(c) => String(c.id)}
          extraData={favs}
          contentContainerStyle={{ paddingBottom: espaco.g }}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/player', params: { tipo: 'live', id: String(item.id) } })}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: espaco.m,
                  paddingVertical: 10,
                  backgroundColor: pressed ? cores.superficie : 'transparent',
                },
              ]}
            >
              <Text style={{ color: cores.textoFraco, width: 36, textAlign: 'right', fontSize: 13 }}>
                {item.numero ?? index + 1}
              </Text>
              <Miniatura uri={item.logo} nome={item.nome} largura={64} altura={40} />
              <Text numberOfLines={1} style={{ color: cores.texto, fontSize: 15, flex: 1 }}>
                {item.nome}
              </Text>
              <Pressable onPress={() => favoritar(item)} hitSlop={10} accessibilityLabel="Favoritar">
                <Ionicons
                  name={favs.has(item.chave) ? 'star' : 'star-outline'}
                  size={22}
                  color={favs.has(item.chave) ? cores.destaque : cores.textoFraco}
                />
              </Pressable>
            </Pressable>
          )}
          ListEmptyComponent={<Vazio icone="search-outline" titulo="Nada nesta categoria" />}
        />
      )}
    </View>
  );
}
