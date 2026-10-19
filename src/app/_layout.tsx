import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Botao, Carregando, estilos } from '@/components/ui';
import { obterBanco } from '@/lib/db';
import { cores } from '@/lib/tema';

const tema = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: cores.fundo,
    card: cores.fundo,
    primary: cores.destaque,
    text: cores.texto,
    border: cores.borda,
  },
};

export default function Raiz() {
  const [estado, setEstado] = useState<'abrindo' | 'pronto' | string>('abrindo');

  const abrir = () => {
    setEstado('abrindo');
    obterBanco()
      .then(() => setEstado('pronto'))
      .catch((e: Error) => setEstado(e.message || 'Erro ao abrir o banco'));
  };
  useEffect(abrir, []);

  if (estado !== 'pronto')
    return (
      <View style={[estilos.tela, { justifyContent: 'center', padding: 24 }]}>
        <StatusBar style="light" />
        {estado === 'abrindo' ? (
          <Carregando />
        ) : (
          <View style={{ gap: 16 }}>
            <Text style={estilos.titulo}>Não foi possível abrir os dados do app</Text>
            <Text style={estilos.subtitulo}>{estado}</Text>
            <Botao titulo="Tentar de novo" aoTocar={abrir} />
          </View>
        )}
      </View>
    );

  return (
    <ThemeProvider value={tema}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerTintColor: cores.texto,
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="boas-vindas" options={{ headerShown: false }} />
        <Stack.Screen name="(abas)" options={{ headerShown: false }} />
        <Stack.Screen name="adicionar-lista" options={{ title: 'Adicionar lista', presentation: 'modal' }} />
        <Stack.Screen name="busca" options={{ title: 'Buscar' }} />
        <Stack.Screen name="filme/[id]" options={{ title: '' }} />
        <Stack.Screen name="serie/[id]" options={{ title: '' }} />
        <Stack.Screen name="player" options={{ headerShown: false, animation: 'fade', orientation: 'landscape' }} />
      </Stack>
    </ThemeProvider>
  );
}
