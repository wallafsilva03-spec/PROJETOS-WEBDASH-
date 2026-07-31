import type { Metadata } from 'next';

import { RoadmapView } from './roadmap-view';

export const metadata: Metadata = {
  title: 'Roadmap',
  description: 'Roadmap executivo do portfólio: projetos por linha, meses na horizontal e marcos.',
};

export default function RoadmapPage() {
  return <RoadmapView />;
}
