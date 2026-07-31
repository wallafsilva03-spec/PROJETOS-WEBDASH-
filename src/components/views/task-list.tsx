'use client';

import * as React from 'react';
import { ArrowUpDown, ChevronDown, ChevronRight, ListChecks, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { PRIORITY_META, TASK_STATUS_META } from '@/lib/constants';
import { formatDate, formatHours, formatPercent } from '@/lib/format';
import { cn, groupBy } from '@/lib/utils';
import { useUpdateTask } from '@/hooks/use-tasks';
import type { TaskWithRelations } from '@/types/database';

type GroupKey = 'status' | 'priority' | 'assignee' | 'none';
type SortKey = 'position' | 'due_date' | 'priority' | 'title' | 'progress';

const PRIORITY_ORDER = { critica: 4, alta: 3, media: 2, baixa: 1 } as const;

export function TaskList({
  projectId,
  tasks,
  isLoading,
}: {
  projectId: string;
  tasks: TaskWithRelations[];
  isLoading?: boolean;
}) {
  const updateTask = useUpdateTask(projectId);
  const [groupKey, setGroupKey] = React.useState<GroupKey>('status');
  const [sortKey, setSortKey] = React.useState<SortKey>('position');
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [dialogTask, setDialogTask] = React.useState<TaskWithRelations | null>(null);
  const [creating, setCreating] = React.useState(false);

  const sorted = React.useMemo(() => {
    const list = [...tasks];
    list.sort((a, b) => {
      switch (sortKey) {
        case 'due_date':
          return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
        case 'priority':
          return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
        case 'title':
          return a.title.localeCompare(b.title, 'pt-BR');
        case 'progress':
          return b.progress - a.progress;
        default:
          return a.position - b.position;
      }
    });
    return list;
  }, [tasks, sortKey]);

  const groups = React.useMemo(() => {
    if (groupKey === 'none') return [{ key: 'Todas as tarefas', items: sorted }];

    const map = groupBy(sorted, (task) => {
      if (groupKey === 'status') return TASK_STATUS_META[task.status].label;
      if (groupKey === 'priority') return PRIORITY_META[task.priority].label;
      return task.assignee?.full_name ?? 'Sem responsável';
    });

    return Object.entries(map).map(([key, items]) => ({ key, items }));
  }, [sorted, groupKey]);

  if (isLoading) return <SkeletonTable rows={8} />;

  if (!tasks.length) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nenhuma tarefa"
        description="Crie a primeira tarefa para montar o cronograma do projeto."
        action={
          <Button variant="brand" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Nova tarefa
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={groupKey} onValueChange={(value) => setGroupKey(value as GroupKey)}>
          <SelectTrigger className="w-48" aria-label="Agrupar por">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Agrupar por status</SelectItem>
            <SelectItem value="priority">Agrupar por prioridade</SelectItem>
            <SelectItem value="assignee">Agrupar por responsável</SelectItem>
            <SelectItem value="none">Sem agrupamento</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
          <SelectTrigger className="w-48" aria-label="Ordenar por">
            <ArrowUpDown className="mr-1 size-3.5 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="position">Ordem do quadro</SelectItem>
            <SelectItem value="due_date">Prazo</SelectItem>
            <SelectItem value="priority">Prioridade</SelectItem>
            <SelectItem value="progress">Progresso</SelectItem>
            <SelectItem value="title">Título</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="brand" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nova tarefa
        </Button>
      </div>

      {groups.map((group) => {
        const isCollapsed = collapsed[group.key];
        return (
          <Card key={group.key} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setCollapsed((state) => ({ ...state, [group.key]: !state[group.key] }))}
              className="flex w-full items-center gap-2 bg-secondary/60 px-4 py-2.5 text-left text-sm font-semibold"
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
              {group.key}
              <span className="rounded-full bg-card px-2 text-xs font-medium text-muted-foreground">
                {group.items.length}
              </span>
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="border-b">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="w-10 px-4 py-2" />
                      <th scope="col" className="px-2 py-2 font-medium">Tarefa</th>
                      <th scope="col" className="px-4 py-2 font-medium">Status</th>
                      <th scope="col" className="px-4 py-2 font-medium">Responsável</th>
                      <th scope="col" className="px-4 py-2 font-medium">Prazo</th>
                      <th scope="col" className="px-4 py-2 font-medium">Horas</th>
                      <th scope="col" className="w-40 px-4 py-2 font-medium">Progresso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {group.items.map((task) => {
                      const isLate =
                        task.due_date && task.status !== 'concluido' && new Date(task.due_date) < new Date();

                      return (
                        <tr key={task.id} className="transition-colors hover:bg-secondary/40">
                          <td className="px-4 py-2.5">
                            <Checkbox
                              checked={task.status === 'concluido'}
                              onCheckedChange={(checked) =>
                                updateTask.mutate({
                                  id: task.id,
                                  status: checked === true ? 'concluido' : 'em_desenvolvimento',
                                })
                              }
                              aria-label={`Concluir ${task.title}`}
                            />
                          </td>
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              onClick={() => setDialogTask(task)}
                              className="text-left font-medium hover:text-primary"
                            >
                              <span className={cn(task.status === 'concluido' && 'text-muted-foreground line-through')}>
                                {task.title}
                              </span>
                            </button>
                            <Badge
                              variant="soft"
                              className={cn('ml-2 text-[10px]', PRIORITY_META[task.priority].className)}
                              dot={PRIORITY_META[task.priority].dot}
                            >
                              {PRIORITY_META[task.priority].label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant="soft"
                              className={TASK_STATUS_META[task.status].className}
                              dot={TASK_STATUS_META[task.status].dot}
                            >
                              {TASK_STATUS_META[task.status].label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            {task.assignee ? (
                              <span className="flex items-center gap-2">
                                <UserAvatar
                                  userId={task.assignee.id}
                                  name={task.assignee.full_name}
                                  src={task.assignee.avatar_url}
                                  className="size-6"
                                />
                                <span className="truncate text-xs">{task.assignee.full_name}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className={cn('px-4 py-2.5 text-xs', isLate && 'font-medium text-destructive')}>
                            {formatDate(task.due_date)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {formatHours(task.estimated_hours)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Progress value={task.progress} className="h-1.5 flex-1" />
                              <span className="w-9 text-right text-xs">{formatPercent(task.progress)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}

      <TaskDialog
        projectId={projectId}
        open={Boolean(dialogTask)}
        onOpenChange={(open) => !open && setDialogTask(null)}
        task={dialogTask}
      />
      <TaskDialog projectId={projectId} open={creating} onOpenChange={setCreating} />
    </div>
  );
}
