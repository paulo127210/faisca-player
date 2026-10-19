/** Decide a primeira tela: sem lista vai para Boas-vindas, com lista vai para Início */
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Carregando } from '@/components/ui';
import { listas } from '@/lib/repo';

export default function Entrada() {
  const [temLista, setTemLista] = useState<boolean | null>(null);
  useEffect(() => {
    listas()
      .then((l) => setTemLista(l.length > 0))
      .catch(() => setTemLista(false));
  }, []);

  if (temLista === null) return <Carregando />;
  return <Redirect href={temLista ? '/inicio' : '/boas-vindas'} />;
}
