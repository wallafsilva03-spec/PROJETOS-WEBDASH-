import type { Metadata } from 'next';

import { CronogramaView } from './cronograma-view';

export const metadata: Metadata = {
  title: 'Cronograma',
  description: 'Gantt consolidado de todos os projetos, com dependências e caminho crítico.',
};

export default function CronogramaPage() {
  return <CronogramaView />;
}
