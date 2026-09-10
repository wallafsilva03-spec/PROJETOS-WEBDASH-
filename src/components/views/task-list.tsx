'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, CornerDownRight, Dot, ListChecks, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/misc';
import { Input } from '@/components/ui/input';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { PRIORITY_META, TASK_STATUS_META } from '@/lib/constants';
import { formatHours, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  MAX_TASK_DEPTH,
  TASK_LEVELS,
  buildTaskColumns,
  collectDescendants,
  isLateTask,
  sortTasks,
  splitSubtasks,
  taskColumnId,
  type TaskColumn,
  type TaskGroupKey,
  type TaskSortKey,
} from '@/lib/task-grouping';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import type { TaskWithRelations } from '@/types/database';

/** Recuo de cada nível, em rem — o que dá a leitura de árvore. */
const INDENT = ['0.5rem', '2.25rem', '4rem'];

/** Célula de prazo editável no próprio grid — cada nível tem o prazo dele. */
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

/** Linha de criação rápida do nível de baixo: título + prazo, direto na lista. */
function ChildComposer({
  projectId,
  parentId,
  depth,
}: {
  projectId: string;
  parentId: string;
  /** Nível de quem está sendo criado (1 = subtarefa, 2 = item). */
  depth: number;
}) {
  const createTask = useCreateTask(projectId);
  const [title, setTitle] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const level = TASK_LEVELS[depth];

  async function submit() {
    const cleaned = title.trim();
    if (cleaned.length < 3) return;

    await createTask.mutateAsync({
      title: cleaned,
      parent_task_id: parentId,
      due_date: dueDate || null,
      status: 'nao_iniciado',
      priority: 'media',
    });

    setTitle('');
    setDueDate('');
  }

  return (
    <tr className={depth === 1 ? 'bg-secondary/20' : 'bg-secondary/30'}>
      <td className="py-2 pr-2" style={{ paddingLeft: INDENT[depth] }}>
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
          placeholder={`Adicionar ${level.singular} e pressionar Enter`}
          className="h-8 text-[13px]"
          aria-label={`Título d${level.article} ${level.singular}`}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-label={`Prazo d${level.article} ${level.singular}`}
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

/* -------------------------------------------------------------------- Linha */
/**
 * Uma linha serve aos três níveis — tarefa, subtarefa e item. O que muda é o
 * recuo, o peso do texto e o ícone; a mecânica (prazo, status, concluir) é a
 * mesma, porque no banco os três são a mesma tabela.
 */
function TaskRow({
  task,
  depth,
  childrenOf,
  projectId,
  expanded,
  onToggle,
  onOpen,
}: {
  task: TaskWithRelations;
  depth: number;
  childrenOf: Map<string, TaskWithRelations[]>;
  projectId: string;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const updateTask = useUpdateTask(projectId);
  const status = TASK_STATUS_META[task.status];
  const priority = PRIORITY_META[task.priority];

  const children = childrenOf.get(task.id) ?? [];
  const doneChildren = children.filter((item) => item.status === 'concluido').length;
  const childLevel = TASK_LEVELS[depth + 1];

  // Com filhos, o progresso mostrado é a média deles — o mesmo que o banco grava.
  const progress = children.length
    ? Math.round(children.reduce((total, item) => total + item.progress, 0) / children.length)
    : task.progress;

  /**
   * Concluir uma linha conclui tudo que está abaixo dela. É o caminho inverso
   * do gatilho do banco (fechou os filhos, fecha o pai); sem isto, um pai
   * fechado à mão com filho aberto seria reaberto na próxima mexida no filho.
   */
  function toggleDone(done: boolean) {
    const status = done ? 'concluido' : 'em_desenvolvimento';
    updateTask.mutate({ id: task.id, status });
    for (const descendant of collectDescendants(task.id, childrenOf)) {
      if ((descendant.status === 'concluido') !== done) {
        updateTask.mutate({ id: descendant.id, status });
      }
    }
  }

  const canHaveChildren = depth < MAX_TASK_DEPTH;

  return (
    <tr
      className={cn(
        'transition-colors hover:bg-secondary/40',
        depth === 1 && 'bg-secondary/20 text-[13px]',
        depth === 2 && 'bg-secondary/30 text-[13px]',
      )}
    >
      <td className="py-2.5 pr-2" style={{ paddingLeft: INDENT[depth] }}>
        <div className="flex items-center gap-1">
          {canHaveChildren ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? `Recolher ${childLevel.plural} de ${task.title}`
                  : `Abrir ${childLevel.plural} de ${task.title}`
              }
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <span className="w-5" aria-hidden />
          )}
          <Checkbox
            checked={task.status === 'concluido'}
            onCheckedChange={(checked) => toggleDone(checked === true)}
            aria-label={
              children.length
                ? `Concluir ${task.title} e o que está abaixo dela`
                : `Concluir ${task.title}`
            }
          />
        </div>
      </td>

      <td className="px-2 py-2.5">
        <span className="flex items-center gap-2">
          {depth === 1 && <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
          {depth === 2 && <Dot className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />}
          <button
            type="button"
            onClick={onOpen}
            className={cn('text-left hover:text-primary', depth === 0 && 'font-medium')}
          >
            <span className={cn(task.status === 'concluido' && 'text-muted-foreground line-through')}>
              {task.title}
            </span>
          </button>
        </span>
        <span className="ml-6 inline-flex items-center gap-2">
          {depth === 0 && (
            <Badge variant="soft" className={cn('text-[10px]', priority.className)} dot={priority.dot}>
              {priority.label}
            </Badge>
          )}
          {children.length > 0 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {doneChildren}/{children.length} {childLevel.plural}
            </span>
          )}
        </span>
      </td>

      <td className="px-4 py-2.5">
        <Badge variant="soft" className={cn(depth > 0 && 'text-[10px]', status.className)} dot={status.dot}>
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
              className={depth === 0 ? 'size-6' : 'size-5'}
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
          title={children.length ? `Média do progresso ${childLevel.of}` : undefined}
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
  groupKey = 'status',
  sortKey = 'position',
  columns,
  onCreateTask,
}: {
  projectId: string;
  tasks: TaskWithRelations[];
  isLoading?: boolean;
  /** Mesmo agrupamento usado pelas colunas do Kanban. */
  groupKey?: TaskGroupKey;
  sortKey?: TaskSortKey;
  /** Grupos na mesma ordem das colunas do Kanban. */
  columns?: TaskColumn[];
  onCreateTask?: () => void;
}) {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [dialogTask, setDialogTask] = React.useState<TaskWithRelations | null>(null);

  // Só as tarefas de topo entram no agrupamento; o resto pendura por baixo.
  const { parents, childrenOf } = React.useMemo(() => splitSubtasks(tasks), [tasks]);
  const sorted = React.useMemo(() => sortTasks(parents, sortKey), [parents, sortKey]);

  // Os grupos seguem a ordem das colunas do Kanban — é a mesma visão, só mudou o formato.
  const groups = React.useMemo(() => {
    const list = columns ?? buildTaskColumns(groupKey, tasks);
    return list
      .map((column) => ({
        key: column.id,
        label: column.label,
        accent: column.accent,
        items: sorted.filter((task) => taskColumnId(task, groupKey) === column.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [columns, groupKey, sorted, tasks]);

  /** Desenha a linha e, aberta, os filhos dela — até o terceiro nível. */
  const renderRows = React.useCallback(
    (task: TaskWithRelations, depth: number): React.ReactNode => {
      const isExpanded = expanded[task.id] ?? false;
      const children = childrenOf.get(task.id) ?? [];

      return (
        <React.Fragment key={task.id}>
          <TaskRow
            task={task}
            depth={depth}
            childrenOf={childrenOf}
            projectId={projectId}
            expanded={isExpanded}
            onToggle={() => setExpanded((state) => ({ ...state, [task.id]: !state[task.id] }))}
            onOpen={() => setDialogTask(task)}
          />

          {isExpanded && depth < MAX_TASK_DEPTH && (
            <>
              {children.map((child) => renderRows(child, depth + 1))}
              <ChildComposer projectId={projectId} parentId={task.id} depth={depth + 1} />
            </>
          )}
        </React.Fragment>
      );
    },
    [childrenOf, expanded, projectId],
  );

  if (isLoading) return <SkeletonTable rows={8} />;

  if (!tasks.length) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nenhuma tarefa"
        description="Crie a primeira tarefa para montar o cronograma do projeto."
        action={
          onCreateTask && (
            <Button variant="brand" onClick={onCreateTask}>
              <Plus className="size-4" />
              Nova tarefa
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="space-y-3">
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
              <span className={cn('size-2 rounded-full', group.accent)} aria-hidden />
              {group.label}
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
                  <tbody className="divide-y">{group.items.map((task) => renderRows(task, 0))}</tbody>
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
    </div>
  );
}
