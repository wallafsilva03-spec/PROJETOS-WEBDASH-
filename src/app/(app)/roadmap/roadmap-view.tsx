'use client';

import * as React from 'react';
import Link from 'next/link';
import { ExternalLink, Map as MapIcon, X } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { RoadmapTimeline, type RoadmapGroup, type RoadmapItem } from '@/components/views/roadmap-timeline';
import { stageRoadmapItems } from '@/components/views/stages-roadmap';
import { useRoadmap } from '@/hooks/use-analytics';
import { useStages } from '@/hooks/use-project-details';
import { HEALTH_META, PROJECT_STATUS_META, PROJECT_STATUS_OPTIONS } from '@/lib/constants';
import { ALL, portfolioHref } from '@/lib/project-filters';
import { formatDate, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { HealthStatus, ProjectStageView, ProjectStatus, RoadmapRow } from '@/types/database';

type GroupBy = 'nenhum' | 'atividade' | 'saude' | 'departamento' | 'responsavel';

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'nenhum', label: 'Sem agrupamento' },
  { value: 'atividade', label: 'Atividade (status)' },
  { value: 'saude', label: 'Saúde do projeto' },
  { value: 'departamento', label: 'Departamento' },
  { value: 'responsavel', label: 'Responsável' },
];

interface RoadmapProject {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  health: HealthStatus;
  progress: number;
  start: Date;
  end: Date;
  department: string | null;
  owner: string | null;
  milestones: { id: string; name: string; date: Date; done: boolean }[];
}

/** Agrupa as linhas da view `v_roadmap` (uma por marco) em projetos. */
function toProjects(rows: RoadmapRow[]): RoadmapProject[] {
  const map = new Map<string, RoadmapProject>();

  rows.forEach((row) => {
    const project =
      map.get(row.project_id) ??
      ({
        id: row.project_id,
        code: row.code,
        name: row.name,
        status: row.status,
        health: row.health,
        progress: Number(row.progress),
        start: new Date(`${row.start_date}T00:00:00`),
        end: new Date(`${row.due_date}T00:00:00`),
        department: row.department_name,
        owner: row.owner_name,
        milestones: [],
      } satisfies RoadmapProject);

    if (row.milestone_id && row.milestone_date) {
      project.milestones.push({
        id: row.milestone_id,
        name: `${row.milestone_name ?? 'Marco'} — ${formatDate(row.milestone_date)}`,
        date: new Date(`${row.milestone_date}T00:00:00`),
        done: row.milestone_status === 'concluido',
      });
    }

    map.set(row.project_id, project);
  });

  return [...map.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function RoadmapView() {
  const roadmap = useRoadmap();
  // Um fetch só traz as etapas de todo o portfólio; abrir um projeto não
  // dispara consulta nova.
  const stages = useStages();

  const [groupBy, setGroupBy] = React.useState<GroupBy>('nenhum');
  const [health, setHealth] = React.useState<HealthStatus | typeof ALL>(ALL);
  const [status, setStatus] = React.useState<ProjectStatus | typeof ALL>(ALL);
  const [showStages, setShowStages] = React.useState(false);

  const projects = React.useMemo(() => toProjects(roadmap.data ?? []), [roadmap.data]);

  const stagesByProject = React.useMemo(() => {
    const map = new Map<string, ProjectStageView[]>();
    (stages.data ?? []).forEach((stage) => {
      if (stage.status === 'cancelada') return;
      const list = map.get(stage.project_id) ?? [];
      list.push(stage);
      map.set(stage.project_id, list);
    });
    return map;
  }, [stages.data]);

  const visible = React.useMemo(
    () =>
      projects.filter(
        (project) =>
          (health === ALL || project.health === health) &&
          (status === ALL || project.status === status),
      ),
    [projects, health, status],
  );

  const items = React.useMemo<RoadmapItem[]>(
    () =>
      visible.map((project) => {
        const healthMeta = HEALTH_META[project.health];
        const statusMeta = PROJECT_STATUS_META[project.status];
        const projectStages = stagesByProject.get(project.id) ?? [];

        return {
          id: project.id,
          label: project.name,
          sublabel: [project.code, project.department].filter(Boolean).join(' · '),
          start: project.start,
          end: project.end,
          progress: project.progress,
          caption: statusMeta.label,
          accentClassName: healthMeta.dot,
          late: project.health === 'atrasado' || project.health === 'critico',
          href: `/projetos/${project.id}`,
          markers: project.milestones.map((milestone) => ({
            id: milestone.id,
            label: milestone.name,
            date: milestone.date,
            done: milestone.done,
          })),
          children: stageRoadmapItems(projectStages),
          tooltip: (
            <span className="block space-y-0.5">
              <span className="block font-semibold">{project.name}</span>
              <span className="block">
                {formatDate(project.start)} → {formatDate(project.end)}
              </span>
              <span className="block">
                {formatPercent(project.progress)} concluído · {statusMeta.label} · {healthMeta.label}
              </span>
              {project.owner && <span className="block">Gestor: {project.owner}</span>}
              <span className="block opacity-80">
                {projectStages.length
                  ? `${projectStages.length} etapa(s) — clique na seta para abrir`
                  : 'Sem etapas cadastradas'}
              </span>
            </span>
          ),
        } satisfies RoadmapItem;
      }),
    [visible, stagesByProject],
  );

  const groups = React.useMemo<RoadmapGroup[]>(() => {
    if (groupBy === 'nenhum') return [{ key: 'todos', label: 'Portfólio', items }];

    const keyOf = (project: RoadmapProject) => {
      if (groupBy === 'atividade') return PROJECT_STATUS_META[project.status].label;
      if (groupBy === 'saude') return HEALTH_META[project.health].label;
      if (groupBy === 'departamento') return project.department ?? 'Sem departamento';
      return project.owner ?? 'Sem responsável';
    };

    // A ordem dos grupos segue a dos enums (do início ao fim do ciclo, do
    // pior para o melhor estado de saúde); os textos livres vão em ordem
    // alfabética, depois deles.
    const order =
      groupBy === 'atividade'
        ? PROJECT_STATUS_OPTIONS.map((option) => option.label)
        : groupBy === 'saude'
          ? Object.values(HEALTH_META).map((meta) => meta.label)
          : [];

    const byId = new Map(items.map((item) => [item.id, item]));
    const buckets = new Map<string, RoadmapItem[]>();

    visible.forEach((project) => {
      const item = byId.get(project.id);
      if (!item) return;
      const key = keyOf(project);
      buckets.set(key, [...(buckets.get(key) ?? []), item]);
    });

    return [...buckets.entries()]
      .sort(([a], [b]) => {
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);
        if (indexA !== -1 || indexB !== -1) return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        return a.localeCompare(b, 'pt-BR');
      })
      .map(([key, list]) => ({ key, label: key, items: list }));
  }, [groupBy, items, visible]);

  const expandedIds = React.useMemo(
    () => (showStages ? visible.map((project) => project.id) : []),
    [showStages, visible],
  );

  const hasFilters = health !== ALL || status !== ALL;
  const isLoading = roadmap.isLoading;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Direção"
        title="Roadmap executivo"
        description="Projetos por linha, meses na horizontal, marcos e percentual de conclusão. Abra um projeto na seta ao lado do nome para ver as etapas dele na mesma linha do tempo."
        actions={
          <Button variant="outline" asChild>
            <Link
              href={portfolioHref({
                saude: health === ALL ? undefined : health,
                status: status === ALL ? undefined : status,
              })}
            >
              <ExternalLink className="size-4" />
              Ver no portfólio
            </Link>
          </Button>
        }
      />

      {/* Saúde e atividade: contam o portfólio inteiro e filtram no clique. */}
      <section aria-label="Saúde do portfólio" className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Object.entries(HEALTH_META).map(([key, meta]) => {
          const total = projects.filter((project) => project.health === key).length;
          const active = health === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setHealth(active ? ALL : (key as HealthStatus))}
              aria-pressed={active}
              className={cn(
                'rounded-xl border bg-card p-4 text-left transition-all hover:shadow-card-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && 'border-primary ring-1 ring-primary',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className={cn('size-2 rounded-full', meta.dot)} aria-hidden />
                {meta.label}
              </span>
              <p className="font-display text-2xl font-semibold">{isLoading ? '—' : total}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{meta.description}</p>
            </button>
          );
        })}
      </section>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
            <SelectTrigger className="lg:w-56" aria-label="Visualizar por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  Visualizar por: {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value) => setStatus(value as ProjectStatus | typeof ALL)}
          >
            <SelectTrigger className="lg:w-52" aria-label="Filtrar por atividade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toda atividade</SelectItem>
              {PROJECT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={showStages} onCheckedChange={setShowStages} />
            Abrir as etapas de todos os projetos
          </label>

          <span className="text-xs text-muted-foreground lg:ml-auto">
            {visible.length} de {projects.length} projeto(s)
            {stages.data && ` · ${stages.data.length} etapa(s)`}
          </span>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setHealth(ALL);
                setStatus(ALL);
              }}
            >
              <X className="size-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Atividade do portfólio — uma etiqueta por status, clicável. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
          {PROJECT_STATUS_OPTIONS.map((option) => {
            const total = projects.filter((project) => project.status === option.value).length;
            const active = status === option.value;
            const meta = PROJECT_STATUS_META[option.value];

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(active ? ALL : option.value)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:border-primary hover:text-primary',
                  !total && 'opacity-50',
                )}
              >
                <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
                {option.label}
                <span className="text-muted-foreground">{total}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !visible.length ? (
        <EmptyState
          icon={MapIcon}
          title={hasFilters ? 'Nenhum projeto neste estado' : 'Roadmap vazio'}
          description={
            hasFilters
              ? 'Nenhum projeto do portfólio está neste estado agora.'
              : 'Cadastre projetos com datas de início e prazo para montar o roadmap.'
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setHealth(ALL);
                  setStatus(ALL);
                }}
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <RoadmapTimeline
          groups={groups}
          showGroups={groupBy !== 'nenhum'}
          expandedIds={expandedIds}
          footer={
            <>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded-sm bg-gradient-brand" /> Duração do projeto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded-sm bg-moreno-lime-500" /> Etapa (cor pela situação)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-moreno-blue-700" /> Marco planejado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-success" /> Marco concluído
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-6 rounded-sm ring-2 ring-destructive/70" /> Em atraso
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-0.5 bg-destructive" /> Hoje
              </span>
            </>
          }
        />
      )}
    </div>
  );
}
