'use client';

import * as React from 'react';
import { AlertTriangle, Users } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { ExportMenu } from '@/components/projects/export-menu';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useWorkload } from '@/hooks/use-analytics';
import { WORKLOAD_COLUMNS } from '@/lib/report-columns';
import { formatHours, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Faixa de ocupação → tom visual. */
function occupancyMeta(percent: number | null) {
  if (percent === null) return { label: 'Sem alocação', tone: 'bg-slate-300', badge: 'secondary' as const };
  if (percent > 110) return { label: 'Sobrecarregado', tone: 'bg-destructive', badge: 'destructive' as const };
  if (percent > 85) return { label: 'No limite', tone: 'bg-warning', badge: 'warning' as const };
  if (percent > 40) return { label: 'Equilibrado', tone: 'bg-success', badge: 'success' as const };
  return { label: 'Disponível', tone: 'bg-moreno-lime-500', badge: 'secondary' as const };
}

export function WorkloadView() {
  const { data, isLoading, isError, refetch } = useWorkload();
  const rows = React.useMemo(() => data ?? [], [data]);

  const summary = React.useMemo(() => {
    const capacity = rows.reduce((sum, row) => sum + Number(row.capacidade_semanal), 0);
    const planned = rows.reduce((sum, row) => sum + Number(row.horas_planejadas), 0);
    const overloaded = rows.filter((row) => (row.ocupacao_percentual ?? 0) > 110).length;
    const available = rows.reduce((sum, row) => sum + Number(row.disponibilidade_horas), 0);

    return { capacity, planned, overloaded, available, people: rows.length };
  }, [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Planejamento"
        title="Capacidade da equipe"
        description="Horas planejadas versus capacidade semanal, disponibilidade e sobrecarga por pessoa."
        actions={
          <ExportMenu
            rows={rows}
            columns={WORKLOAD_COLUMNS}
            filename="workload-equipe"
            title="Capacidade da Equipe"
            subtitle="Horas planejadas consideram o esforço restante das tarefas abertas."
          />
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Pessoas"
          value={formatNumber(summary.people)}
          icon={Users}
          tone="brand"
          hint="Colaboradores ativos"
        />
        <KpiCard
          index={1}
          label="Capacidade semanal"
          value={formatHours(summary.capacity)}
          icon={Users}
          tone="lime"
          hint={`${formatHours(summary.planned)} já planejadas`}
          progress={summary.capacity ? (summary.planned / summary.capacity) * 100 : 0}
        />
        <KpiCard
          index={2}
          label="Disponibilidade"
          value={formatHours(summary.available)}
          icon={Users}
          tone="green"
          hint="Horas livres na semana"
        />
        <KpiCard
          index={3}
          label="Sobrecarregados"
          value={formatNumber(summary.overloaded)}
          icon={AlertTriangle}
          tone={summary.overloaded ? 'danger' : 'green'}
          hint="Acima de 110% da capacidade"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alocação por colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <SkeletonTable rows={6} />
          ) : !rows.length ? (
            <EmptyState icon={Users} title="Nenhum colaborador ativo" className="border-0 bg-transparent" />
          ) : (
            <ul className="divide-y">
              {rows.map((row) => {
                const percent = row.ocupacao_percentual;
                const meta = occupancyMeta(percent);

                return (
                  <li key={row.user_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <UserAvatar userId={row.user_id} name={row.full_name} src={row.avatar_url} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.job_title ?? '—'}
                          {row.department_name && ` · ${row.department_name}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {formatHours(row.horas_planejadas)} de {formatHours(row.capacidade_semanal)}
                        </span>
                        <span className="font-semibold">{formatPercent(percent)}</span>
                      </div>
                      <Progress
                        value={Math.min(percent ?? 0, 100)}
                        indicatorClassName={meta.tone}
                        className="h-2"
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:w-72 sm:justify-end">
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {row.tarefas_abertas} tarefa(s)
                      </span>
                      {row.tarefas_atrasadas > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          {row.tarefas_atrasadas} atrasada(s)
                        </Badge>
                      )}
                      <span
                        className={cn(
                          'text-xs',
                          row.projetos_atrasados > 0 ? 'font-medium text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {row.projetos_ativos} projeto(s)
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
