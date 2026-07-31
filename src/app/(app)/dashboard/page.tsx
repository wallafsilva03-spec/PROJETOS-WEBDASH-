import type { Metadata } from 'next';

import { DashboardView } from './dashboard-view';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Indicadores em tempo real do portfólio de projetos do Grupo Moreno.',
};

export default function DashboardPage() {
  return <DashboardView />;
}
