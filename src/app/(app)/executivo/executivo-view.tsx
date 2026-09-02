'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, FlaskConical, Gauge, Repeat, Timer, TrendingUp } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { AreaBreakdown, PortfolioShare } from '@/components/dashboard/portfolio-share';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ExportMenu } from '@/components/projects/export-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton, SkeletonCards } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useExecutiveData, useDashboardKpis } from '@/hooks/use-analytics';
import { useProjects } from '@/hooks/use-projects';
import { CHART_COLORS, HEALTH_META, PROJECT_STATUS_META } from '@/lib/constants';
import { PROJECT_COLUMNS } from '@/lib/report-columns';
import { formatCompactCurrency, formatDelta, formatNumber, formatPercent } from '@/lib/format';
import { humanizeEnum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DEMO_CRITICAL, DEMO_EXECUTIVE, DEMO_KPIS } from './demo-data';
import type { HealthStatus, ProjectStatus } from '@/types/database';

const chartTooltip = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 12,
  },
};

const AXIS = { stroke: 'hsl(var(--muted-foreground))', fontSize: 11 };

/** Selo aplicado a cada bloco enquanto a tela mostra números fictícios. */
function SeloFicticio() {
  return (
    <Badge
      variant="soft"
      className="bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
    >
      <FlaskConical className="size-3" />
      Fictício
    </Badge>
  );
}

export function ExecutivoView() {
  const executive = useExecutiveData();
  const kpis = useDashboardKpis();
  const critical = useProjects({ health: ['critico', 'atrasado'], sort: 'due_date' });
  const allProjects = useProjects({ sort: 'due_date' });

  const data = executive.data;

  // Portfólio ainda sem projetos: a tela vira demonstração, com dados fictícios
  // sempre identificados como tais.
  const semDados =
    !executive.isLoading &&
    !executive.isError &&
    (data?.byStatus.length ?? 0) === 0 &&
    (data?.byDepartment.length ?? 0) === 0 &&
    (data?.byManager.length ?? 0) === 0;

  const fonte = semDados ? DEMO_EXECUTIVE : data;
  const indicadorGeral = semDados ? DEMO_KPIS.indicador_geral : kpis.data?.indicador_geral;
  const criticos = semDados ? DEMO_CRITICAL : critical.data;

  const statusChart = React.useMemo(
    () =>
      (fonte?.byStatus ?? []).map((row) => ({
        name: PROJECT_STATUS_META[row.chave as ProjectStatus]?.label ?? humanizeEnum(row.chave),
        total: Number(row.total),
        progresso: Number(row.progresso_medio ?? 0),
      })),
    [fonte],
  );

  const healthChart = React.useMemo(
    () =>
      (fonte?.health ?? []).map((row) => ({
        name: HEALTH_META[row.chave as HealthStatus]?.label ?? humanizeEnum(row.chave),
        value: Number(row.total),
      })),
    [fonte],
  );

  const departmentChart = React.useMemo(
    () =>
      (fonte?.byDepartment ?? []).map((row) => ({
        name: row.chave,
        total: Number(row.total),
        atrasados: Number(row.atrasados ?? 0),
        progresso: Number(row.progresso_medio ?? 0),
        orcamento: Number(row.orcamento ?? 0),
      })),
    [fonte],
  );

  /** Viabilidade econômica consolidada — só departamentos com retorno informado. */
  const financeiro = React.useMemo(() => {
    const linhas = (fonte?.financials ?? []).filter((row) => Number(row.retorno_esperado) > 0);
    const orcamento = linhas.reduce((total, row) => total + Number(row.orcamento ?? 0), 0);
    const retorno = linhas.reduce((total, row) => total + Number(row.retorno_esperado ?? 0), 0);

    return {
      linhas,
      orcamento,
      retorno,
      beneficio: retorno - orcamento,
      roi: orcamento > 0 ? ((retorno - orcamento) / orcamento) * 100 : null,
      retornoMaximo: Math.max(...linhas.map((row) => Number(row.retorno_esperado ?? 0)), 0),
    };
  }, [fonte]);

  const priorityChart = React.useMemo(
    () =>
      (fonte?.byPriority ?? []).map((row) => ({
        subject: humanizeEnum(row.chave),
        total: Number(row.total),
      })),
    [fonte],
  );

  if (executive.isError) {
    return <ErrorState onRetry={() => executive.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={semDados ? 'Modo Diretoria · demonstração' : 'Modo Diretoria'}
        title="Dashboard Executivo"
        description={
          semDados
            ? 'Ainda não há projetos cadastrados. Os números abaixo são fictícios e servem apenas para mostrar o formato do relatório.'
            : 'Visão consolidada do portfólio: fluxo, saúde, distribuição e projetos críticos.'
        }
        actions={
          <ExportMenu
            rows={allProjects.data ?? []}
            columns={PROJECT_COLUMNS}
            filename="portfolio-executivo"
            title="Relatório Executivo de Portfólio"
            subtitle="Grupo Moreno · visão consolidada da diretoria"
          />
        }
      />

      {semDados && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 sm:flex-row sm:items-center dark:border-amber-500/60 dark:bg-amber-950/40"
        >
          <FlaskConical className="size-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              Dados fictícios — nenhum projeto cadastrado ainda
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200/90">
              Todos os números, gráficos e nomes desta tela são inventados, apenas para demonstrar o
              formato do relatório. Não use para tomar decisão. Assim que o primeiro projeto for criado,
              a tela passa a mostrar os dados reais automaticamente.
            </p>
          </div>
          <Button variant="brand" asChild className="shrink-0">
            <Link href="/projetos?novo=1">Cadastrar projeto</Link>
          </Button>
        </div>
      )}

      {executive.isLoading || kpis.isLoading ? (
        <SkeletonCards count={4} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            index={0}
            label="Lead Time médio"
            value={fonte?.flow?.lead_time_dias ? `${fonte.flow.lead_time_dias}d` : '—'}
            icon={Timer}
            tone="brand"
            hint="Da criação à conclusão da tarefa"
          />
          <KpiCard
            index={1}
            label="Cycle Time médio"
            value={fonte?.flow?.cycle_time_dias ? `${fonte.flow.cycle_time_dias}d` : '—'}
            icon={Repeat}
            tone="lime"
            hint="Do início efetivo à entrega"
          />
          <KpiCard
            index={2}
            label="Velocidade"
            value={fonte?.flow?.velocidade_semanal ? `${fonte.flow.velocidade_semanal}/sem` : '—'}
            icon={Activity}
            tone="green"
            hint={`${formatNumber(fonte?.flow?.entregas_12_semanas)} entregas em 12 semanas`}
          />
          <KpiCard
            index={3}
            label="Indicador geral"
            value={formatPercent(indicadorGeral)}
            icon={Gauge}
            tone="brand"
            progress={indicadorGeral ?? 0}
            hint="Execução média do portfólio"
          />
        </section>
      )}

      {/*
        O recorte por área que a Diretoria pede, antes do detalhe por status:
        quanto cada área pesa no portfólio e como ela está distribuída.
      */}
      <section aria-label="Leitura gerencial" className="grid gap-4 xl:grid-cols-2">
        <PortfolioShare
          projects={allProjects.data ?? []}
          description="Percentual sobre todos os projetos não arquivados."
        />
        <AreaBreakdown projects={allProjects.data ?? []} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Projetos por status
              {semDados && <SeloFicticio />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {executive.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !statusChart.length ? (
              <EmptyState icon={TrendingUp} title="Sem dados" className="border-0 bg-transparent" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" {...AXIS} />
                    <YAxis allowDecimals={false} {...AXIS} />
                    <Tooltip {...chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total" name="Projetos" radius={[6, 6, 0, 0]}>
                      {statusChart.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Saúde do portfólio
              {semDados && <SeloFicticio />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {executive.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !healthChart.length ? (
              <EmptyState icon={Gauge} title="Sem projetos ativos" className="border-0 bg-transparent" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={healthChart}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={3}
                    >
                      {healthChart.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Projetos por departamento
              {semDados && <SeloFicticio />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {executive.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : !departmentChart.length ? (
              <EmptyState icon={TrendingUp} title="Sem dados" className="border-0 bg-transparent" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentChart}
                    layout="vertical"
                    margin={{ top: 8, right: 16, bottom: 0, left: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} {...AXIS} />
                    <YAxis type="category" dataKey="name" width={120} {...AXIS} />
                    <Tooltip {...chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total" name="Total" fill="hsl(var(--chart-1))" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="atrasados" name="Atrasados" fill="hsl(var(--chart-6))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Distribuição por prioridade
              {semDados && <SeloFicticio />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {executive.isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : !priorityChart.length ? (
              <EmptyState icon={AlertTriangle} title="Sem dados" className="border-0 bg-transparent" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={priorityChart} outerRadius="72%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Radar
                      name="Projetos"
                      dataKey="total"
                      stroke="hsl(var(--chart-2))"
                      fill="hsl(var(--chart-2))"
                      fillOpacity={0.45}
                    />
                    <Tooltip {...chartTooltip} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            Retorno financeiro do portfólio
            {semDados && <SeloFicticio />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {executive.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : !financeiro.linhas.length ? (
            <EmptyState
              icon={TrendingUp}
              title="Sem retorno informado"
              description="Preencha o retorno esperado na edição dos projetos para avaliar a viabilidade econômica do portfólio."
              className="border-0 bg-transparent"
            />
          ) : (
            <div className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-secondary/60 p-3">
                  <dt className="text-xs text-muted-foreground">Investimento</dt>
                  <dd className="font-display text-xl font-semibold">
                    {formatCompactCurrency(financeiro.orcamento)}
                  </dd>
                </div>
                <div className="rounded-lg bg-secondary/60 p-3">
                  <dt className="text-xs text-muted-foreground">Retorno esperado</dt>
                  <dd className="font-display text-xl font-semibold">
                    {formatCompactCurrency(financeiro.retorno)}
                  </dd>
                </div>
                <div className="rounded-lg bg-secondary/60 p-3">
                  <dt className="text-xs text-muted-foreground">Benefício líquido</dt>
                  <dd
                    className={cn(
                      'font-display text-xl font-semibold',
                      financeiro.beneficio < 0 && 'text-destructive',
                    )}
                  >
                    {formatCompactCurrency(financeiro.beneficio)}
                  </dd>
                </div>
                <div className="rounded-lg bg-secondary/60 p-3">
                  <dt className="text-xs text-muted-foreground">ROI do portfólio</dt>
                  <dd
                    className={cn(
                      'font-display text-xl font-semibold',
                      (financeiro.roi ?? 0) < 0 && 'text-destructive',
                    )}
                  >
                    {financeiro.roi === null ? '—' : formatDelta(financeiro.roi)}
                  </dd>
                </div>
              </dl>

              <ul className="space-y-3">
                {financeiro.linhas.map((row) => {
                  const share =
                    financeiro.retornoMaximo > 0
                      ? (Number(row.retorno_esperado) / financeiro.retornoMaximo) * 100
                      : 0;

                  return (
                    <li key={row.chave} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{row.chave}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatCompactCurrency(row.orcamento)} → {formatCompactCurrency(row.retorno_esperado)}
                          <Badge
                            variant="soft"
                            className={cn(
                              'ml-2',
                              Number(row.beneficio_liquido) >= 0
                                ? 'bg-moreno-green-50 text-moreno-green-700 dark:bg-moreno-green-900/50 dark:text-moreno-green-200'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
                            )}
                          >
                            ROI {formatDelta(row.roi_percent)}
                          </Badge>
                        </span>
                      </div>
                      <Progress
                        value={share}
                        className="h-1.5"
                        indicatorClassName={
                          Number(row.beneficio_liquido) >= 0 ? 'bg-success' : 'bg-destructive'
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Desempenho por gestor
              {semDados && <SeloFicticio />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {executive.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !fonte?.byManager.length ? (
              <EmptyState icon={TrendingUp} title="Sem dados" className="border-0 bg-transparent" />
            ) : (
              <ul className="space-y-3">
                {fonte.byManager.map((row) => (
                  <li key={row.chave} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{row.chave}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {row.total} projeto(s) · {row.concluidos ?? 0} concluído(s)
                        {Number(row.atrasados) > 0 && (
                          <Badge variant="destructive" className="ml-2 text-[10px]">
                            {row.atrasados} atrasado(s)
                          </Badge>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={Number(row.progresso_medio ?? 0)} className="h-1.5 flex-1" />
                      <span className="w-11 text-right text-xs font-semibold">
                        {formatPercent(Number(row.progresso_medio ?? 0))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-destructive" aria-hidden />
              Projetos críticos e atrasados
              {semDados && <SeloFicticio />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!semDados && critical.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !criticos?.length ? (
              <EmptyState
                icon={Gauge}
                title="Portfólio saudável"
                description="Nenhum projeto crítico ou atrasado no momento."
                className="border-0 bg-transparent"
              />
            ) : (
              <ul className="divide-y">
                {criticos.slice(0, 8).map((project) => (
                  <li key={project.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${HEALTH_META[project.health].dot}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {project.code} · {project.owner_name ?? 'Sem gestor'} ·{' '}
                        {project.days_late > 0 ? `${project.days_late} dia(s) de atraso` : 'em risco'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold">{formatPercent(project.progress)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {departmentChart.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Orçamento por departamento
              {semDados && <SeloFicticio />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 font-medium">Departamento</th>
                    <th scope="col" className="py-2 font-medium">Projetos</th>
                    <th scope="col" className="py-2 font-medium">Atrasados</th>
                    <th scope="col" className="py-2 font-medium">Progresso médio</th>
                    <th scope="col" className="py-2 text-right font-medium">Orçamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {departmentChart.map((row) => (
                    <tr key={row.name}>
                      <td className="py-2.5 font-medium">{row.name}</td>
                      <td className="py-2.5">{row.total}</td>
                      <td className="py-2.5">
                        {row.atrasados > 0 ? (
                          <Badge variant="destructive">{row.atrasados}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-2.5">{formatPercent(row.progresso)}</td>
                      <td className="py-2.5 text-right font-medium">{formatCompactCurrency(row.orcamento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
