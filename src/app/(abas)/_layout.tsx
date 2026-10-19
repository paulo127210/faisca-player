import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable } from 'react-native';
import { cores } from '@/lib/tema';

const botaoBusca = () => (
  <Pressable onPress={() => router.push('/busca')} hitSlop={12} style={{ marginRight: 16 }} accessibilityLabel="Buscar">
    <Ionicons name="search" size={22} color={cores.texto} />
  </Pressable>
);

export default function Abas() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.fundo },
        headerTintColor: cores.texto,
        headerRight: botaoBusca,
        tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.borda },
        tabBarActiveTintColor: cores.destaque,
        tabBarInactiveTintColor: cores.textoFraco,
      }}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ao-vivo"
        options={{
          title: 'Ao vivo',
          tabBarIcon: ({ color, size }) => <Ionicons name="tv" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="filmes"
        options={{
          title: 'Filmes',
          tabBarIcon: ({ color, size }) => <Ionicons name="film" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: 'Séries',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
