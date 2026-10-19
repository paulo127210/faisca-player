/**
 * Player. Usa o reprodutor nativo (ExoPlayer no Android, AVPlayer no iOS).
 * Ao vivo: reconecta sozinho até 3 vezes e troca de canal sem sair da tela.
 * Filmes e episódios: retoma de onde parou e salva o progresso a cada 10 s.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Botao } from '@/components/ui';
import { urlParaTocar } from '@/lib/listas';
import { canalVizinho, itemTocavel, posicaoSalva, registrarHistorico, type ItemTocavel } from '@/lib/repo';
import { cores } from '@/lib/tema';

const MAX_TENTATIVAS = 3;

export default function Player() {
  const { tipo, id } = useLocalSearchParams<{ tipo: 'live' | 'filme' | 'episodio'; id: string }>();
  const [item, setItem] = useState<ItemTocavel | null>(null);
  const [fonte, setFonte] = useState<{ uri: string; contentType: 'hls' | 'auto' } | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'tocando' | 'reconectando' | 'erro'>('carregando');
  const [erro, setErro] = useState('');
  const tentativas = useRef(0);
  const retomarEm = useRef(0);
  const ehAoVivo = tipo === 'live';

  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = 10; // dispara timeUpdate a cada 10 s para salvar o progresso
  });

  // carrega o item sempre que o canal muda
  useEffect(() => {
    let vivo = true;
    (async () => {
      setEstado('carregando');
      tentativas.current = 0;
      const it = await itemTocavel(tipo, Number(id));
      if (!vivo) return;
      if (!it) {
        setErro('Este conteúdo não existe mais na lista.');
        setEstado('erro');
        return;
      }
      setItem(it);
      retomarEm.current = ehAoVivo ? 0 : await posicaoSalva(it.chave);
      const uri = await urlParaTocar(it.url, it.playlist_id);
      if (!vivo) return;
      setFonte({ uri, contentType: /\.m3u8(\?|$)/i.test(uri) ? 'hls' : 'auto' });
      if (ehAoVivo) registrarHistorico(it.chave, 'live', it.titulo, 0, 0).catch(() => {});
    })().catch((e: Error) => {
      setErro(e.message);
      setEstado('erro');
    });
    return () => {
      vivo = false;
    };
  }, [tipo, id, ehAoVivo]);

  const iniciar = useCallback(async () => {
    if (!fonte) return;
    await player.replaceAsync(fonte);
    player.play();
  }, [fonte, player]);

  useEffect(() => {
    iniciar().catch(() => {});
  }, [iniciar]);

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'readyToPlay') {
      tentativas.current = 0;
      setEstado('tocando');
      if (retomarEm.current > 0) {
        player.currentTime = retomarEm.current;
        retomarEm.current = 0;
      }
    } else if (status === 'loading') {
      setEstado((e) => (e === 'reconectando' ? e : 'carregando'));
    } else if (status === 'error') {
      if (ehAoVivo && tentativas.current < MAX_TENTATIVAS) {
        tentativas.current++;
        setEstado('reconectando');
        setTimeout(() => iniciar().catch(() => {}), 2000);
      } else {
        setErro(explicarErro(error?.message));
        setEstado('erro');
      }
    }
  });

  const salvarProgresso = useCallback(() => {
    if (!item || ehAoVivo || player.duration <= 0) return;
    registrarHistorico(item.chave, item.tipo, item.titulo, player.currentTime, player.duration).catch(() => {});
  }, [item, ehAoVivo, player]);

  useEventListener(player, 'timeUpdate', salvarProgresso);
  useEffect(() => salvarProgresso, [salvarProgresso]); // salva também ao sair da tela

  const trocarCanal = async (direcao: 1 | -1) => {
    const novo = await canalVizinho(Number(id), direcao);
    if (novo) router.setParams({ id: String(novo) });
  };

  return (
    <View style={s.tela}>
      <StatusBar hidden />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={!ehAoVivo}
        allowsPictureInPicture
        fullscreenOptions={{ enable: true }}
      />

      <View style={s.barra} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.icone} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </Pressable>
        <Text numberOfLines={1} style={s.titulo}>
          {item?.titulo ?? ''}
        </Text>
        {ehAoVivo ? (
          <>
            <Pressable onPress={() => trocarCanal(-1)} hitSlop={12} style={s.icone} accessibilityLabel="Canal anterior">
              <Ionicons name="chevron-up" size={26} color="#fff" />
            </Pressable>
            <Pressable onPress={() => trocarCanal(1)} hitSlop={12} style={s.icone} accessibilityLabel="Próximo canal">
              <Ionicons name="chevron-down" size={26} color="#fff" />
            </Pressable>
          </>
        ) : null}
      </View>

      {estado === 'carregando' || estado === 'reconectando' ? (
        <View style={s.centro} pointerEvents="none">
          <ActivityIndicator size="large" color={cores.destaque} />
          {estado === 'reconectando' ? (
            <Text style={s.aviso}>
              Sinal caiu. Reconectando ({tentativas.current} de {MAX_TENTATIVAS})
            </Text>
          ) : null}
        </View>
      ) : null}

      {estado === 'erro' ? (
        <View style={[s.centro, { backgroundColor: 'rgba(0,0,0,0.75)', gap: 16, padding: 24 }]}>
          <Ionicons name="alert-circle-outline" size={44} color={cores.erro} />
          <Text style={[s.aviso, { fontSize: 16 }]}>{erro}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Botao
              titulo="Tentar de novo"
              icone="refresh"
              aoTocar={() => {
                tentativas.current = 0;
                setEstado('carregando');
                iniciar().catch(() => {});
              }}
            />
            {ehAoVivo ? <Botao titulo="Próximo canal" variante="secundario" aoTocar={() => trocarCanal(1)} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function explicarErro(msg?: string): string {
  const m = (msg ?? '').toLowerCase();
  if (m.includes('403') || m.includes('401')) return 'O provedor recusou o acesso. Confira se a assinatura está ativa.';
  if (m.includes('404')) return 'Este canal não está mais disponível no provedor.';
  if (m.includes('unable to connect') || m.includes('network') || m.includes('timeout'))
    return 'Não foi possível conectar ao servidor do canal.';
  if (m.includes('format') || m.includes('decoder') || m.includes('codec'))
    return 'Formato de vídeo não suportado por este aparelho.';
  return 'Não foi possível reproduzir este conteúdo agora.';
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#000' },
  barra: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  icone: { padding: 4 },
  titulo: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600' },
  centro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviso: { color: '#fff', fontSize: 14, marginTop: 12, textAlign: 'center' },
});
