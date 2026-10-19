/** Editar a lista: nome e link do guia de programação (EPG) */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Botao, Campo, Carregando, estilos } from '@/components/ui';
import { atualizarGuia, editarLista } from '@/lib/listas';
import { lerConfig, listas, type Playlist } from '@/lib/repo';
import { cores, espaco, raio } from '@/lib/tema';
import { MARCADOR_SENHA } from '@/lib/xtream';

export default function EditarLista() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<Playlist | null>(null);
  const [nome, setNome] = useState('');
  const [guia, setGuia] = useState('');
  const [ultima, setUltima] = useState<string | null>(null);
  const [status, setStatus] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      const pl = (await listas()).find((x) => x.id === Number(id)) ?? null;
      setP(pl);
      setNome(pl?.nome ?? '');
      setGuia(pl?.url_epg ?? '');
      setUltima(await lerConfig(`epg_${id}`));
    })().catch(() => {});
  }, [id]);

  if (!p) return <Carregando />;
  const guiaXtream = guia.includes(MARCADOR_SENHA);

  const salvarEAtualizar = async () => {
    setOcupado(true);
    setStatus({ texto: 'Baixando o guia...' });
    try {
      await editarLista(p.id, nome, guia);
      const r = await atualizarGuia(p.id);
      setUltima(String(Date.now()));
      setStatus({
        texto: r
          ? `Guia atualizado: ${r.programas.toLocaleString('pt-BR')} programas em ${r.canaisComGuia} canais` +
            (r.canaisLigadosPeloNome ? ` (${r.canaisLigadosPeloNome} ligados pelo nome).` : '.')
          : 'Dados salvos. Esta lista está sem link de guia.',
      });
    } catch (e) {
      setStatus({ texto: (e as Error).message, erro: true });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={{ padding: espaco.m }}>
      <Stack.Screen options={{ title: 'Editar lista' }} />
      <Campo rotulo="Nome da lista" value={nome} onChangeText={setNome} autoCapitalize="sentences" />
      <Campo
        rotulo="Link do guia de programação (XMLTV)"
        placeholder="http://.../guia.xml.gz"
        value={guiaXtream ? 'Guia do servidor Xtream (automático)' : guia}
        editable={!guiaXtream}
        onChangeText={setGuia}
        keyboardType="url"
        ajuda={
          guiaXtream
            ? 'Listas Xtream usam o guia do próprio servidor.'
            : 'Arquivos .xml ou .xml.gz. Muitas listas M3U já trazem o link no cabeçalho.'
        }
      />
      {guiaXtream ? (
        <View style={{ marginBottom: espaco.m }}>
          <Botao titulo="Usar outro link de guia" variante="secundario" aoTocar={() => setGuia('')} />
        </View>
      ) : null}
      <Text style={[estilos.subtitulo, { marginBottom: espaco.m }]}>
        Última atualização do guia: {ultima ? new Date(Number(ultima)).toLocaleString('pt-BR') : 'nunca'}
      </Text>
      {status ? (
        <View
          style={{ backgroundColor: cores.superficie, borderRadius: raio, padding: espaco.m, marginBottom: espaco.m }}
        >
          <Text style={{ color: status.erro ? cores.erro : cores.texto }}>{status.texto}</Text>
        </View>
      ) : null}
      <Botao
        titulo="Salvar e atualizar guia"
        icone="calendar-outline"
        aoTocar={salvarEAtualizar}
        desativado={ocupado}
      />
    </ScrollView>
  );
}
