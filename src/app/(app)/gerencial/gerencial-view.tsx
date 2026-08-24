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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarCheck,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  FolderKanban,
  PauseCircle,
  PlayCircle,
  X,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ExportMenu } from '@/components/projects/export-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkeletonCards } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useProjects } from '@/hooks/use-projects';
import {
  APROVACAO_OPTIONS,
  AREA_OPTIONS,
  MEDICAO_PROXIMA_DIAS,
  MELHORIA_OPTIONS,
  STATUS_GERENCIAL_META,
  STATUS_GERENCIAL_ORDER,
} from '@/lib/constants';
import { PROJECT_COLUMNS } from '@/lib/report-columns';
import { medicoesAderencia, portfolioGerencial } from '@/lib/portfolio-gerencial';
import {
  ALL,
  GERENCIAL_FILTER,
  gerencialOf,
  matchesGovernance,
  portfolioHref,
  type AprovacaoFilter,
  type AreaFilter,
  type MelhoriaFilter,
  type RedmineFilter,
} from '@/lib/project-filters';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectOverview, StatusGerencial } from '@/types/database';

const chartTooltip = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 12,
  },
};

const AXIS = { stroke: 'hsl(var(--muted-foreground))', fontSize: 11 };

interface Filtros {
  area: AreaFilter;
  status: typeof ALL | StatusGerencial;
  aprovacao: AprovacaoFilter;
  redmine: RedmineFilter;
  melhoria: MelhoriaFilter;
  responsavel: string;
  de: string;
  ate: string;
}

const FILTROS_LIMPOS: Filtros = {
  area: ALL,
  status: ALL,
  aprovacao: ALL,
  redmine: ALL,
  melhoria: ALL,
  responsavel: ALL,
  de: '',
  ate: '',
};

/** Nomes que aparecem como responsáveis, para alimentar o filtro. */
function responsibleOptions(projects: ProjectOverview[]) {
  const names = new Set<string>();
  projects.forEach((project) => {
    if (project.owner_name) names.add(project.owner_name);
    (project.responsibles ?? []).forEach((name) => names.add(name));
  });
  return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Período: o projeto entra quando a sua janela de execução encosta no
 * intervalo escolhido — não só quando começa dentro dele.
 */
function dentroDoPeriodo(project: ProjectOverview, de: string, ate: string) {
  if (de && project.due_date < de) return false;
  if (ate && project.start_date > ate) return false;
  return true;
}

export function GerencialView() {
  const { data, isLoading, isError, refetch } = useProjects({ sort: 'due_date' });
  const [filtros, setFiltros] = React.useState<Filtros>(FILTROS_LIMPOS);

  const todos = React.useMemo(() => data ?? [], [data]);

  const patch = React.useCallback(
    (values: Partial<Filtros>) => setFiltros((current) => ({ ...current, ...values })),
    [],
  );

  const projetos = React.useMemo(
    () =>
      todos.filter((project) => {
        if (!matchesGovernance(project, filtros)) return false;
        if (filtros.status !== ALL && gerencialOf(project) !== filtros.status) return false;
        if (filtros.responsavel !== ALL) {
          const wanted = filtros.responsavel.toLowerCase();
          const bate =
            project.owner_name?.toLowerCase() === wanted ||
            (project.responsibles ?? []).some((name) => name.toLowerCase() === wanted);
          if (!bate) return false;
        }
        return dentroDoPeriodo(project, filtros.de, filtros.ate);
      }),
    [todos, filtros],
  );

  const resumo = React.useMemo(() => portfolioGerencial(projetos), [projetos]);
  const medicoes = React.useMemo(() => medicoesAderencia(projetos), [projetos]);
  const responsaveis = React.useMemo(() => responsibleOptions(todos), [todos]);

  const filtrado = React.useMemo(
    () => Object.entries(filtros).some(([key, value]) => value !== FILTROS_LIMPOS[key as keyof Filtros]),
    [filtros],
  );

  /** Distribuição por status — só o que existe entra no gráfico de rosca. */
  const distribuicao = React.useMemo(
    () => resumo.porStatus.filter((slice) => slice.total > 0),
    [resumo.porStatus],
  );

  /** Área × status, no formato que a barra empilhada espera. */
  const areaChart = React.useMemo(
    () =>
      resumo.porArea.map((row) => ({
        area: row.label,
        total: row.total,
        ...Object.fromEntries(
          STATUS_GERENCIAL_ORDER.map((status) => [status, row.porStatus[status]]),
        ),
      })),
    [resumo.porArea],
  );

  /** Cada indicador de gestão leva ao portfólio com o mesmo recorte. */
  const gestao: { label: string; value: number; hint: string; tone: string; href: string }[] = [
    {
      label: 'Aprovados pela Diretoria',
      value: resumo.governanca.aprovados,
      hint: `${formatPercent(pct(resumo.governanca.aprovados, resumo.total))} do portfólio`,
      tone: 'text-success',
      href: portfolioHref({ aprovacao: 'sim' }),
    },
    {
      label: 'Em aprovação',
      value: resumo.governanca.emAprovacao,
      hint: 'Aguardando decisão',
      tone: 'text-warning',
      href: portfolioHref({ aprovacao: 'em_aprovacao' }),
    },
    {
      label: 'Lançados no Redmine',
      value: resumo.governanca.redmineLancados,
      hint: `${formatPercent(pct(resumo.governanca.redmineLancados, resumo.total))} formalizados`,
      tone: 'text-success',
      href: portfolioHref({ redmine: 'sim' }),
    },
    {
      label: 'Pendentes de lançamento',
      value: resumo.governanca.redminePendentes,
      hint: 'Ainda sem registro no Redmine',
      tone: 'text-destructive',
      href: portfolioHref({ redmine: 'nao' }),
    },
    {
      label: 'Melhoria Contínua',
      value: resumo.governanca.melhoriaSim,
      hint: 'Serão incorporados ao processo',
      tone: 'text-success',
      href: portfolioHref({ melhoria: 'sim' }),
    },
    {
      label: 'Em avaliação para Melhoria Contínua',
      value: resumo.governanca.melhoriaAvaliacao,
      hint: 'Decisão pendente',
      tone: 'text-warning',
      href: portfolioHref({ melhoria: 'em_avaliacao' }),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Direção"
        title="Visão gerencial do portfólio"
        description="Quantos projetos existem, quanto já foi concluído e como cada área evolui — a leitura do portfólio para a Diretoria."
        actions={
          <ExportMenu
            rows={projetos}
            columns={PROJECT_COLUMNS}
            filename="visao-gerencial"
            title="Visão Gerencial do Portfólio"
            subtitle={filtrado ? 'Relatório gerado com filtros aplicados.' : undefined}
          />
        }
      />

      {/* Filtros — valem para todos os indicadores e gráficos da tela. */}
      <Card className="p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Select value={filtros.area} onValueChange={(value) => patch({ area: value as AreaFilter })}>
            <SelectTrigger aria-label="Filtrar por área">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as áreas</SelectItem>
              {AREA_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="nao_definida">Não definida</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filtros.status}
            onValueChange={(value) => patch({ status: value as Filtros['status'] })}
          >
            <SelectTrigger aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os status</SelectItem>
              {STATUS_GERENCIAL_ORDER.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_GERENCIAL_META[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtros.aprovacao}
            onValueChange={(value) => patch({ aprovacao: value as AprovacaoFilter })}
          >
            <SelectTrigger aria-label="Filtrar por aprovação da Diretoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toda aprovação</SelectItem>
              {APROVACAO_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  Diretoria: {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtros.redmine}
            onValueChange={(value) => patch({ redmine: value as RedmineFilter })}
          >
            <SelectTrigger aria-label="Filtrar por lançamento no Redmine">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Redmine: todos</SelectItem>
              <SelectItem value="sim">Redmine: lançados</SelectItem>
              <SelectItem value="nao">Redmine: pendentes</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filtros.melhoria}
            onValueChange={(value) => patch({ melhoria: value as MelhoriaFilter })}
          >
            <SelectTrigger aria-label="Filtrar por Melhoria Contínua">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toda Melhoria Contínua</SelectItem>
              {MELHORIA_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  Melhoria: {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtros.responsavel}
            onValueChange={(value) => patch({ responsavel: value })}
          >
            <SelectTrigger aria-label="Filtrar por responsável">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os responsáveis</SelectItem>
              {responsaveis.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filtros.de}
              onChange={(event) => patch({ de: event.target.value })}
              aria-label="Período — de"
            />
            <Input
              type="date"
              value={filtros.ate}
              onChange={(event) => patch({ ate: event.target.value })}
              aria-label="Período — até"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span>
            {formatNumber(projetos.length)} de {formatNumber(todos.length)} projeto(s) considerados
          </span>
          {filtrado && (
            <Button variant="ghost" size="sm" onClick={() => setFiltros(FILTROS_LIMPOS)}>
              <X className="size-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <SkeletonCards count={5} />
      ) : !todos.length ? (
        <EmptyState
          icon={FolderKanban}
          title="Nenhum projeto cadastrado"
          description="Cadastre projetos para que o painel gerencial tenha o que consolidar."
        />
      ) : (
        <>
          {/* Linha 1 — indicador principal e KPIs de status */}
          <section aria-label="Indicadores principais" className="grid gap-4 lg:grid-cols-3">
            <Card className="relative overflow-hidden p-6 lg:col-span-1">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" aria-hidden />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                % de projetos concluídos
              </p>
              <p className="mt-2 font-display text-6xl font-semibold tracking-tight text-success">
                {formatPercent(resumo.percentConcluido)}
              </p>
              <Progress
                value={resumo.percentConcluido}
                className="mt-4 h-2"
                indicatorClassName="bg-moreno-green-500"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                {formatNumber(resumo.concluidos)} de {formatNumber(resumo.total)} projetos concluídos
              </p>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
              <KpiCard
                index={0}
                label="Total de projetos"
                value={formatNumber(resumo.total)}
                icon={FolderKanban}
                tone="brand"
                hint="Portfólio com os filtros aplicados"
                href={portfolioHref()}
              />
              <KpiCard
                index={1}
                label="% em andamento"
                value={formatPercent(resumo.percent.em_andamento)}
                icon={PlayCircle}
                tone="lime"
                progress={resumo.percent.em_andamento}
                hint={`${formatNumber(resumo.contagem.em_andamento)} projeto(s)`}
                href={portfolioHref({ status: GERENCIAL_FILTER.em_andamento })}
              />
              <KpiCard
                index={2}
                label="% não iniciado"
                value={formatPercent(resumo.percent.nao_iniciado)}
                icon={CircleDashed}
                tone="neutral"
                progress={resumo.percent.nao_iniciado}
                hint={`${formatNumber(resumo.contagem.nao_iniciado)} projeto(s)`}
                href={portfolioHref({ status: GERENCIAL_FILTER.nao_iniciado })}
              />
              <KpiCard
                index={3}
                label="% paralisado"
                value={formatPercent(resumo.percent.paralisado)}
                icon={PauseCircle}
                tone={resumo.contagem.paralisado ? 'warning' : 'green'}
                progress={resumo.percent.paralisado}
                hint={`${formatNumber(resumo.contagem.paralisado)} projeto(s)`}
                href={portfolioHref({ status: GERENCIAL_FILTER.paralisado })}
              />
            </div>
          </section>

          {/* Linha 2 — distribuição geral por status */}
          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden />
                  Distribuição por status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!distribuicao.length ? (
                  <EmptyState
                    icon={FolderKanban}
                    title="Sem projetos no recorte"
                    className="border-0 bg-transparent py-8"
                  />
                ) : (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distribuicao}
                          dataKey="total"
                          nameKey="label"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {distribuicao.map((slice) => (
                            <Cell key={slice.status} fill={slice.color} />
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

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quantidade e percentual por status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {resumo.porStatus.map((slice) => (
                  <Link
                    key={slice.status}
                    href={portfolioHref({ status: GERENCIAL_FILTER[slice.status] })}
                    className="block rounded-lg p-2 transition-colors hover:bg-secondary"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className={cn('size-2 rounded-full', STATUS_GERENCIAL_META[slice.status].dot)}
                          aria-hidden
                        />
                        {slice.label}
                      </span>
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">{formatNumber(slice.total)}</strong>{' '}
                        · {formatPercent(slice.percent, 1)}
                      </span>
                    </div>
                    <Progress
                      value={slice.percent}
                      className="mt-1.5 h-1.5"
                      indicatorClassName={STATUS_GERENCIAL_META[slice.status].dot}
                    />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* Linha 3 — evolução por área */}
          <section className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Área × status dos projetos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={areaChart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="area" {...AXIS} />
                      <YAxis allowDecimals={false} {...AXIS} />
                      <Tooltip {...chartTooltip} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {STATUS_GERENCIAL_ORDER.map((status, index) => (
                        <Bar
                          key={status}
                          dataKey={status}
                          stackId="area"
                          name={STATUS_GERENCIAL_META[status].label}
                          fill={STATUS_GERENCIAL_META[status].chart}
                          radius={index === STATUS_GERENCIAL_ORDER.length - 1 ? [6, 6, 0, 0] : undefined}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quantidade e percentual por área</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 font-medium">Área</th>
                      <th scope="col" className="py-2 text-right font-medium">Total</th>
                      {STATUS_GERENCIAL_ORDER.map((status) => (
                        <th key={status} scope="col" className="py-2 text-right font-medium">
                          {STATUS_GERENCIAL_META[status].label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {resumo.porArea.map((row) => (
                      <tr key={row.key}>
                        <th scope="row" className="py-2 text-left font-medium">
                          {row.label}
                        </th>
                        <td className="py-2 text-right font-semibold">{formatNumber(row.total)}</td>
                        {STATUS_GERENCIAL_ORDER.map((status) => (
                          <td key={status} className="py-2 text-right">
                            <span className="font-medium">{formatNumber(row.porStatus[status])}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {formatPercent(row.percentPorStatus[status])}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>

          {/* Linha 4 — indicadores de gestão */}
          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="size-4 text-primary" aria-hidden />
                  Indicadores de gestão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {gestao.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="rounded-xl border p-4 transition-all hover:shadow-card-hover"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {item.label}
                      </p>
                      <p className={cn('font-display text-2xl font-semibold', item.tone)}>
                        {formatNumber(item.value)}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.hint}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarCheck className="size-4 text-primary" aria-hidden />
                  Medição de aderência
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Com medição prevista</p>
                    <p className="mt-0.5 text-lg font-semibold">
                      {formatNumber(resumo.governanca.comMedicao)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Vencidas</p>
                    <p
                      className={cn(
                        'mt-0.5 text-lg font-semibold',
                        resumo.governanca.medicaoVencida && 'text-destructive',
                      )}
                    >
                      {formatNumber(resumo.governanca.medicaoVencida)}
                    </p>
                  </div>
                </div>

                {!medicoes.length ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma medição prevista para os próximos {MEDICAO_PROXIMA_DIAS} dias.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {medicoes.slice(0, 6).map((project) => {
                      const dias = project.dias_para_medicao ?? 0;

                      return (
                        <li key={project.id}>
                          <Link
                            href={`/projetos/${project.id}`}
                            className="flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors hover:bg-secondary"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{project.name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatDate(project.data_medicao_aderencia)}
                              </span>
                            </span>
                            <Badge variant={dias < 0 ? 'destructive' : dias <= 7 ? 'warning' : 'outline'}>
                              {dias < 0 ? `${Math.abs(dias)}d vencida` : `em ${dias}d`}
                            </Badge>
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

/** Percentual simples, tolerante ao portfólio vazio. */
function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}
