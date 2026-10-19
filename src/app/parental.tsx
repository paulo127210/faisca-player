/** Controle parental: criar, trocar e remover o PIN; escolher categorias bloqueadas */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, SectionList, Switch, Text, View } from 'react-native';
import { JanelaPin } from '@/components/Pin';
import { Botao, Campo, Carregando, estilos } from '@/components/ui';
import { bloquearDeNovo, definirPin, estaLiberado, marcarCategoria, removerPin, temPin } from '@/lib/parental';
import { pinValido } from '@/lib/pin';
import { todasCategorias, type Categoria } from '@/lib/repo';
import type { TipoConteudo } from '@/lib/texto';
import { cores, espaco, raio } from '@/lib/tema';

const NOME_TIPO: Record<TipoConteudo, string> = { live: 'Ao vivo', filme: 'Filmes', serie: 'Séries' };

export default function Parental() {
  const [comPin, setComPin] = useState<boolean | null>(null);
  const [liberado, setLiberado] = useState(estaLiberado());
  const [cats, setCats] = useState<(Categoria & { tipo: TipoConteudo })[]>([]);
  const [modo, setModo] = useState<'ver' | 'criar' | 'trocar'>('ver');
  const [atual, setAtual] = useState('');
  const [novo, setNovo] = useState('');
  const [repetir, setRepetir] = useState('');

  const carregar = useCallback(async () => {
    setComPin(await temPin());
    setLiberado(estaLiberado());
    setCats(await todasCategorias());
  }, []);
  useEffect(() => {
    carregar().catch(() => {});
  }, [carregar]);

  const salvarPin = async () => {
    if (!pinValido(novo)) return Alert.alert('PIN inválido', 'Use de 4 a 6 números.');
    if (novo !== repetir) return Alert.alert('Os PINs não conferem', 'Digite o mesmo PIN nos dois campos.');
    try {
      await definirPin(novo, comPin ? atual : undefined);
      setModo('ver');
      setAtual('');
      setNovo('');
      setRepetir('');
      Alert.alert('PIN salvo', 'As categorias com cadeado agora pedem o PIN para abrir.');
      await carregar();
    } catch (e) {
      Alert.alert('Não foi possível salvar', (e as Error).message);
    }
  };

  const apagarPin = async () => {
    try {
      await removerPin(atual);
      setAtual('');
      setModo('ver');
      await carregar();
    } catch (e) {
      Alert.alert('Não foi possível remover', (e as Error).message);
    }
  };

  if (comPin === null) return <Carregando />;

  // com PIN e bloqueado: pede o PIN antes de mostrar qualquer ajuste
  if (comPin && !liberado)
    return (
      <View style={estilos.tela}>
        <JanelaPin
          visivel
          titulo="PIN do controle parental"
          aoFechar={() => router.back()}
          aoLiberar={() => setLiberado(true)}
        />
      </View>
    );

  if (modo !== 'ver')
    return (
      <View style={[estilos.tela, { padding: espaco.m }]}>
        {modo === 'trocar' ? (
          <Campo rotulo="PIN atual" value={atual} onChangeText={setAtual} keyboardType="number-pad" secureTextEntry />
        ) : null}
        <Campo
          rotulo="Novo PIN (4 a 6 números)"
          value={novo}
          onChangeText={setNovo}
          keyboardType="number-pad"
          secureTextEntry
        />
        <Campo
          rotulo="Repita o novo PIN"
          value={repetir}
          onChangeText={setRepetir}
          keyboardType="number-pad"
          secureTextEntry
        />
        <View style={{ gap: 8 }}>
          <Botao titulo="Salvar PIN" icone="checkmark" aoTocar={salvarPin} />
          <Botao titulo="Cancelar" variante="secundario" aoTocar={() => setModo('ver')} />
        </View>
      </View>
    );

  const secoes = (['live', 'filme', 'serie'] as TipoConteudo[])
    .map((t) => ({ title: NOME_TIPO[t], data: cats.filter((c) => c.tipo === t) }))
    .filter((s) => s.data.length > 0);

  return (
    <SectionList
      style={estilos.tela}
      sections={secoes}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={{ padding: espaco.m, paddingBottom: espaco.g }}
      ListHeaderComponent={
        <View style={{ gap: espaco.m, marginBottom: espaco.m }}>
          <View style={{ backgroundColor: cores.superficie, borderRadius: raio, padding: espaco.m, gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Ionicons
                name={comPin ? 'shield-checkmark' : 'shield-outline'}
                size={24}
                color={comPin ? cores.ok : cores.textoFraco}
              />
              <Text style={{ color: cores.texto, fontSize: 16, fontWeight: '700', flex: 1 }}>
                {comPin ? 'Controle parental ativo' : 'Controle parental desligado'}
              </Text>
            </View>
            <Text style={estilos.subtitulo}>
              {comPin
                ? 'As categorias marcadas abaixo só abrem com o PIN. O desbloqueio vale até você fechar o app ou tocar em "Bloquear agora".'
                : 'Crie um PIN para esconder as categorias marcadas abaixo. Categorias com nome adulto já vêm marcadas.'}
            </Text>
            {comPin ? (
              <View style={{ gap: 8 }}>
                <Botao
                  titulo="Bloquear agora"
                  icone="lock-closed"
                  aoTocar={() => {
                    bloquearDeNovo();
                    router.back();
                  }}
                />
                <Botao titulo="Trocar PIN" variante="secundario" aoTocar={() => setModo('trocar')} />
                <Campo
                  rotulo="Para remover o PIN, digite-o aqui"
                  value={atual}
                  onChangeText={setAtual}
                  keyboardType="number-pad"
                  secureTextEntry
                />
                <Botao titulo="Remover PIN" variante="perigo" aoTocar={apagarPin} desativado={atual.length < 4} />
              </View>
            ) : (
              <Botao titulo="Criar PIN" icone="key-outline" aoTocar={() => setModo('criar')} />
            )}
          </View>
          <Text style={estilos.secao}>Categorias bloqueadas</Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={[estilos.subtitulo, { fontWeight: '700', marginTop: espaco.m, marginBottom: 4 }]}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: cores.borda,
          }}
        >
          <Text numberOfLines={1} style={{ color: cores.texto, flex: 1, fontSize: 15 }}>
            {item.nome}
          </Text>
          <Switch
            value={!!item.bloqueada}
            onValueChange={async (v) => {
              setCats((l) => l.map((c) => (c.id === item.id ? { ...c, bloqueada: v ? 1 : 0 } : c)));
              await marcarCategoria(item.id, v);
            }}
            trackColor={{ true: cores.destaque, false: cores.borda }}
            thumbColor="#fff"
          />
        </View>
      )}
      ListEmptyComponent={<Text style={estilos.subtitulo}>Nenhuma categoria ainda. Adicione uma lista primeiro.</Text>}
    />
  );
}
