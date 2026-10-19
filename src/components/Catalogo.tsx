/** Grade de capas com filtro por categoria (usada em Filmes e Séries) */
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { categorias, filmes, series, type Categoria, type Filme } from '@/lib/repo';
import { cores, espaco } from '@/lib/tema';
import { estaLiberado } from '@/lib/parental';
import { useCategoriaProtegida } from './Pin';
import { Carregando, Chips, estilos, Miniatura, Vazio } from './ui';

export function Catalogo({ tipo }: { tipo: 'filme' | 'serie' }) {
  const { width } = useWindowDimensions();
  const colunas = width >= 900 ? 6 : width >= 600 ? 4 : 3;
  const larguraCapa = (width - espaco.m * 2 - espaco.p * (colunas - 1)) / colunas;

  const [cats, setCats] = useState<Categoria[] | null>(null);
  const [ativa, setAtiva] = useState<number | null>(null);
  const [itens, setItens] = useState<Filme[] | null>(null);
  const { escolher, janela, versao } = useCategoriaProtegida(setAtiva);

  useFocusEffect(
    useCallback(() => {
      categorias(tipo)
        .then(setCats)
        .catch(() => setCats([]));
      if (versao && !estaLiberado()) setAtiva(null); // bloquearam de novo: volta para "Todos"
    }, [tipo, versao]),
  );

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      setItens(null);
      (tipo === 'filme' ? filmes(ativa) : series(ativa))
        .then((r) => vivo && setItens(r))
        .catch(() => vivo && setItens([]));
      return () => {
        vivo = false;
      };
    }, [tipo, ativa, versao]),
  );

  if (cats && cats.length === 0)
    return (
      <View style={estilos.tela}>
        <Vazio
          icone={tipo === 'filme' ? 'film-outline' : 'albums-outline'}
          titulo={tipo === 'filme' ? 'Nenhum filme nesta lista' : 'Nenhuma série nesta lista'}
          texto="Se o seu provedor oferece esse conteúdo, atualize a lista em Ajustes."
        />
      </View>
    );

  return (
    <View style={estilos.tela}>
      {janela}
      <Chips itens={[{ id: null, nome: 'Todos' }, ...(cats ?? [])]} ativo={ativa} aoEscolher={escolher} />
      {itens === null ? (
        <Carregando />
      ) : (
        <FlashList
          data={itens}
          numColumns={colunas}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ paddingHorizontal: espaco.m, paddingBottom: espaco.g }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(tipo === 'filme' ? `/filme/${item.id}` : `/serie/${item.id}`)}
              style={() => [{ width: larguraCapa, marginBottom: espaco.m }]}
            >
              <Miniatura uri={item.capa} nome={item.titulo} largura={larguraCapa} altura={larguraCapa * 1.5} />
              <Text numberOfLines={2} style={{ color: cores.texto, fontSize: 12, marginTop: 4 }}>
                {item.titulo}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Vazio icone="search-outline" titulo="Nada nesta categoria" />}
        />
      )}
    </View>
  );
}
