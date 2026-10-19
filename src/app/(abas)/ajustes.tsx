import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Botao, Carregando, estilos } from '@/components/ui';
import type { Progresso } from '@/lib/importador';
import { atualizarLista, removerLista } from '@/lib/listas';
import { listas, type Playlist } from '@/lib/repo';
import { cores, espaco, raio } from '@/lib/tema';

export default function Ajustes() {
  const [pls, setPls] = useState<Playlist[]>([]);
  const [progresso, setProgresso] = useState<Progresso | null>(null);

  const recarregar = useCallback(() => {
    listas()
      .then(setPls)
      .catch(() => {});
  }, []);
  useFocusEffect(recarregar);

  const atualizar = async (p: Playlist) => {
    setProgresso({ etapa: 'Começando', feitos: 0 });
    try {
      const r = await atualizarLista(p, setProgresso);
      Alert.alert('Lista atualizada', `${r.live} canais, ${r.filmes} filmes e ${r.series} séries.`);
    } catch (e) {
      Alert.alert('Não foi possível atualizar', (e as Error).message);
    } finally {
      setProgresso(null);
      recarregar();
    }
  };

  const remover = (p: Playlist) =>
    Alert.alert('Remover lista', `Remover "${p.nome}" deste aparelho? Favoritos e histórico continuam guardados.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await removerLista(p.id);
          const restantes = await listas();
          if (restantes.length === 0) router.replace('/boas-vindas');
          else setPls(restantes);
        },
      },
    ]);

  if (progresso)
    return (
      <View style={estilos.tela}>
        <Carregando
          texto={`${progresso.etapa}${progresso.feitos ? `\n${progresso.feitos.toLocaleString('pt-BR')} itens` : ''}`}
        />
      </View>
    );

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={{ padding: espaco.m, gap: espaco.m }}>
      <Text style={estilos.secao}>Minhas listas</Text>
      {pls.map((p) => (
        <View key={p.id} style={{ backgroundColor: cores.superficie, borderRadius: raio, padding: espaco.m, gap: 10 }}>
          <Text style={{ color: cores.texto, fontSize: 17, fontWeight: '700' }}>{p.nome}</Text>
          <Text style={estilos.subtitulo}>
            {p.tipo === 'xtream' ? `Xtream · ${p.usuario}` : 'M3U'} · {p.total_live} canais · {p.total_filmes} filmes ·{' '}
            {p.total_series} séries
          </Text>
          <Text style={[estilos.subtitulo, { fontSize: 12 }]}>
            Atualizada em{' '}
            {p.atualizada_em ? new Date(`${p.atualizada_em.replace(' ', 'T')}Z`).toLocaleString('pt-BR') : 'nunca'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Botao titulo="Atualizar" variante="secundario" icone="refresh" aoTocar={() => atualizar(p)} />
            </View>
            <View style={{ flex: 1 }}>
              <Botao titulo="Remover" variante="perigo" icone="trash-outline" aoTocar={() => remover(p)} />
            </View>
          </View>
        </View>
      ))}
      <Botao
        titulo="Adicionar outra lista"
        icone="add-circle-outline"
        aoTocar={() => router.push('/adicionar-lista')}
      />

      <Text style={[estilos.subtitulo, { fontSize: 12, textAlign: 'center', marginTop: espaco.g }]}>
        Faísca Player 0.1 · o app não fornece canais, apenas reproduz as suas listas.
      </Text>
    </ScrollView>
  );
}
