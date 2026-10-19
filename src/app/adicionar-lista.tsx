import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Botao, Campo, Carregando, estilos } from '@/components/ui';
import type { Progresso } from '@/lib/importador';
import { adicionarLista, type NovaLista } from '@/lib/listas';
import { cores, espaco, raio } from '@/lib/tema';
import { Toque } from '@/components/Toque';

type Aba = 'link' | 'arquivo' | 'xtream';

export default function AdicionarLista() {
  const [aba, setAba] = useState<Aba>('link');
  const [nome, setNome] = useState('');
  const [url, setUrl] = useState('');
  const [servidor, setServidor] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [arquivo, setArquivo] = useState<{ nome: string; uri: string } | null>(null);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const escolherArquivo = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) setArquivo({ nome: r.assets[0].name, uri: r.assets[0].uri });
  };

  const podeSalvar =
    aba === 'link'
      ? /^https?:\/\//i.test(url.trim())
      : aba === 'arquivo'
        ? !!arquivo
        : !!(servidor && usuario && senha);

  const salvar = async () => {
    setErro(null);
    setProgresso({ etapa: 'Começando', feitos: 0 });
    try {
      let nova: NovaLista;
      if (aba === 'xtream') nova = { tipo: 'xtream', nome, servidor, usuario, senha };
      else if (aba === 'link') nova = { tipo: 'm3u', nome, url };
      else
        nova = {
          tipo: 'm3u',
          nome: nome || arquivo!.nome.replace(/\.m3u8?$/i, ''),
          texto: await new File(arquivo!.uri).text(),
        };

      const r = await adicionarLista(nova, setProgresso);
      setProgresso(null);
      if (r.live + r.filmes + r.series === 0) {
        setErro('A lista foi lida, mas não tem nenhum item. Confira o link com o seu provedor.');
        return;
      }
      if (router.canDismiss()) router.dismissAll();
      router.replace('/inicio');
    } catch (e) {
      setProgresso(null);
      setErro(traduzirErro(e as Error));
    }
  };

  if (progresso)
    return (
      <View style={estilos.tela}>
        <Carregando
          texto={`${progresso.etapa}${
            progresso.feitos
              ? `\n${progresso.feitos.toLocaleString('pt-BR')}${
                  progresso.total ? ` de ${progresso.total.toLocaleString('pt-BR')}` : ''
                } itens`
              : ''
          }`}
        />
      </View>
    );

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: espaco.m }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: cores.superficie,
            borderRadius: raio,
            padding: 4,
            marginBottom: espaco.g,
          }}
        >
          {(
            [
              ['link', 'Link M3U'],
              ['arquivo', 'Arquivo'],
              ['xtream', 'Xtream'],
            ] as [Aba, string][]
          ).map(([id, rotulo]) => (
            <Toque
              key={id}
              onPress={() => setAba(id)}
              style={() => [
                { flex: 1, paddingVertical: 10, borderRadius: raio - 4, alignItems: 'center' },
                aba === id && { backgroundColor: cores.destaque },
              ]}
            >
              <Text style={{ color: aba === id ? '#fff' : cores.textoFraco, fontWeight: '600' }}>{rotulo}</Text>
            </Toque>
          ))}
        </View>

        <Campo
          rotulo="Nome da lista (opcional)"
          placeholder="Ex.: TV da sala"
          value={nome}
          onChangeText={setNome}
          autoCapitalize="sentences"
        />

        {aba === 'link' && (
          <Campo
            rotulo="Link da lista"
            placeholder="http://..."
            value={url}
            onChangeText={setUrl}
            keyboardType="url"
            ajuda="Link que termina em .m3u, .m3u8 ou get.php. Links get.php são reconhecidos como Xtream automaticamente."
          />
        )}

        {aba === 'arquivo' && (
          <View style={{ marginBottom: espaco.m, gap: 8 }}>
            <Botao
              titulo={arquivo ? 'Trocar arquivo' : 'Escolher arquivo .m3u'}
              variante="secundario"
              icone="document-outline"
              aoTocar={escolherArquivo}
            />
            {arquivo ? <Text style={estilos.subtitulo}>Selecionado: {arquivo.nome}</Text> : null}
          </View>
        )}

        {aba === 'xtream' && (
          <>
            <Campo
              rotulo="Servidor"
              placeholder="http://servidor.com:8080"
              value={servidor}
              onChangeText={setServidor}
              keyboardType="url"
            />
            <Campo rotulo="Usuário" value={usuario} onChangeText={setUsuario} />
            <Campo
              rotulo="Senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              ajuda="A senha fica guardada só no cofre do seu aparelho."
            />
          </>
        )}

        {erro ? (
          <View style={{ backgroundColor: '#3A1517', borderRadius: raio, padding: espaco.m, marginBottom: espaco.m }}>
            <Text style={{ color: cores.erro, fontWeight: '600' }}>{erro}</Text>
          </View>
        ) : null}

        <Botao titulo="Salvar e carregar" icone="download-outline" aoTocar={salvar} desativado={!podeSalvar} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function traduzirErro(e: Error): string {
  const m = e.message || '';
  if (/network request failed|failed to fetch/i.test(m))
    return 'Não foi possível conectar. Confira o endereço e a sua internet.';
  return m || 'Algo deu errado ao carregar a lista.';
}
