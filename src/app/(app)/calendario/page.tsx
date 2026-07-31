import type { Metadata } from 'next';

import { CalendarioView } from './calendario-view';

export const metadata: Metadata = {
  title: 'Calendário',
  description: 'Prazos de tarefas e projetos nas visões diária, semanal e mensal.',
};

export default function CalendarioPage() {
  return <CalendarioView />;
}
