import type { Metadata } from 'next';

import { KanbanView } from './kanban-view';

export const metadata: Metadata = {
  title: 'Kanban',
  description: 'Kanban das etapas dos projetos, organizado pela data de término.',
};

export default function KanbanPage() {
  return <KanbanView />;
}
