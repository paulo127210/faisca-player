/**
 * Pressable que mostra destaque quando recebe foco pelo controle remoto
 * (Android TV, Fire Stick) ou teclado. No celular funciona igual ao Pressable.
 */
import { useState } from 'react';
import {
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { cores } from '@/lib/tema';

const destaque: ViewStyle = {
  borderWidth: 2,
  borderColor: cores.destaque,
  borderRadius: 10,
  transform: [{ scale: 1.04 }],
};

export function Toque({ style, onFocus, onBlur, ...resto }: PressableProps) {
  const [foco, setFoco] = useState(false);
  return (
    <Pressable
      {...resto}
      onFocus={(e) => {
        setFoco(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFoco(false);
        onBlur?.(e);
      }}
      style={(estado: PressableStateCallbackType): StyleProp<ViewStyle> => [
        typeof style === 'function' ? style(estado) : style,
        foco && destaque,
      ]}
    />
  );
}
