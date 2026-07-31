'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FolderKanban, LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
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
import { formatDate, formatDaysLabel, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { HealthStatus, ProjectStatus } from '@/types/database';

const ALL = '__all__';
type ViewMode = 'grid' | 'table';

export function ProjectsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canCreateProject } = useSession();
  const departments = useDepartments();

  const [dialogOpen, setDialogOpen] = React.useState(searchParams.get('novo') === '1');
  const [view, setView] = React.useState<ViewMode>('grid');
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<ProjectStatus | typeof ALL>(ALL);
  const [health, setHealth] = React.useState<HealthStatus | typeof ALL>(ALL);
  const [departmentId, setDepartmentId] = React.useState<string>(ALL);
  const [sort, setSort] = React.useState<NonNullable<ProjectFilters['sort']>>('due_date');

  const debouncedSearch = useDebouncedValue(search, 300);

  const filters = React.useMemo<ProjectFilters>(
    () => ({
      search: debouncedSearch || undefined,
      status: status === ALL ? undefined : [status],
      health: health === ALL ? undefined : [health],
      departmentId: departmentId === ALL ? undefined : departmentId,
      sort,
    }),
    [debouncedSearch, status, health, departmentId, sort],
  );

  const { data, isLoading, isError, refetch } = useProjects(filters);
  const projects = data ?? [];
  const hasFilters = Boolean(debouncedSearch) || status !== ALL || health !== ALL || departmentId !== ALL;

  function clearFilters() {
    setSearch('');
    setStatus(ALL);
    setHealth(ALL);
    setDepartmentId(ALL);
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open && searchParams.get('novo')) router.replace('/projetos');
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
            <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus | typeof ALL)}>
              <SelectTrigger className="lg:w-44" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={health} onValueChange={(value) => setHealth(value as HealthStatus | typeof ALL)}>
              <SelectTrigger className="lg:w-40" aria-label="Filtrar por saúde">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toda saúde</SelectItem>
                {Object.entries(HEALTH_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={departmentId} onValueChange={setDepartmentId}>
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

            <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
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

        {hasFilters && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {projects.length} projeto(s) com os filtros aplicados
            </span>
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
                    <td className="px-4 py-3 text-muted-foreground">{project.owner_name ?? '—'}</td>
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
