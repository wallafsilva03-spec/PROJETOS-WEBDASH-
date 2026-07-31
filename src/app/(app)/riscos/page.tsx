import type { Metadata } from 'next';

import { RiscosView } from './riscos-view';

export const metadata: Metadata = {
  title: 'Riscos',
  description: 'Heatmap corporativo de riscos por probabilidade e impacto.',
};

export default function RiscosPage() {
  return <RiscosView />;
}
