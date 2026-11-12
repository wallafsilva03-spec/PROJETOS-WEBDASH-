import type { Metadata } from 'next';

import { Card } from '@/components/ui/card';
import { DemandStatusEditor, type DemandStatus } from '../../subgrupos/demand-status-editor';
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
  const supabase = await createClient();
  const [{ data: subgroups }, { data: canEditStatus }] = await Promise.all([
    supabase.from('subgroup_demands')
      .select('position, demand, status')
      .eq('project_id', id)
      .order('demand')
      .returns<{ position: number; demand: string; status: DemandStatus }[]>(),
    supabase.rpc('is_manager'),
  ]);

  return (
    <>
      <ProjectDetail projectId={id} />
      {!!subgroups?.length && (
        <Card className="mt-4 p-5">
          <h2 className="mb-2 font-semibold">Subgrupos</h2>
          <ul className="divide-y">
            {subgroups.map((item) => (
              <li key={item.position} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>{item.demand}</span>
                {canEditStatus ? (
                  <DemandStatusEditor
                    key={item.status}
                    position={item.position}
                    demand={item.demand}
                    status={item.status}
                  />
                ) : <span className="text-muted-foreground">{item.status}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
