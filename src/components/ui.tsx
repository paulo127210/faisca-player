/** Componentes visuais reaproveitados nas telas */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { cores, espaco, raio } from '@/lib/tema';
import { Toque } from './Toque';

export type NomeIcone = ComponentProps<typeof Ionicons>['name'];

export function Botao(props: {
  titulo: string;
  aoTocar: () => void;
  variante?: 'principal' | 'secundario' | 'perigo';
  icone?: NomeIcone;
  desativado?: boolean;
}) {
  const { variante = 'principal' } = props;
  const fundo = variante === 'principal' ? cores.destaque : variante === 'perigo' ? cores.erro : cores.superficie2;
  return (
    <Toque
      accessibilityRole="button"
      onPress={props.aoTocar}
      disabled={props.desativado}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: fundo, opacity: props.desativado ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {props.icone && <Ionicons name={props.icone} size={18} color={cores.texto} />}
      <Text style={estilos.botaoTexto}>{props.titulo}</Text>
    </Toque>
  );
}

export function Campo(props: TextInputProps & { rotulo: string; ajuda?: string }) {
  const { rotulo, ajuda, style, ...resto } = props;
  return (
    <View style={{ marginBottom: espaco.m }}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        placeholderTextColor={cores.textoFraco}
        autoCapitalize="none"
        autoCorrect={false}
        style={[estilos.campo, style]}
        {...resto}
      />
      {ajuda ? <Text style={estilos.ajuda}>{ajuda}</Text> : null}
    </View>
  );
}

export function Vazio({
  icone,
  titulo,
  texto,
  children,
}: {
  icone: NomeIcone;
  titulo: string;
  texto?: string;
  children?: ReactNode;
}) {
  return (
    <View style={estilos.vazio}>
      <Ionicons name={icone} size={48} color={cores.textoFraco} />
      <Text style={estilos.vazioTitulo}>{titulo}</Text>
      {texto ? <Text style={estilos.vazioTexto}>{texto}</Text> : null}
      {children}
    </View>
  );
}

export function Carregando({ texto }: { texto?: string }) {
  return (
    <View style={estilos.vazio}>
      <ActivityIndicator color={cores.destaque} size="large" />
      {texto ? <Text style={estilos.vazioTexto}>{texto}</Text> : null}
    </View>
  );
}

/** Logo do canal ou capa; mostra a inicial quando a imagem falta ou falha */
export function Miniatura({
  uri,
  nome,
  largura,
  altura,
}: {
  uri: string | null;
  nome: string;
  largura: number;
  altura: number;
}) {
  return (
    <View style={[estilos.mini, { width: largura, height: altura }]}>
      <Text style={estilos.miniLetra}>{nome.trim().charAt(0).toUpperCase()}</Text>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          recyclingKey={uri}
          cachePolicy="disk"
          transition={120}
        />
      ) : null}
    </View>
  );
}

/** Lista horizontal de categorias (chips). Categorias bloqueadas mostram um cadeado. */
export function Chips<T extends { id: number | null; nome: string; bloqueada?: number }>({
  itens,
  ativo,
  aoEscolher,
}: {
  itens: T[];
  ativo: number | null;
  aoEscolher: (id: number | null, bloqueada: boolean) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.chipsLinha}
      style={{ flexGrow: 0 }}
    >
      {itens.map((c) => (
        <Toque
          key={String(c.id)}
          onPress={() => aoEscolher(c.id, !!c.bloqueada)}
          style={() => [estilos.chip, c.id === ativo && estilos.chipAtivo, { flexDirection: 'row', gap: 6 }]}
        >
          {c.bloqueada ? (
            <Ionicons name="lock-closed" size={13} color={c.id === ativo ? '#fff' : cores.textoFraco} />
          ) : null}
          <Text numberOfLines={1} style={[estilos.chipTexto, c.id === ativo && { color: '#fff' }]}>
            {c.nome}
          </Text>
        </Toque>
      ))}
    </ScrollView>
  );
}

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  titulo: { color: cores.texto, fontSize: 24, fontWeight: '700' },
  subtitulo: { color: cores.textoFraco, fontSize: 15, lineHeight: 22 },
  secao: { color: cores.texto, fontSize: 18, fontWeight: '700', marginBottom: espaco.p },
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: raio,
  },
  botaoTexto: { color: cores.texto, fontSize: 16, fontWeight: '600' },
  foco: { borderWidth: 2, borderColor: cores.texto },
  rotulo: { color: cores.texto, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  campo: {
    backgroundColor: cores.superficie,
    borderColor: cores.borda,
    borderWidth: 1,
    borderRadius: raio,
    color: cores.texto,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  ajuda: { color: cores.textoFraco, fontSize: 12, marginTop: 4 },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco.g, gap: 12 },
  vazioTitulo: { color: cores.texto, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  vazioTexto: { color: cores.textoFraco, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  mini: {
    backgroundColor: cores.superficie2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniLetra: { color: cores.textoFraco, fontSize: 20, fontWeight: '700' },
  chipsLinha: { flexDirection: 'row', gap: 8, paddingHorizontal: espaco.m, paddingVertical: espaco.p },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    maxWidth: 220,
  },
  chipAtivo: { backgroundColor: cores.destaque, borderColor: cores.destaque },
  chipTexto: { color: cores.textoFraco, fontSize: 14, fontWeight: '600' },
});
