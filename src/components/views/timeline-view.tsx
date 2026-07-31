'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarRange, CheckCircle2, Circle, Flag } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PRIORITY_META, TASK_STATUS_META } from '@/lib/constants';
import { formatDate, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Milestone, TaskWithRelations } from '@/types/database';

type TimelineEntry = {
  id: string;
  date: string;
  title: string;
  kind: 'task' | 'milestone';
  task?: TaskWithRelations;
  milestone?: Milestone;
};

/** Linha do tempo cronológica das entregas e marcos do projeto. */
export function TimelineView({
  tasks,
  milestones = [],
  isLoading,
  onSelectTask,
}: {
  tasks: TaskWithRelations[];
  milestones?: Milestone[];
  isLoading?: boolean;
  onSelectTask?: (task: TaskWithRelations) => void;
}) {
  const grouped = React.useMemo(() => {
    const entries: TimelineEntry[] = [
      ...tasks
        .filter((task) => task.due_date)
        .map((task) => ({
          id: `task-${task.id}`,
          date: task.due_date as string,
          title: task.title,
          kind: 'task' as const,
          task,
        })),
      ...milestones.map((milestone) => ({
        id: `ms-${milestone.id}`,
        date: milestone.due_date,
        title: milestone.name,
        kind: 'milestone' as const,
        milestone,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const map = new Map<string, TimelineEntry[]>();
    entries.forEach((entry) => {
      const key = entry.date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), entry]);
    });

    return Array.from(map.entries());
  }, [tasks, milestones]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!grouped.length) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Sem eventos na linha do tempo"
        description="Defina prazos nas tarefas ou cadastre marcos para visualizar a evolução."
      />
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      {grouped.map(([month, entries]) => (
        <section key={month}>
          <h3 className="sticky top-16 z-10 mb-3 inline-flex rounded-full bg-gradient-brand px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
            {format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: ptBR })}
          </h3>

          <ol className="relative space-y-3 border-l-2 border-dashed pl-6">
            {entries.map((entry) => {
              const isPast = entry.date < today;
              const done =
                entry.kind === 'task'
                  ? entry.task?.status === 'concluido'
                  : entry.milestone?.status === 'concluido';

              return (
                <li key={entry.id} className="relative">
                  <span
                    className={cn(
                      'absolute -left-[31px] top-3 flex size-4 items-center justify-center rounded-full ring-4 ring-background',
                      done ? 'bg-success' : isPast ? 'bg-destructive' : 'bg-primary',
                    )}
                    aria-hidden
                  />

                  <Card
                    className={cn(
                      'p-3 transition-shadow hover:shadow-card-hover',
                      entry.kind === 'milestone' && 'border-primary/40 bg-primary/[0.03]',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => entry.task && onSelectTask?.(entry.task)}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      {entry.kind === 'milestone' ? (
                        <Flag className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      ) : done ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className={cn('font-medium', done && 'text-muted-foreground line-through')}>
                          {entry.title}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className={cn(isPast && !done && 'font-medium text-destructive')}>
                            {formatDate(entry.date)}
                          </span>
                          {entry.kind === 'milestone' ? (
                            <Badge variant="outline" className="text-[10px]">
                              Marco
                            </Badge>
                          ) : (
                            <>
                              <Badge
                                variant="soft"
                                className={cn('text-[10px]', TASK_STATUS_META[entry.task!.status].className)}
                                dot={TASK_STATUS_META[entry.task!.status].dot}
                              >
                                {TASK_STATUS_META[entry.task!.status].label}
                              </Badge>
                              <Badge
                                variant="soft"
                                className={cn('text-[10px]', PRIORITY_META[entry.task!.priority].className)}
                              >
                                {PRIORITY_META[entry.task!.priority].label}
                              </Badge>
                              <span>{formatPercent(entry.task!.progress)}</span>
                            </>
                          )}
                        </p>
                      </div>

                      {entry.task?.assignee && (
                        <UserAvatar
                          userId={entry.task.assignee.id}
                          name={entry.task.assignee.full_name}
                          src={entry.task.assignee.avatar_url}
                          className="size-7 shrink-0"
                        />
                      )}
                    </button>
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
