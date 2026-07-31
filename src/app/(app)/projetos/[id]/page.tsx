import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { ProjectDetail } from './project-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('projects').select('code, name').eq('id', id).maybeSingle();

  return data ? { title: `${data.code} · ${data.name}` } : { title: 'Projeto' };
}

export default async function ProjetoPage({ params }: PageProps) {
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
