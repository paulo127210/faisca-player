import { FlashList } from '@shopify/flash-list';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Campo, estilos, Miniatura, Vazio } from '@/components/ui';
import { abrirItem } from '@/lib/navegar';
import { buscar, type ItemLista } from '@/lib/repo';
import { cores, espaco } from '@/lib/tema';

const ROTULO = { live: 'Canal', filme: 'Filme', serie: 'Série' } as const;

export default function Busca() {
  const [texto, setTexto] = useState('');
  const [res, setRes] = useState<ItemLista[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      buscar(texto)
        .then(setRes)
        .catch(() => setRes([]));
    }, 250); // espera a pessoa parar de digitar
    return () => clearTimeout(t);
  }, [texto]);

  return (
    <View style={estilos.tela}>
      <View style={{ paddingHorizontal: espaco.m, paddingTop: espaco.m }}>
        <Campo
          rotulo="Canal, filme ou série"
          placeholder="Digite pelo menos 2 letras"
          value={texto}
          onChangeText={setTexto}
          autoFocus
        />
      </View>
      <FlashList
        data={res}
        keyExtractor={(i) => `${i.tipo}-${i.id}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => abrirItem(item)}
            style={() => [
              { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: espaco.m, paddingVertical: 8 },
            ]}
          >
            <Miniatura uri={item.imagem} nome={item.titulo} largura={56} altura={item.tipo === 'live' ? 36 : 80} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ color: cores.texto, fontSize: 15 }}>
                {item.titulo}
              </Text>
              <Text style={{ color: cores.textoFraco, fontSize: 12 }}>{ROTULO[item.tipo]}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={texto.trim().length >= 2 ? <Vazio icone="search-outline" titulo="Nada encontrado" /> : null}
      />
    </View>
  );
}
