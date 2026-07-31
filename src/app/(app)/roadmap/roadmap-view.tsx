'use client';

import * as React from 'react';
import Link from 'next/link';
import { addMonths, differenceInCalendarMonths, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flag, Map as MapIcon } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Hint } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useRoadmap } from '@/hooks/use-analytics';
import { HEALTH_META, PROJECT_STATUS_META } from '@/lib/constants';
import { formatDate, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { RoadmapRow } from '@/types/database';

const MONTH_WIDTH = 132;
const LABEL_WIDTH = 240;

interface RoadmapProject {
  id: string;
  code: string;
  name: string;
  status: RoadmapRow['status'];
  health: RoadmapRow['health'];
  progress: number;
  start: Date;
  end: Date;
  department: string | null;
  owner: string | null;
  milestones: { id: string; name: string; date: Date; status: string | null }[];
}

export function RoadmapView() {
  const { data, isLoading } = useRoadmap();

  const projects = React.useMemo<RoadmapProject[]>(() => {
    const map = new Map<string, RoadmapProject>();

    (data ?? []).forEach((row) => {
      const existing = map.get(row.project_id);
      const project: RoadmapProject = existing ?? {
        id: row.project_id,
        code: row.code,
        name: row.name,
        status: row.status,
        health: row.health,
        progress: row.progress,
        start: new Date(`${row.start_date}T00:00:00`),
        end: new Date(`${row.due_date}T00:00:00`),
        department: row.department_name,
        owner: row.owner_name,
        milestones: [],
      };

      if (row.milestone_id && row.milestone_date) {
        project.milestones.push({
          id: row.milestone_id,
          name: row.milestone_name ?? 'Marco',
          date: new Date(`${row.milestone_date}T00:00:00`),
          status: row.milestone_status,
        });
      }

      map.set(row.project_id, project);
    });

    return Array.from(map.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [data]);

  const range = React.useMemo(() => {
    if (!projects.length) return null;
    const min = startOfMonth(new Date(Math.min(...projects.map((p) => p.start.getTime()))));
    const max = startOfMonth(addMonths(new Date(Math.max(...projects.map((p) => p.end.getTime()))), 1));
    return { min, months: differenceInCalendarMonths(max, min) + 1 };
  }, [projects]);

  /** Converte uma data em pixels dentro da faixa de meses. */
  function toX(date: Date) {
    if (!range) return 0;
    const months = differenceInCalendarMonths(date, range.min);
    const dayFraction = (date.getDate() - 1) / 30;
    return (months + dayFraction) * MONTH_WIDTH;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Direção"
        title="Roadmap executivo"
        description="Projetos por linha, meses na horizontal, marcos e percentual de conclusão."
      />

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !range || !projects.length ? (
        <EmptyState
          icon={MapIcon}
          title="Roadmap vazio"
          description="Cadastre projetos com datas de início e prazo para montar o roadmap."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex">
            <div className="shrink-0 border-r" style={{ width: LABEL_WIDTH }}>
              <div className="h-11 border-b bg-secondary/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Projeto
              </div>
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projetos/${project.id}`}
                  className="flex h-16 flex-col justify-center border-b px-4 transition-colors hover:bg-secondary/50"
                >
                  <span className="truncate text-sm font-medium">{project.name}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {project.code}
                    {project.department && ` · ${project.department}`}
                  </span>
                </Link>
              ))}
            </div>

            <div className="flex-1 overflow-x-auto scrollbar-thin">
              <div style={{ width: range.months * MONTH_WIDTH }} className="relative">
                <div className="flex h-11 border-b bg-secondary/60">
                  {Array.from({ length: range.months }).map((_, index) => (
                    <div
                      key={index}
                      className="shrink-0 border-r px-3 py-3 text-xs font-semibold capitalize text-muted-foreground"
                      style={{ width: MONTH_WIDTH }}
                    >
                      {format(addMonths(range.min, index), 'MMM/yy', { locale: ptBR })}
                    </div>
                  ))}
                </div>

                <div className="pointer-events-none absolute inset-x-0 top-11 bottom-0 flex">
                  {Array.from({ length: range.months }).map((_, index) => (
                    <div key={index} className="shrink-0 border-r border-border/60" style={{ width: MONTH_WIDTH }} />
                  ))}
                </div>

                <div
                  className="pointer-events-none absolute top-11 bottom-0 z-20 w-0.5 bg-destructive"
                  style={{ left: toX(new Date()) }}
                  aria-hidden
                />

                <div className="relative z-10">
                  {projects.map((project) => {
                    const left = toX(project.start);
                    const width = Math.max(toX(project.end) - left, 24);
                    const health = HEALTH_META[project.health];

                    return (
                      <div key={project.id} className="relative h-16 border-b">
                        <Hint
                          label={
                            <span className="block space-y-0.5">
                              <span className="block font-semibold">{project.name}</span>
                              <span className="block">
                                {formatDate(project.start)} → {formatDate(project.end)}
                              </span>
                              <span className="block">
                                {formatPercent(project.progress)} concluído · {health.label}
                              </span>
                              {project.owner && <span className="block">Gestor: {project.owner}</span>}
                            </span>
                          }
                        >
                          <Link
                            href={`/projetos/${project.id}`}
                            className="absolute top-1/2 flex h-9 -translate-y-1/2 items-center overflow-hidden rounded-lg bg-gradient-brand shadow-sm transition-transform hover:scale-[1.01]"
                            style={{ left, width }}
                          >
                            <span
                              className="absolute inset-y-0 left-0 bg-white/25"
                              style={{ width: `${project.progress}%` }}
                              aria-hidden
                            />
                            {width > 90 && (
                              <span className="relative flex items-center gap-1.5 truncate px-2.5 text-[11px] font-semibold text-white">
                                {formatPercent(project.progress)}
                                <span className="opacity-80">· {PROJECT_STATUS_META[project.status].label}</span>
                              </span>
                            )}
                          </Link>
                        </Hint>

                        {project.milestones.map((milestone) => (
                          <Hint
                            key={milestone.id}
                            label={`${milestone.name} — ${formatDate(milestone.date)}`}
                          >
                            <span
                              className={cn(
                                'absolute top-1/2 z-20 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-card',
                                milestone.status === 'concluido' ? 'bg-success' : 'bg-moreno-blue-700',
                              )}
                              style={{ left: toX(milestone.date) }}
                            >
                              <Flag className="size-2.5 text-white" aria-hidden />
                            </span>
                          </Hint>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <footer className="flex flex-wrap items-center gap-4 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-6 rounded-sm bg-gradient-brand" /> Duração do projeto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-moreno-blue-700" /> Marco planejado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-success" /> Marco concluído
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-destructive" /> Hoje
            </span>
          </footer>
        </Card>
      )}

      {projects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(HEALTH_META).map(([key, meta]) => {
            const total = projects.filter((project) => project.health === key).length;
            if (!total) return null;
            return (
              <Badge key={key} variant="soft" className={meta.className}>
                {meta.label}: {total}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
