import { router } from 'expo-router';
import type { ItemLista } from './repo';

/** Abre o item certo: canal e filme vão ao player/detalhe, série vai à lista de episódios */
export function abrirItem(item: Pick<ItemLista, 'tipo' | 'id'>) {
  if (item.tipo === 'live') router.push({ pathname: '/player', params: { tipo: 'live', id: String(item.id) } });
  else if (item.tipo === 'filme') router.push(`/filme/${item.id}`);
  else router.push(`/serie/${item.id}`);
}
