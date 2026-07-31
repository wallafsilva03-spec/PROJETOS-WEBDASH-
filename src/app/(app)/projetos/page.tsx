import { Suspense } from 'react';
import type { Metadata } from 'next';

import { SkeletonCards } from '@/components/ui/skeleton';
import { ProjectsView } from './projects-view';

export const metadata: Metadata = {
  title: 'Projetos',
  description: 'Portfólio corporativo de projetos com filtros, agrupamentos e exportação.',
};

export default function ProjetosPage() {
  return (
    <Suspense fallback={<SkeletonCards count={6} className="xl:grid-cols-3" />}>
      <ProjectsView />
    </Suspense>
  );
}
