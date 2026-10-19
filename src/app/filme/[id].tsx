import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Botao, Carregando, estilos } from '@/components/ui';
import { obterBanco } from '@/lib/db';
import { alternarFavorito, ehFavorito, posicaoSalva } from '@/lib/repo';
import { cores, espaco, raio } from '@/lib/tema';

interface DadosFilme {
  id: number;
  titulo: string;
  capa: string | null;
  ano: string | null;
  sinopse: string | null;
  chave: string;
}

export default function DetalheFilme() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [f, setF] = useState<DadosFilme | null>(null);
  const [fav, setFav] = useState(false);
  const [retomar, setRetomar] = useState(0);

  useEffect(() => {
    (async () => {
      const db = await obterBanco();
      const r = await db.getFirstAsync<DadosFilme>(
        'SELECT id, titulo, capa, ano, sinopse, chave FROM filme WHERE id = ?',
        [Number(id)],
      );
      setF(r);
      if (r) {
        setFav(await ehFavorito(r.chave));
        setRetomar(await posicaoSalva(r.chave));
      }
    })().catch(() => {});
  }, [id]);

  if (!f) return <Carregando />;
  const tocar = () => router.push({ pathname: '/player', params: { tipo: 'filme', id: String(f.id) } });

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={{ padding: espaco.m, gap: espaco.m }}>
      <Stack.Screen options={{ title: f.titulo }} />
      <View style={{ flexDirection: 'row', gap: espaco.m }}>
        <Image
          source={f.capa ? { uri: f.capa } : null}
          style={{ width: 130, height: 195, borderRadius: raio, backgroundColor: cores.superficie2 }}
          contentFit="cover"
        />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={estilos.titulo}>{f.titulo}</Text>
          {f.ano ? <Text style={estilos.subtitulo}>{f.ano}</Text> : null}
        </View>
      </View>
      <Botao titulo={retomar > 0 ? `Continuar de ${formatar(retomar)}` : 'Assistir'} icone="play" aoTocar={tocar} />
      <Botao
        titulo={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        variante="secundario"
        icone={fav ? 'star' : 'star-outline'}
        aoTocar={async () => setFav(await alternarFavorito(f.chave, 'filme'))}
      />
      {f.sinopse ? <Text style={[estilos.subtitulo, { color: cores.texto }]}>{f.sinopse}</Text> : null}
    </ScrollView>
  );
}

function formatar(seg: number) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}
