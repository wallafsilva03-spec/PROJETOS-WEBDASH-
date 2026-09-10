'use client';

import * as React from 'react';
import { ArrowUpDown, ChevronDown, ChevronRight, CornerDownRight, ListChecks, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/misc';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { PRIORITY_META, TASK_STATUS_META } from '@/lib/constants';
import { formatHours, formatPercent } from '@/lib/format';
import { cn, groupBy } from '@/lib/utils';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import type { TaskWithRelations } from '@/types/database';

type GroupKey = 'status' | 'priority' | 'assignee' | 'none';
type SortKey = 'position' | 'due_date' | 'priority' | 'title' | 'progress';

const PRIORITY_ORDER = { critica: 4, alta: 3, media: 2, baixa: 1 } as const;

function isLateTask(task: TaskWithRelations) {
  return Boolean(task.due_date) && task.status !== 'concluido' && new Date(task.due_date as string) < new Date();
}

/** Célula de prazo editável no próprio grid — é assim que se dá prazo a cada subtarefa. */
function DueDateCell({
  task,
  onChange,
  saving,
}: {
  task: TaskWithRelations;
  onChange: (value: string | null) => void;
  saving?: boolean;
}) {
  return (
    <input
      type="date"
      value={task.due_date ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
      aria-label={`Prazo de ${task.title}`}
      className={cn(
        'w-[8.5rem] rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs',
        'hover:border-input focus:border-input focus:outline-none focus:ring-2 focus:ring-ring',
        !task.due_date && 'text-muted-foreground',
        isLateTask(task) && 'font-medium text-destructive',
        saving && 'opacity-60',
      )}
    />
  );
}

/* --------------------------------------------------------------- Subtarefa */
function SubtaskRow({
  task,
  projectId,
  onOpen,
}: {
  task: TaskWithRelations;
  projectId: string;
  onOpen: () => void;
}) {
  const updateTask = useUpdateTask(projectId);
  const status = TASK_STATUS_META[task.status];

  return (
    <tr className="bg-secondary/20 text-[13px] transition-colors hover:bg-secondary/40">
      <td className="py-2 pl-9 pr-2">
        <Checkbox
          checked={task.status === 'concluido'}
          onCheckedChange={(checked) =>
            updateTask.mutate({ id: task.id, status: checked === true ? 'concluido' : 'em_desenvolvimento' })
          }
          aria-label={`Concluir ${task.title}`}
        />
      </td>
      <td className="px-2 py-2">
        <span className="flex items-center gap-2">
          <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
          <button type="button" onClick={onOpen} className="text-left hover:text-primary">
            <span className={cn(task.status === 'concluido' && 'text-muted-foreground line-through')}>
              {task.title}
            </span>
          </button>
        </span>
      </td>
      <td className="px-4 py-2">
        <Badge variant="soft" className={cn('text-[10px]', status.className)} dot={status.dot}>
          {status.label}
        </Badge>
      </td>
      <td className="px-4 py-2">
        {task.assignee ? (
          <span className="flex items-center gap-2">
            <UserAvatar
              userId={task.assignee.id}
              name={task.assignee.full_name}
              src={task.assignee.avatar_url}
              className="size-5"
            />
            <span className="truncate text-xs">{task.assignee.full_name}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-2">
        <DueDateCell
          task={task}
          saving={updateTask.isPending}
          onChange={(value) => updateTask.mutate({ id: task.id, due_date: value })}
        />
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground">{formatHours(task.estimated_hours)}</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <Progress value={task.progress} className="h-1.5 flex-1" />
          <span className="w-9 text-right text-xs">{formatPercent(task.progress)}</span>
        </div>
      </td>
    </tr>
  );
}

/** Linha de criação rápida: título + prazo, direto na lista. */
function SubtaskComposer({ projectId, parentId }: { projectId: string; parentId: string }) {
  const createTask = useCreateTask(projectId);
  const [title, setTitle] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');

  async function submit() {
    const cleaned = title.trim();
    if (cleaned.length < 3) return;

    await createTask.mutateAsync({
      title: cleaned,
      parent_task_id: parentId,
      due_date: dueDate || null,
      status: 'backlog',
      priority: 'media',
    });

    setTitle('');
    setDueDate('');
  }

  return (
    <tr className="bg-secondary/20">
      <td className="py-2 pl-9 pr-2">
        <Plus className="size-4 text-muted-foreground" aria-hidden />
      </td>
      <td className="px-2 py-2" colSpan={3}>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Adicionar subtarefa e pressionar Enter"
          className="h-8 text-[13px]"
          aria-label="Título da subtarefa"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-label="Prazo da nova subtarefa"
          className="w-[8.5rem] rounded-md border border-input bg-transparent px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </td>
      <td className="px-4 py-2" colSpan={2}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void submit()}
          loading={createTask.isPending}
          disabled={title.trim().length < 3}
        >
          Adicionar
        </Button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------ Tarefa mãe */
function TaskRow({
  task,
  subtasks,
  projectId,
  expanded,
  onToggle,
  onOpen,
}: {
  task: TaskWithRelations;
  subtasks: TaskWithRelations[];
  projectId: string;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const updateTask = useUpdateTask(projectId);
  const status = TASK_STATUS_META[task.status];
  const priority = PRIORITY_META[task.priority];

  const doneSubtasks = subtasks.filter((item) => item.status === 'concluido').length;
  // Com subtarefas o progresso mostrado é a média delas; sem elas, o da própria tarefa.
  const progress = subtasks.length
    ? Math.round(subtasks.reduce((total, item) => total + item.progress, 0) / subtasks.length)
    : task.progress;

  return (
    <tr className="transition-colors hover:bg-secondary/40">
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? `Recolher subtarefas de ${task.title}` : `Abrir subtarefas de ${task.title}`}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          <Checkbox
            checked={task.status === 'concluido'}
            onCheckedChange={(checked) =>
              updateTask.mutate({ id: task.id, status: checked === true ? 'concluido' : 'em_desenvolvimento' })
            }
            aria-label={`Concluir ${task.title}`}
          />
        </div>
      </td>
      <td className="px-2 py-2.5">
        <button type="button" onClick={onOpen} className="text-left font-medium hover:text-primary">
          <span className={cn(task.status === 'concluido' && 'text-muted-foreground line-through')}>{task.title}</span>
        </button>
        <Badge variant="soft" className={cn('ml-2 text-[10px]', priority.className)} dot={priority.dot}>
          {priority.label}
        </Badge>
        {subtasks.length > 0 && (
          <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {doneSubtasks}/{subtasks.length} subtarefas
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <Badge variant="soft" className={status.className} dot={status.dot}>
          {status.label}
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
      <td className="px-2 py-2.5">
        <DueDateCell
          task={task}
          saving={updateTask.isPending}
          onChange={(value) => updateTask.mutate({ id: task.id, due_date: value })}
        />
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatHours(task.estimated_hours)}</td>
      <td className="px-4 py-2.5">
        <div
          className="flex items-center gap-2"
          title={subtasks.length ? 'Média do progresso das subtarefas' : undefined}
        >
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="w-9 text-right text-xs">{formatPercent(progress)}</span>
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ Lista */
export function TaskList({
  projectId,
  tasks,
  isLoading,
}: {
  projectId: string;
  tasks: TaskWithRelations[];
  isLoading?: boolean;
}) {
  const [groupKey, setGroupKey] = React.useState<GroupKey>('status');
  const [sortKey, setSortKey] = React.useState<SortKey>('position');
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [dialogTask, setDialogTask] = React.useState<TaskWithRelations | null>(null);
  const [creating, setCreating] = React.useState(false);

  // Subtarefas ficam sob a tarefa mãe; só as principais entram no agrupamento.
  const { parents, childrenOf } = React.useMemo(() => {
    const byParent = new Map<string, TaskWithRelations[]>();
    const roots: TaskWithRelations[] = [];

    for (const task of tasks) {
      if (task.parent_task_id) {
        const siblings = byParent.get(task.parent_task_id) ?? [];
        siblings.push(task);
        byParent.set(task.parent_task_id, siblings);
      } else {
        roots.push(task);
      }
    }

    // Uma subtarefa órfã (mãe filtrada/removida) vira tarefa principal na lista.
    const ids = new Set(tasks.map((task) => task.id));
    for (const [parentId, children] of byParent) {
      if (!ids.has(parentId)) {
        roots.push(...children);
        byParent.delete(parentId);
      }
    }

    for (const children of byParent.values()) {
      children.sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.position - b.position);
    }

    return { parents: roots, childrenOf: byParent };
  }, [tasks]);

  const sorted = React.useMemo(() => {
    const list = [...parents];
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
  }, [parents, sortKey]);

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
      <>
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
        <TaskDialog projectId={projectId} open={creating} onOpenChange={setCreating} />
      </>
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
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="border-b">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="w-16 px-2 py-2" />
                      <th scope="col" className="px-2 py-2 font-medium">Tarefa</th>
                      <th scope="col" className="px-4 py-2 font-medium">Status</th>
                      <th scope="col" className="px-4 py-2 font-medium">Responsável</th>
                      <th scope="col" className="px-2 py-2 font-medium">Prazo</th>
                      <th scope="col" className="px-4 py-2 font-medium">Horas</th>
                      <th scope="col" className="w-40 px-4 py-2 font-medium">Progresso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {group.items.map((task) => {
                      const subtasks = childrenOf.get(task.id) ?? [];
                      const isExpanded = expanded[task.id] ?? false;

                      return (
                        <React.Fragment key={task.id}>
                          <TaskRow
                            task={task}
                            subtasks={subtasks}
                            projectId={projectId}
                            expanded={isExpanded}
                            onToggle={() => setExpanded((state) => ({ ...state, [task.id]: !state[task.id] }))}
                            onOpen={() => setDialogTask(task)}
                          />

                          {isExpanded && (
                            <>
                              {subtasks.map((subtask) => (
                                <SubtaskRow
                                  key={subtask.id}
                                  task={subtask}
                                  projectId={projectId}
                                  onOpen={() => setDialogTask(subtask)}
                                />
                              ))}
                              <SubtaskComposer projectId={projectId} parentId={task.id} />
                            </>
                          )}
                        </React.Fragment>
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
