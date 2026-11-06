'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  AlarmClock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  FolderKanban,
  Gauge,
  ListChecks,
  MonitorPlay,
  Plus,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { AreaBreakdown, PortfolioShare } from '@/components/dashboard/portfolio-share';
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
import { daysUntilDate, formatDate, formatDaysLabel, formatHours, formatNumber, formatPercent } from '@/lib/format';
import { PRIORITY_META, PROJECT_STATUS_META } from '@/lib/constants';
import { portfolioHref } from '@/lib/project-filters';
import { isLateTask } from '@/lib/task-grouping';
import { cn } from '@/lib/utils';
import type { ProjectOverview } from '@/types/database';

type Alignment = { id: number; meeting_date: string; unit: string; topic: string; follow_up: string };

function ProjectStatusSummary({ projects }: { projects: ProjectOverview[] }) {
  const counts = new Map<string, number>();
  for (const project of projects) {
    counts.set(project.status, (counts.get(project.status) ?? 0) + 1);
  }

  const statuses = Object.entries(PROJECT_STATUS_META).filter(
    ([status]) => status === 'cancelado' || counts.has(status),
  );

  return (
    <Card className="self-start p-4">
      <h2 className="text-base font-semibold">Resumo de projetos</h2>
      <p className="mt-1 text-sm text-muted-foreground">Total do portfólio por situação.</p>
      <table className="mt-3 w-full text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th scope="col" className="pb-2 text-left font-medium">Situação</th>
            <th scope="col" className="pb-2 text-right font-medium">Quantidade</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map(([status, meta]) => (
            <tr key={status} className="border-t">
              <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className={cn('size-2 shrink-0 rounded-full', meta.dot)} />
                  {meta.label}
                </span>
              </th>
              <td className="text-right tabular-nums">{formatNumber(counts.get(status) ?? 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <th scope="row" className="pt-2 text-left">Total de projetos</th>
            <td className="pt-2 text-right tabular-nums">{formatNumber(projects.length)}</td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}

function StrategicAlignments() {
  const [selectedDate, setDate] = React.useState('');
  const alignments = useQuery({
    queryKey: ['strategic-alignments'],
    queryFn: async (): Promise<Alignment[]> => {
      const { data, error } = await createClient()
        .from('strategic_alignments')
        .select('id, meeting_date, unit, topic, follow_up')
        .order('meeting_date', { ascending: false })
        .order('id');
      if (error) throw error;
      return data as Alignment[];
    },
  });
  const dates = Array.from(new Set(alignments.data?.map((item) => item.meeting_date)));
  const date = selectedDate || dates[0] || '';
  const [unit, setUnit] = React.useState('');
  const topicsForDate = alignments.data?.filter((item) => item.meeting_date === date) ?? [];
  const units = ['AMLA', 'CEMMA', 'COPLASA'];
  const groups = Array.from(new Set(topicsForDate.map((item) => item.unit))).filter(
    (group) => !unit || group === unit || (group === 'CEMMA e COPLASA' && unit !== 'AMLA'),
  );

  if (alignments.isError) {
    return <ErrorState description="Não foi possível carregar os alinhamentos." onRetry={() => alignments.refetch()} />;
  }

  if (alignments.isLoading) return <SkeletonCards count={1} />;

  return (
    <Card className="min-w-0 p-4">
      <h2 className="text-base font-semibold">Alinhamentos estratégicos</h2>
      <p className="mt-1 text-sm text-muted-foreground">Tópicos tratados e encaminhamentos por unidade.</p>
      {dates.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhum alinhamento disponível para este perfil.</p>}
      {dates.length > 0 && <div className="my-3 flex flex-wrap gap-3">
        <label className="grid gap-1 text-xs font-medium">
          Data da reunião
          <select className="rounded-md border bg-background px-2 py-1.5 text-sm" value={date} onChange={(event) => setDate(event.target.value)}>
            {dates.map((item) => <option key={item} value={item}>{formatDate(item)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium">
          Unidade
          <select className="rounded-md border bg-background px-2 py-1.5 text-sm" value={unit} onChange={(event) => setUnit(event.target.value)}>
            <option value="">Todas</option>
            {units.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>}
      <div className="space-y-3">
        {groups.map((group) => {
          const topics = topicsForDate.filter((topic) => topic.unit === group);
          if (!topics.length) return null;

          return (
            <details key={group} className="rounded-md border px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium">
                {group === 'CEMMA e COPLASA' ? 'AMN · CEMMA e COPLASA' : group} · {topics.length} tópicos
              </summary>
              <ul className="mt-2 divide-y">
                {topics.map((topic) => (
                  <li key={topic.id} className="py-2">
                    <h3 className="font-medium">{topic.topic}</h3>
                    <p className="mt-0.5 text-muted-foreground">{topic.follow_up}</p>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </Card>
  );
}

export function DashboardView() {
  const { profile, canCreateProject } = useSession();
  const kpis = useDashboardKpis();
  const attention = useProjects({ health: ['em_risco', 'atrasado', 'critico'], sort: 'due_date' });
  // Portfólio inteiro: a leitura gerencial é sobre o total, não sobre um recorte.
  const all = useProjects({ sort: 'name' });
  const myTasks = useMyTasks();

  const data = kpis.data;
  const portfolio = React.useMemo(() => all.data ?? [], [all.data]);
  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const conclusionRate = data?.total_tarefas ? (data.tarefas_concluidas / data.total_tarefas) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Grupo Moreno"
        title={firstName ? `Olá, ${firstName}` : 'Dashboard'}
        description="Panorama do portfólio corporativo atualizado em tempo real."
        actions={
          <>
            {/* Mesma aba: a tela vira o mural e fica nele. A volta é pelo
                botão de sair, dentro do próprio mural. */}
            <Button variant="outline" asChild>
              <Link href="/tv">
                <MonitorPlay className="size-4" />
                Modo TV
              </Link>
            </Button>
            {canCreateProject && (
              <Button variant="brand" asChild>
                <Link href="/projetos?novo=1">
                  <Plus className="size-4" />
                  Novo projeto
                </Link>
              </Button>
            )}
          </>
        }
      />

      <section aria-label="Resumo e alinhamentos" className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {all.isError ? (
          <ErrorState description="Não foi possível carregar o resumo de projetos." onRetry={() => all.refetch()} />
        ) : all.isLoading ? (
          <SkeletonCards count={1} />
        ) : (
          <ProjectStatusSummary projects={portfolio} />
        )}
        <StrategicAlignments />
      </section>

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
              label="Projetos críticos ou atrasados"
              value={formatNumber(data?.projetos_atrasados)}
              icon={AlertTriangle}
              tone={data?.projetos_atrasados ? 'danger' : 'green'}
              hint="Desvio crítico ou prazo vencido"
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

          {/*
            A leitura de abertura para a Diretoria: quanto por cento do
            portfólio está concluído, como o resto se distribui e o mesmo
            recorte por área.
          */}
          <section aria-label="Leitura gerencial" className="grid gap-4 xl:grid-cols-2">
            <PortfolioShare
              projects={portfolio}
              description="Percentual sobre todos os projetos não arquivados."
            />
            <AreaBreakdown projects={portfolio} />
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
                      const late = isLateTask(task);
                      const daysLeft = daysUntilDate(task.due_date);

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
