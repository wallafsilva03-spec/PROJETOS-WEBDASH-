'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Hint } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { useRiskHeatmap } from '@/hooks/use-analytics';
import { useProjects } from '@/hooks/use-projects';
import { riskSeverityMeta } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const SCALE = [1, 2, 3, 4, 5];

export function RiscosView() {
  const heatmap = useRiskHeatmap();
  const projects = useProjects({ sort: 'due_date' });

  const cells = heatmap.data ?? [];
  const totalRisks = cells.reduce((sum, cell) => sum + Number(cell.total), 0);
  const extreme = cells.filter((cell) => cell.probability * cell.impact >= 20);
  const high = cells.filter((cell) => {
    const severity = cell.probability * cell.impact;
    return severity >= 12 && severity < 20;
  });

  const projectsWithRisk = React.useMemo(
    () => (projects.data ?? []).filter((project) => project.open_risks > 0).sort((a, b) => b.max_risk_severity - a.max_risk_severity),
    [projects.data],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Direção"
        title="Heatmap de riscos"
        description="Matriz corporativa de probabilidade × impacto com os riscos ainda em aberto."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard index={0} label="Riscos abertos" value={formatNumber(totalRisks)} icon={ShieldAlert} tone="brand" />
        <KpiCard
          index={1}
          label="Severidade extrema"
          value={formatNumber(extreme.reduce((sum, cell) => sum + Number(cell.total), 0))}
          icon={ShieldAlert}
          tone="danger"
          hint="Severidade ≥ 20"
        />
        <KpiCard
          index={2}
          label="Severidade alta"
          value={formatNumber(high.reduce((sum, cell) => sum + Number(cell.total), 0))}
          icon={ShieldAlert}
          tone="warning"
          hint="Severidade entre 12 e 19"
        />
        <KpiCard
          index={3}
          label="Projetos afetados"
          value={formatNumber(projectsWithRisk.length)}
          icon={ShieldAlert}
          tone="lime"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Matriz 5 × 5</CardTitle>
          </CardHeader>
          <CardContent>
            {heatmap.isLoading ? (
              <Skeleton className="h-72 w-72" />
            ) : (
              <div className="flex gap-2">
                <span className="flex items-center rotate-180 text-[10px] font-medium text-muted-foreground [writing-mode:vertical-rl]">
                  Probabilidade
                </span>
                <div>
                  <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1.5">
                    {[...SCALE].reverse().map((probability) => (
                      <React.Fragment key={probability}>
                        <span className="flex w-4 items-center justify-center text-[10px] text-muted-foreground">
                          {probability}
                        </span>
                        {SCALE.map((impact) => {
                          const cell = cells.find(
                            (item) => item.probability === probability && item.impact === impact,
                          );
                          const meta = riskSeverityMeta(probability * impact);
                          const total = Number(cell?.total ?? 0);

                          return (
                            <Hint
                              key={`${probability}-${impact}`}
                              label={
                                total
                                  ? (cell?.titulos ?? []).slice(0, 6).join(' · ')
                                  : `${meta.label} — sem riscos registrados`
                              }
                            >
                              <div
                                className={cn(
                                  'flex size-14 items-center justify-center rounded-lg text-base font-bold transition-transform hover:scale-105',
                                  meta.className,
                                  !total && 'opacity-20',
                                )}
                              >
                                {total || ''}
                              </div>
                            </Hint>
                          );
                        })}
                      </React.Fragment>
                    ))}
                    <span />
                    {SCALE.map((impact) => (
                      <span key={impact} className="text-center text-[10px] text-muted-foreground">
                        {impact}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-center text-[10px] font-medium text-muted-foreground">Impacto</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Projetos com riscos em aberto</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !projectsWithRisk.length ? (
              <EmptyState
                icon={ShieldAlert}
                title="Nenhum risco em aberto"
                description="Todos os riscos registrados estão mitigados ou aceitos."
                className="border-0 bg-transparent"
              />
            ) : (
              <ul className="divide-y">
                {projectsWithRisk.map((project) => {
                  const meta = riskSeverityMeta(project.max_risk_severity);
                  return (
                    <li key={project.id}>
                      <Link
                        href={`/projetos/${project.id}`}
                        className="flex items-center gap-3 py-3 transition-colors hover:bg-secondary/40"
                      >
                        <span
                          className={cn(
                            'flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                            meta.className,
                          )}
                        >
                          {project.max_risk_severity}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{project.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {project.code} · {project.department_name ?? 'Sem departamento'}
                          </p>
                        </div>
                        <Badge variant="secondary">{project.open_risks} risco(s)</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
