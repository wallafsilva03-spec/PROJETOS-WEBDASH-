import type { Metadata } from 'next';

import { RelatoriosView } from './relatorios-view';

export const metadata: Metadata = {
  title: 'Relatórios',
  description: 'Exportação de portfólio, cronograma e capacidade em Excel, CSV e PDF.',
};

export default function RelatoriosPage() {
  return <RelatoriosView />;
}
