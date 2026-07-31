import type { Metadata } from 'next';

import { WorkloadView } from './workload-view';

export const metadata: Metadata = {
  title: 'Workload',
  description: 'Capacidade, alocação e disponibilidade da equipe.',
};

export default function WorkloadPage() {
  return <WorkloadView />;
}
