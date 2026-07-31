'use client';

import * as React from 'react';
import { addDays, differenceInCalendarDays, format, isWeekend, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flag, GanttChartSquare, Minus, Plus, Route } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Hint } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { TASK_STATUS_META } from '@/lib/constants';
import { formatDate, formatDaysLabel, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GanttTask } from '@/types/database';

const ROW_HEIGHT = 44;
const LABEL_WIDTH = 260;
const ZOOM_STEPS = [12, 18, 26, 40];

interface Positioned extends GanttTask {
  offset: number;
  span: number;
  row: number;
}

function statusBar(task: GanttTask) {
  if (task.caminho_critico) return 'bg-gradient-to-r from-rose-500 to-rose-400';
  switch (task.status) {
    case 'concluido':
      return 'bg-moreno-green-500';
    case 'homologacao':
      return 'bg-amber-500';
    case 'em_desenvolvimento':
      return 'bg-moreno-lime-500';
    case 'planejamento':
      return 'bg-moreno-blue-400';
    default:
      return 'bg-slate-400';
  }
}

export function GanttChart({
  tasks,
  isLoading,
  showProject = false,
  onSelectTask,
}: {
  tasks: GanttTask[];
  isLoading?: boolean;
  showProject?: boolean;
  onSelectTask?: (task: GanttTask) => void;
}) {
  const [zoom, setZoom] = React.useState(1);
  const dayWidth = ZOOM_STEPS[zoom];

  const scheduled = React.useMemo(
    () => tasks.filter((task) => task.start_date && task.due_date),
    [tasks],
  );

  const range = React.useMemo(() => {
    if (!scheduled.length) return null;

    const starts = scheduled.map((task) => startOfDay(new Date(`${task.start_date}T00:00:00`)));
    const ends = scheduled.map((task) => startOfDay(new Date(`${task.due_date}T00:00:00`)));
    const min = addDays(new Date(Math.min(...starts.map((d) => d.getTime()))), -2);
    const max = addDays(new Date(Math.max(...ends.map((d) => d.getTime()))), 3);

    return { min, max, days: differenceInCalendarDays(max, min) + 1 };
  }, [scheduled]);

  const rows = React.useMemo<Positioned[]>(() => {
    if (!range) return [];
    return scheduled.map((task, index) => {
      const start = startOfDay(new Date(`${task.start_date}T00:00:00`));
      const end = startOfDay(new Date(`${task.due_date}T00:00:00`));
      return {
        ...task,
        offset: differenceInCalendarDays(start, range.min),
        span: Math.max(differenceInCalendarDays(end, start) + 1, 1),
        row: index,
      };
    });
  }, [scheduled, range]);

  const dependencies = React.useMemo(() => {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const links: { from: Positioned; to: Positioned }[] = [];

    rows.forEach((row) => {
      (row.predecessores ?? []).forEach((predecessorId) => {
        const from = byId.get(predecessorId);
        if (from) links.push({ from, to: row });
      });
    });

    return links;
  }, [rows]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!range || !rows.length) {
    return (
      <EmptyState
        icon={GanttChartSquare}
        title="Cronograma vazio"
        description="Defina data de início e fim nas tarefas para montar o Gantt."
      />
    );
  }

  const chartWidth = range.days * dayWidth;
  const todayOffset = differenceInCalendarDays(startOfDay(new Date()), range.min);
  const criticalCount = rows.filter((row) => row.caminho_critico).length;

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <GanttChartSquare className="size-4 text-primary" aria-hidden />
            Cronograma
          </h3>
          {criticalCount > 0 && (
            <Badge variant="soft" className="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
              <Route className="size-3" />
              {criticalCount} no caminho crítico
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-2 text-xs text-muted-foreground">{rows.length} tarefas</span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
            disabled={zoom === 0}
            aria-label="Reduzir zoom"
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setZoom((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
            disabled={zoom === ZOOM_STEPS.length - 1}
            aria-label="Aumentar zoom"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Coluna fixa com os nomes das tarefas */}
        <div className="shrink-0 border-r" style={{ width: LABEL_WIDTH }}>
          <div className="h-12 border-b bg-secondary/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tarefa
          </div>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelectTask?.(row)}
              className="flex w-full items-center gap-2 border-b px-3 text-left transition-colors hover:bg-secondary/50"
              style={{ height: ROW_HEIGHT }}
            >
              <span className={cn('size-1.5 shrink-0 rounded-full', TASK_STATUS_META[row.status].dot)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{row.title}</span>
                {showProject && (
                  <span className="block truncate text-[11px] text-muted-foreground">{row.project_code}</span>
                )}
              </span>
              {row.is_milestone && <Flag className="size-3.5 shrink-0 text-primary" aria-label="Marco" />}
            </button>
          ))}
        </div>

        {/* Área rolável do gráfico */}
        <div className="flex-1 overflow-x-auto scrollbar-thin">
          <div style={{ width: chartWidth }} className="relative">
            {/* Régua de datas */}
            <div className="sticky top-0 z-10 h-12 border-b bg-secondary/60">
              <div className="flex h-6 border-b">
                {Array.from({ length: range.days }).map((_, index) => {
                  const date = addDays(range.min, index);
                  const isFirstOfMonth = date.getDate() === 1 || index === 0;
                  if (!isFirstOfMonth) return null;
                  return (
                    <span
                      key={index}
                      className="absolute px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      style={{ left: index * dayWidth }}
                    >
                      {format(date, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                  );
                })}
              </div>
              <div className="flex h-6">
                {Array.from({ length: range.days }).map((_, index) => {
                  const date = addDays(range.min, index);
                  return (
                    <div
                      key={index}
                      className={cn(
                        'shrink-0 border-r text-center text-[10px] leading-6 text-muted-foreground',
                        isWeekend(date) && 'bg-secondary',
                      )}
                      style={{ width: dayWidth }}
                    >
                      {dayWidth >= 18 ? date.getDate() : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fundo com fins de semana */}
            <div className="pointer-events-none absolute inset-x-0 top-12 bottom-0 flex">
              {Array.from({ length: range.days }).map((_, index) => (
                <div
                  key={index}
                  className={cn('shrink-0 border-r border-border/50', isWeekend(addDays(range.min, index)) && 'bg-secondary/50')}
                  style={{ width: dayWidth }}
                />
              ))}
            </div>

            {/* Linha de hoje */}
            {todayOffset >= 0 && todayOffset < range.days && (
              <div
                className="pointer-events-none absolute top-12 bottom-0 z-20 w-0.5 bg-destructive"
                style={{ left: todayOffset * dayWidth + dayWidth / 2 }}
                aria-hidden
              >
                <span className="absolute -top-5 -translate-x-1/2 rounded bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                  hoje
                </span>
              </div>
            )}

            {/* Conectores de dependência */}
            <svg
              className="pointer-events-none absolute left-0 top-12 z-10"
              width={chartWidth}
              height={rows.length * ROW_HEIGHT}
              aria-hidden
            >
              {dependencies.map(({ from, to }, index) => {
                const x1 = (from.offset + from.span) * dayWidth;
                const y1 = from.row * ROW_HEIGHT + ROW_HEIGHT / 2;
                const x2 = to.offset * dayWidth;
                const y2 = to.row * ROW_HEIGHT + ROW_HEIGHT / 2;
                const midX = Math.max(x1 + 8, x2 - 8);

                return (
                  <g key={`${from.id}-${to.id}-${index}`} stroke="hsl(var(--muted-foreground))" strokeWidth={1.2}>
                    <path
                      d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
                      fill="none"
                      strokeDasharray="3 3"
                      opacity={0.7}
                    />
                    <polygon
                      points={`${x2},${y2} ${x2 - 5},${y2 - 3.5} ${x2 - 5},${y2 + 3.5}`}
                      fill="hsl(var(--muted-foreground))"
                      stroke="none"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Barras */}
            <div className="relative z-10">
              {rows.map((row) => (
                <div key={row.id} className="relative border-b" style={{ height: ROW_HEIGHT }}>
                  <Hint
                    label={
                      <span className="block space-y-0.5">
                        <span className="block font-semibold">{row.title}</span>
                        <span className="block">
                          {formatDate(row.start_date)} → {formatDate(row.due_date)}
                        </span>
                        <span className="block">
                          {row.duracao_dias_uteis} dias úteis · {formatPercent(row.progress)} concluído
                        </span>
                        <span className="block">
                          {row.dias_atraso > 0 ? `${row.dias_atraso} dia(s) de atraso` : formatDaysLabel(row.dias_restantes)}
                        </span>
                        {row.assignee_name && <span className="block">Responsável: {row.assignee_name}</span>}
                        {row.caminho_critico && <span className="block font-semibold">⚠ Caminho crítico</span>}
                      </span>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTask?.(row)}
                      className="absolute top-1/2 -translate-y-1/2 rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ left: row.offset * dayWidth + 1, width: Math.max(row.span * dayWidth - 2, 8) }}
                    >
                      {row.is_milestone ? (
                        <span className="flex h-5 items-center">
                          <span className="size-4 rotate-45 rounded-sm bg-primary shadow-sm" />
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'relative flex h-6 items-center overflow-hidden rounded-md shadow-sm',
                            statusBar(row),
                          )}
                        >
                          <span
                            className="absolute inset-y-0 left-0 bg-black/25"
                            style={{ width: `${row.progress}%` }}
                            aria-hidden
                          />
                          {row.span * dayWidth > 70 && (
                            <span className="relative truncate px-2 text-[11px] font-medium text-white">
                              {formatPercent(row.progress)}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  </Hint>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-4 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-moreno-lime-500" /> Em desenvolvimento
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-amber-500" /> Homologação
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-moreno-green-500" /> Concluído
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-rose-500" /> Caminho crítico
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rotate-45 rounded-sm bg-primary" /> Marco
        </span>
      </footer>
    </Card>
  );
}
