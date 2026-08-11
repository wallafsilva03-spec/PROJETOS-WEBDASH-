'use client';

import Link from 'next/link';
import {
  AlarmClock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  FolderKanban,
  Gauge,
  ListChecks,
  Plus,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { ProjectCard } from '@/components/projects/project-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useDashboardKpis } from '@/hooks/use-analytics';
import { useProjects } from '@/hooks/use-projects';
import { useMyTasks } from '@/hooks/use-tasks';
import { useSession } from '@/hooks/use-session';
import { formatDate, formatDaysLabel, formatHours, formatNumber, formatPercent } from '@/lib/format';
import { PRIORITY_META } from '@/lib/constants';
import { portfolioHref } from '@/lib/project-filters';
import { cn } from '@/lib/utils';

export function DashboardView() {
  const { profile, canCreateProject } = useSession();
  const kpis = useDashboardKpis();
  const attention = useProjects({ health: ['em_risco', 'atrasado', 'critico'], sort: 'due_date' });
  const myTasks = useMyTasks();

  const data = kpis.data;
  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const conclusionRate = data?.total_tarefas ? (data.tarefas_concluidas / data.total_tarefas) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Grupo Moreno"
        title={firstName ? `Olá, ${firstName}` : 'Dashboard'}
        description="Panorama do portfólio corporativo atualizado em tempo real."
        actions={
          canCreateProject && (
            <Button variant="brand" asChild>
              <Link href="/projetos?novo=1">
                <Plus className="size-4" />
                Novo projeto
              </Link>
            </Button>
          )
        }
      />

      {kpis.isError ? (
        <ErrorState
          description="Verifique a conexão com o Supabase e as políticas de acesso."
          onRetry={() => kpis.refetch()}
        />
      ) : kpis.isLoading ? (
        <SkeletonCards count={8} />
      ) : (
        <>
          <section aria-label="Indicadores principais" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              index={0}
              label="Projetos ativos"
              value={formatNumber(data?.projetos_ativos)}
              icon={FolderKanban}
              tone="brand"
              hint={`${formatNumber(data?.projetos_concluidos)} concluídos no total`}
              href={portfolioHref({ status: 'ativos' })}
            />
            <KpiCard
              index={1}
              label="Projetos atrasados"
              value={formatNumber(data?.projetos_atrasados)}
              icon={AlertTriangle}
              tone={data?.projetos_atrasados ? 'danger' : 'green'}
              hint="Prazo final ultrapassado"
              href={portfolioHref({ saude: 'em_atraso' })}
            />
            <KpiCard
              index={2}
              label="Projetos em risco"
              value={formatNumber(data?.projetos_em_risco)}
              icon={Gauge}
              tone={data?.projetos_em_risco ? 'warning' : 'green'}
              hint="Execução abaixo do previsto"
              href={portfolioHref({ saude: 'em_risco' })}
            />
            <KpiCard
              index={3}
              label="Vencem em 7 dias"
              value={formatNumber(data?.projetos_proximo_vencimento)}
              icon={AlarmClock}
              tone="lime"
              hint="Próximos do vencimento"
              href={portfolioHref({ prazo: 7 })}
            />
            <KpiCard
              index={4}
              label="Tarefas"
              value={formatNumber(data?.total_tarefas)}
              icon={ListChecks}
              tone="neutral"
              progress={conclusionRate}
              hint={`${formatNumber(data?.tarefas_concluidas)} concluídas (${formatPercent(conclusionRate)})`}
            />
            <KpiCard
              index={5}
              label="Concluídas hoje"
              value={formatNumber(data?.tarefas_concluidas_hoje)}
              icon={CheckCircle2}
              tone="green"
              hint="Entregas registradas no dia"
            />
            <KpiCard
              index={6}
              label="Horas planejadas × realizadas"
              value={formatHours(data?.horas_realizadas)}
              icon={Timer}
              tone="brand"
              hint={`Planejado: ${formatHours(data?.horas_planejadas)}`}
              progress={
                data?.horas_planejadas ? (data.horas_realizadas / data.horas_planejadas) * 100 : 0
              }
            />
            <KpiCard
              index={7}
              label="Usuários online"
              value={formatNumber(data?.usuarios_online)}
              icon={Users}
              tone="lime"
              hint="Conectados nos últimos 2 minutos"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="size-4 text-primary" aria-hidden />
                  Indicador geral da empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end gap-2">
                  <span className="font-display text-5xl font-semibold tracking-tight">
                    {formatPercent(data?.indicador_geral)}
                  </span>
                  <span className="pb-2 text-sm text-muted-foreground">de execução média</span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-secondary p-3">
                    <dt className="text-xs text-muted-foreground">Eficiência geral</dt>
                    <dd className="mt-0.5 text-lg font-semibold">
                      {data?.eficiencia_geral === null || data?.eficiencia_geral === undefined
                        ? '—'
                        : formatPercent(data.eficiencia_geral)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <dt className="text-xs text-muted-foreground">Horas realizadas</dt>
                    <dd className="mt-0.5 text-lg font-semibold">{formatHours(data?.horas_realizadas)}</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  Eficiência = horas estimadas ÷ horas apontadas. Acima de 100% indica entrega abaixo do esforço
                  previsto.
                </p>
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              <ActivityFeed limit={10} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-warning" aria-hidden />
                  Projetos que exigem atenção
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={portfolioHref({ saude: 'atencao' })}>Ver todos</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {attention.isLoading ? (
                  <SkeletonCards count={2} className="sm:grid-cols-2 xl:grid-cols-2" />
                ) : !attention.data?.length ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Nenhum projeto em risco"
                    description="Todo o portfólio está dentro do prazo previsto."
                    className="border-0 bg-transparent"
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {attention.data.slice(0, 4).map((project, index) => (
                      <ProjectCard key={project.id} project={project} index={index} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="size-4 text-primary" aria-hidden />
                  Minhas tarefas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myTasks.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary" />
                    ))}
                  </div>
                ) : !myTasks.data?.length ? (
                  <EmptyState
                    icon={Circle}
                    title="Sem tarefas atribuídas"
                    description="Nada pendente para você no momento."
                    className="border-0 bg-transparent py-8"
                  />
                ) : (
                  <ul className="space-y-2">
                    {myTasks.data.slice(0, 6).map((task) => {
                      const late = task.due_date && new Date(task.due_date) < new Date();
                      const daysLeft = task.due_date
                        ? Math.ceil(
                            (new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                          )
                        : null;

                      return (
                        <li key={task.id}>
                          <Link
                            href={`/projetos/${task.project_id}`}
                            className="block rounded-lg border p-3 transition-colors hover:bg-secondary"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
                              <Badge
                                variant="soft"
                                className={PRIORITY_META[task.priority].className}
                                dot={PRIORITY_META[task.priority].dot}
                              >
                                {PRIORITY_META[task.priority].label}
                              </Badge>
                            </div>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="truncate">{task.project?.code}</span>
                              {task.due_date && (
                                <>
                                  <span aria-hidden>·</span>
                                  <span className={cn(late && 'font-medium text-destructive')}>
                                    {formatDate(task.due_date)} — {formatDaysLabel(daysLeft)}
                                  </span>
                                </>
                              )}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
