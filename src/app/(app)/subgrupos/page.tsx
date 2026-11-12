import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Subgrupos' };

type Demand = {
  position: number;
  committee: string;
  demand: string;
  status: string;
  observation: string;
};

const statusVariants = new Map<string, 'default' | 'warning'>([
  ['Em andamento', 'default'],
  ['Em validação/ajuste', 'warning'],
]);

export default async function SubgroupsPage() {
  const supabase = await createClient();
  const { data: canView, error: accessError } = await supabase.rpc('is_manager');
  if (accessError) return <ErrorState description="Não foi possível verificar o acesso aos subgrupos." />;
  if (!canView) redirect('/dashboard');

  const { data, error } = await supabase
    .from('subgroup_demands')
    .select('position, committee, demand, status, observation')
    .order('position')
    .returns<Demand[]>();

  if (error) return <ErrorState description="Não foi possível carregar as demandas dos subgrupos." />;

  const committees = new Map<string, Demand[]>();
  for (const item of data) {
    const entries = committees.get(item.committee) ?? [];
    entries.push(item);
    committees.set(item.committee, entries);
  }

  return (
    <>
      <PageHeader
        title="Subgrupos"
        description={`${data.length} demandas de ${committees.size} comitês.`}
      />
      {data.length === 0 && <EmptyState title="Nenhuma demanda cadastrada" />}
      <div className="space-y-4">
        {Array.from(committees, ([committee, entries]) => (
          <Card key={committee} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3 sm:px-5">
              <h2 className="font-semibold">{committee}</h2>
              <span className="text-sm text-muted-foreground">
                {entries.length} {entries.length === 1 ? 'demanda' : 'demandas'}
              </span>
            </div>
            <ul className="divide-y">
              {entries.map((item) => (
                <li key={item.position} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
                  <h3 className="min-w-0 font-medium">{item.demand}</h3>
                  <Badge
                    variant={statusVariants.get(item.status) ?? 'secondary'}
                    className="w-fit self-start"
                  >
                    {item.status}
                  </Badge>
                  {item.observation && (
                    <p className="whitespace-pre-line text-muted-foreground sm:col-span-2">{item.observation}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
