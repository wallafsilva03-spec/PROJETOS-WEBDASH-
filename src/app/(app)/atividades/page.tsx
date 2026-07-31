import type { Metadata } from 'next';

import { AtividadesView } from './atividades-view';

export const metadata: Metadata = {
  title: 'Atividades',
  description: 'Centro de atividades em tempo real de todo o portfólio.',
};

export default function AtividadesPage() {
  return <AtividadesView />;
}
