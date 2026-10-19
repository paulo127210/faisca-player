import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Botao, estilos } from '@/components/ui';
import { cores, espaco, raio } from '@/lib/tema';

const passos: { icone: 'link-outline' | 'grid-outline' | 'play-circle-outline'; texto: string }[] = [
  { icone: 'link-outline', texto: 'Cole o link M3U ou os dados Xtream que o seu provedor enviou.' },
  { icone: 'grid-outline', texto: 'O app organiza tudo em Ao vivo, Filmes e Séries.' },
  { icone: 'play-circle-outline', texto: 'Escolha e assista. Seus favoritos ficam guardados.' },
];

export default function BoasVindas() {
  return (
    <SafeAreaView style={estilos.tela}>
      <ScrollView contentContainerStyle={{ padding: espaco.g, gap: espaco.g, flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View style={{ backgroundColor: cores.destaque, borderRadius: 24, padding: 18 }}>
            <Ionicons name="flash" size={44} color="#fff" />
          </View>
          <Text style={[estilos.titulo, { fontSize: 30 }]}>Faísca Player</Text>
          <Text style={[estilos.subtitulo, { textAlign: 'center' }]}>
            Um player para as suas listas de TV pela internet.
          </Text>
        </View>

        <View style={{ backgroundColor: cores.superficie, borderRadius: raio, padding: espaco.m, gap: espaco.m }}>
          {passos.map((p) => (
            <View key={p.texto} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Ionicons name={p.icone} size={24} color={cores.destaque} />
              <Text style={[estilos.subtitulo, { flex: 1, color: cores.texto }]}>{p.texto}</Text>
            </View>
          ))}
        </View>

        <Text style={[estilos.subtitulo, { fontSize: 13, textAlign: 'center' }]}>
          O Faísca não vende nem inclui canais. Ele só reproduz listas que você já tem.
        </Text>

        <Botao
          titulo="Adicionar minha lista"
          icone="add-circle-outline"
          aoTocar={() => router.push('/adicionar-lista')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
