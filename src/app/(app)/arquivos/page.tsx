import { Suspense } from 'react';
import type { Metadata } from 'next';

import { Skeleton } from '@/components/ui/skeleton';
import { ArquivosView } from './arquivos-view';

export const metadata: Metadata = {
  title: 'Arquivos',
  description: 'Envie e consulte os documentos anexados a cada projeto.',
};

export default function ArquivosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ArquivosView />
    </Suspense>
  );
}
