'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FolderKanban, LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { AreaBreakdown, GovernanceShare, PortfolioShare } from '@/components/dashboard/portfolio-share';
import { ProjectCard } from '@/components/projects/project-card';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { ExportMenu } from '@/components/projects/export-menu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProgressWithDelta } from '@/components/ui/progress';
import { SkeletonCards, SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useProjects, type ProjectFilters } from '@/hooks/use-projects';
import { useDepartments } from '@/hooks/use-catalogs';
import { useSession } from '@/hooks/use-session';
import { useDebouncedValue } from '@/hooks/use-search';
import { HEALTH_META, PRIORITY_META, PROJECT_STATUS_META, PROJECT_STATUS_OPTIONS } from '@/lib/constants';
import { PROJECT_COLUMNS } from '@/lib/report-columns';
import {
  ALL,
  healthFilterLabel,
  healthList,
  isDueWithin,
  isHealthFilter,
  isLate,
  isStatusFilter,
  statusFilterLabel,
  statusList,
  type HealthFilter,
  type StatusFilter,
} from '@/lib/project-filters';
import { formatDate, formatDaysLabel, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectOverview } from '@/types/database';

type ViewMode = 'grid' | 'table';
type Sort = NonNullable<ProjectFilters['sort']>;

const SORTS: Sort[] = ['due_date', 'progress', 'priority', 'name', 'created_at'];

/**
 * Atalhos de estado do portfólio. São a resposta ao "cliquei em atrasados e
 * quero ver só os atrasados": cada card leva o mesmo conjunto que ele conta.
 */
const STATE_TILES: {
  key: string;
  label: string;
  hint: string;
  tone: string;
  match: (project: ProjectOverview) => boolean;
  filters: { status?: StatusFilter; saude?: HealthFilter; prazo?: number };
}[] = [
  {
    key: 'todos',
    label: 'Todos',
    hint: 'Portfólio completo',
    tone: 'text-foreground',
    match: () => true,
    filters: {},
  },
  {
    key: 'em_atraso',
    label: 'Em atraso',
    hint: 'Atrasados e críticos',
    tone: 'text-destructive',
    match: (project) => isLate(project),
    filters: { saude: 'em_atraso' },
  },
  {
    key: 'em_risco',
    label: 'Em risco',
    hint: 'Execução abaixo do previsto',
    tone: 'text-warning',
    match: (project) => project.health === 'em_risco',
    filters: { saude: 'em_risco' },
  },
  {
    key: 'no_previsto',
    label: 'Dentro do previsto',
    hint: 'No prazo ou adiantados',
    tone: 'text-success',
    match: (project) => project.health === 'no_prazo' || project.health === 'adiantado',
    filters: { saude: 'no_previsto' },
  },
  {
    key: 'vence_7',
    label: 'Vencem em 7 dias',
    hint: 'Prazo próximo, ainda em aberto',
    tone: 'text-warning',
    match: (project) => isDueWithin(project, 7),
    filters: { prazo: 7 },
  },
];

export function ProjectsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canCreateProject } = useSession();
  const departments = useDepartments();

  const [dialogOpen, setDialogOpen] = React.useState(searchParams.get('novo') === '1');
  const [view, setView] = React.useState<ViewMode>('grid');

  /* ------------------------------------------------------------ URL → filtros
   * A tela inteira é dirigida pela URL: o clique em um indicador do dashboard,
   * em um card de estado ou em um analista chega aqui como parâmetro, e o
   * endereço continua compartilhável.
   */
  const rawStatus = searchParams.get('status') ?? ALL;
  const rawHealth = searchParams.get('saude') ?? ALL;
  const status: StatusFilter = isStatusFilter(rawStatus) ? rawStatus : ALL;
  const health: HealthFilter = isHealthFilter(rawHealth) ? rawHealth : ALL;
  const departmentId = searchParams.get('depto') ?? ALL;
  const responsible = searchParams.get('responsavel') ?? '';
  const dueWithin = Number(searchParams.get('prazo')) || 0;
  const rawSort = searchParams.get('ordenar') ?? '';
  const sort: Sort = (SORTS as string[]).includes(rawSort) ? (rawSort as Sort) : 'due_date';

  const [search, setSearch] = React.useState(searchParams.get('busca') ?? '');
  const debouncedSearch = useDebouncedValue(search, 300);

  /** Escreve os filtros na URL preservando o que não foi tocado. */
  const setParams = React.useCallback(
    (patch: Record<string, string | number | undefined | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '' || value === ALL || value === 0) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
      params.delete('novo');

      const query = params.toString();
      router.replace(query ? `/projetos?${query}` : '/projetos', { scroll: false });
    },
    [router, searchParams],
  );

  // A busca é digitada, então só vai para a URL depois do debounce.
  React.useEffect(() => {
    const current = searchParams.get('busca') ?? '';
    if (debouncedSearch === current) return;
    setParams({ busca: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  function applyState(filters: { status?: StatusFilter; saude?: HealthFilter; prazo?: number }) {
    setParams({
      status: filters.status ?? ALL,
      saude: filters.saude ?? ALL,
      prazo: filters.prazo ?? 0,
    });
  }

  /* ---------------------------------------------------------------- Consultas */
  const filters = React.useMemo<ProjectFilters>(
    () => ({
      search: debouncedSearch || undefined,
      status: statusList(status),
      health: healthList(health),
      departmentId: departmentId === ALL ? undefined : departmentId,
      sort,
    }),
    [debouncedSearch, status, health, departmentId, sort],
  );

  const { data, isLoading, isError, refetch } = useProjects(filters);

  // Lista sem filtro nenhum: alimenta a contagem dos cards de estado, que
  // precisa continuar mostrando o portfólio inteiro mesmo com filtro ativo.
  const all = useProjects({ sort: 'due_date' });

  const projects = React.useMemo(() => {
    let list = data ?? [];
    // Responsável e prazo são resolvidos aqui: o primeiro depende de uma
    // coluna que bancos antigos não têm, e o segundo é derivado da data.
    if (responsible) {
      const wanted = responsible.toLowerCase();
      list = list.filter(
        (project) =>
          project.owner_name?.toLowerCase() === wanted ||
          (project.responsibles ?? []).some((name) => name.toLowerCase() === wanted),
      );
    }
    if (dueWithin) list = list.filter((project) => isDueWithin(project, dueWithin));
    return list;
  }, [data, responsible, dueWithin]);

  const counts = React.useMemo(() => {
    const list = all.data ?? [];
    const byState = Object.fromEntries(
      STATE_TILES.map((tile) => [tile.key, list.filter(tile.match).length]),
    ) as Record<string, number>;
    const byStatus = PROJECT_STATUS_OPTIONS.map((option) => ({
      ...option,
      total: list.filter((project) => project.status === option.value).length,
    }));
    return { byState, byStatus };
  }, [all.data]);

  /** O card fica marcado quando os filtros da tela são exatamente os dele. */
  function isActiveTile(tile: (typeof STATE_TILES)[number]) {
    return (
      (tile.filters.status ?? ALL) === status &&
      (tile.filters.saude ?? ALL) === health &&
      (tile.filters.prazo ?? 0) === dueWithin
    );
  }

  const hasFilters =
    Boolean(debouncedSearch) ||
    status !== ALL ||
    health !== ALL ||
    departmentId !== ALL ||
    Boolean(responsible) ||
    Boolean(dueWithin);

  function clearFilters() {
    setSearch('');
    router.replace('/projetos', { scroll: false });
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open && searchParams.get('novo')) setParams({});
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Portfólio"
        title="Projetos"
        description="Todos os projetos corporativos, com saúde e progresso calculados automaticamente."
        actions={
          <>
            <ExportMenu
              rows={projects}
              columns={PROJECT_COLUMNS}
              filename="portfolio-projetos"
              title="Portfólio de Projetos"
              subtitle={hasFilters ? 'Relatório gerado com filtros aplicados.' : undefined}
            />
            {canCreateProject && (
              <Button variant="brand" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Novo projeto
              </Button>
            )}
          </>
        }
      />

      {/*
        Leitura em percentual do que está na tela. Segue os filtros de
        propósito: filtrar por departamento e ver o percentual daquele
        departamento é o uso natural, e um resumo fixo do portfólio inteiro
        contradiria a lista logo abaixo.
      */}
      <section aria-label="Indicadores em percentual" className="grid gap-4 xl:grid-cols-2">
        <PortfolioShare
          projects={projects}
          title={hasFilters ? 'Visão geral do recorte' : 'Visão geral do portfólio'}
          description={
            hasFilters
              ? 'Percentual sobre os projetos que atendem aos filtros aplicados.'
              : 'Percentual sobre todos os projetos não arquivados.'
          }
        />
        <GovernanceShare projects={projects} />
      </section>

      <AreaBreakdown projects={projects} />

      {/* Estados do portfólio — cada card é um filtro de um clique. */}
      <section aria-label="Estados do portfólio" className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {STATE_TILES.map((tile) => {
          const active = isActiveTile(tile);

          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => applyState(tile.filters)}
              aria-pressed={active}
              className={cn(
                'rounded-xl border bg-card p-4 text-left transition-all hover:shadow-card-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && 'border-primary ring-1 ring-primary',
              )}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tile.label}
              </p>
              <p className={cn('font-display text-2xl font-semibold', tile.tone)}>
                {all.isLoading ? '—' : counts.byState[tile.key]}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{tile.hint}</p>
            </button>
          );
        })}
      </section>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou código…"
              className="pl-9"
              aria-label="Buscar projetos"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-center">
            <Select value={status} onValueChange={(value) => setParams({ status: value, prazo: 0 })}>
              <SelectTrigger className="lg:w-44" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                <SelectItem value="ativos">{statusFilterLabel('ativos')}</SelectItem>
                <SelectItem value="encerrados">{statusFilterLabel('encerrados')}</SelectItem>
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={health} onValueChange={(value) => setParams({ saude: value, prazo: 0 })}>
              <SelectTrigger className="lg:w-40" aria-label="Filtrar por saúde">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toda saúde</SelectItem>
                <SelectItem value="em_atraso">{healthFilterLabel('em_atraso')}</SelectItem>
                {Object.entries(HEALTH_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={departmentId} onValueChange={(value) => setParams({ depto: value })}>
              <SelectTrigger className="lg:w-48" aria-label="Filtrar por departamento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os departamentos</SelectItem>
                {departments.data?.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(value) => setParams({ ordenar: value })}>
              <SelectTrigger className="lg:w-44" aria-label="Ordenar">
                <SlidersHorizontal className="mr-1 size-3.5 opacity-60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_date">Prazo mais próximo</SelectItem>
                <SelectItem value="progress">Maior progresso</SelectItem>
                <SelectItem value="priority">Prioridade</SelectItem>
                <SelectItem value="name">Nome (A–Z)</SelectItem>
                <SelectItem value="created_at">Mais recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 rounded-lg border p-1">
            <Button
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setView('grid')}
              aria-label="Visualizar em cards"
              aria-pressed={view === 'grid'}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setView('table')}
              aria-label="Visualizar em lista"
              aria-pressed={view === 'table'}
            >
              <List className="size-4" />
            </Button>
          </div>
        </div>

        {/* Contagem por status — o portfólio inteiro, um clique por estado. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
          {counts.byStatus.map((option) => {
            const active = status === option.value;
            const meta = PROJECT_STATUS_META[option.value];

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setParams({ status: active ? ALL : option.value, prazo: 0 })}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary hover:text-primary',
                  !option.total && 'opacity-50',
                )}
              >
                <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
                {option.label}
                <span className="text-muted-foreground">{option.total}</span>
              </button>
            );
          })}
        </div>

        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {projects.length} projeto(s) com os filtros aplicados
            </span>
            {responsible && (
              <Badge variant="soft" className="bg-gradient-brand-soft text-foreground">
                Responsável: {responsible}
              </Badge>
            )}
            {Boolean(dueWithin) && <Badge variant="warning">Vencem em {dueWithin} dia(s)</Badge>}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-3.5" />
              Limpar filtros
            </Button>
          </div>
        )}
      </Card>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        view === 'grid' ? (
          <SkeletonCards count={6} className="xl:grid-cols-3" />
        ) : (
          <SkeletonTable />
        )
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={hasFilters ? 'Nenhum projeto encontrado' : 'Nenhum projeto cadastrado'}
          description={
            hasFilters
              ? 'Ajuste os filtros para ampliar a busca.'
              : 'Crie o primeiro projeto para começar a acompanhar o portfólio.'
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : (
              canCreateProject && (
                <Button variant="brand" onClick={() => setDialogOpen(true)}>
                  <Plus className="size-4" />
                  Criar projeto
                </Button>
              )
            )
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b bg-secondary/60">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Projeto</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Saúde</th>
                  <th scope="col" className="px-4 py-3 font-medium">Prioridade</th>
                  <th scope="col" className="px-4 py-3 font-medium">Responsável</th>
                  <th scope="col" className="px-4 py-3 font-medium">Prazo</th>
                  <th scope="col" className="w-52 px-4 py-3 font-medium">Progresso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((project) => (
                  <tr key={project.id} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link href={`/projetos/${project.id}`} className="group block">
                        <span className="font-mono text-[11px] text-muted-foreground">{project.code}</span>
                        <span className="block font-medium group-hover:text-primary">{project.name}</span>
                        {project.department_name && (
                          <span className="text-xs text-muted-foreground">{project.department_name}</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="soft"
                        className={PROJECT_STATUS_META[project.status].className}
                        dot={PROJECT_STATUS_META[project.status].dot}
                      >
                        {PROJECT_STATUS_META[project.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="soft" className={HEALTH_META[project.health].className}>
                        {HEALTH_META[project.health].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="soft"
                        className={PRIORITY_META[project.priority].className}
                        dot={PRIORITY_META[project.priority].dot}
                      >
                        {PRIORITY_META[project.priority].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {project.responsibles?.length
                        ? project.responsibles.join(', ')
                        : (project.owner_name ?? '—')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{formatDate(project.due_date)}</span>
                      <span
                        className={cn(
                          'text-xs text-muted-foreground',
                          project.days_remaining < 0 && 'font-medium text-destructive',
                        )}
                      >
                        {formatDaysLabel(project.days_remaining)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressWithDelta
                          value={project.progress}
                          expected={project.expected_progress}
                          className="flex-1"
                        />
                        <span className="w-11 shrink-0 text-right text-xs font-semibold">
                          {formatPercent(project.progress)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ProjectFormDialog open={dialogOpen} onOpenChange={handleDialogChange} />
    </div>
  );
}
