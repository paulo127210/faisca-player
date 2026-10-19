/** Janela de PIN e o gancho que protege categorias bloqueadas */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { aoMudar, desbloquear, esconderBloqueados } from '@/lib/parental';
import { PIN_MAX } from '@/lib/pin';
import { cores, espaco, raio } from '@/lib/tema';
import { Botao, estilos } from './ui';

export function JanelaPin({
  visivel,
  titulo = 'Digite o PIN',
  aoFechar,
  aoLiberar,
}: {
  visivel: boolean;
  titulo?: string;
  aoFechar: () => void;
  aoLiberar: () => void;
}) {
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (visivel) {
      setPin('');
      setErro(null);
    }
  }, [visivel]);

  const confirmar = async () => {
    const r = await desbloquear(pin);
    if (r.ok) aoLiberar();
    else {
      setErro(r.mensagem ?? 'PIN incorreto.');
      setPin('');
    }
  };

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoFechar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: espaco.g }}>
        <View style={{ backgroundColor: cores.superficie, borderRadius: raio, padding: espaco.g, gap: espaco.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="lock-closed" size={22} color={cores.destaque} />
            <Text style={[estilos.secao, { marginBottom: 0, flex: 1 }]}>{titulo}</Text>
            <Pressable onPress={aoFechar} hitSlop={12} accessibilityLabel="Fechar">
              <Ionicons name="close" size={24} color={cores.textoFraco} />
            </Pressable>
          </View>
          <TextInput
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_MAX}
            autoFocus
            onSubmitEditing={confirmar}
            style={[estilos.campo, { fontSize: 28, letterSpacing: 12, textAlign: 'center' }]}
          />
          {erro ? <Text style={{ color: cores.erro, textAlign: 'center' }}>{erro}</Text> : null}
          <Botao titulo="Desbloquear" aoTocar={confirmar} desativado={pin.length < 4} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * Para telas com chips de categoria: ao escolher uma categoria bloqueada,
 * pede o PIN antes. Também avisa a tela quando o estado do bloqueio muda.
 */
export function useCategoriaProtegida(aoEscolher: (id: number | null) => void) {
  const [pendente, setPendente] = useState<number | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => aoMudar(() => setVersao((v) => v + 1)), []);

  const escolher = useCallback(
    async (id: number | null, bloqueada: boolean) => {
      if (id !== null && bloqueada && (await esconderBloqueados())) setPendente(id);
      else aoEscolher(id);
    },
    [aoEscolher],
  );

  const janela = (
    <JanelaPin
      visivel={pendente !== null}
      titulo="Categoria bloqueada"
      aoFechar={() => setPendente(null)}
      aoLiberar={() => {
        const id = pendente;
        setPendente(null);
        aoEscolher(id);
      }}
    />
  );

  return { escolher, janela, versao };
}
