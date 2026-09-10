'use client';

import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { CalendarDays, Clock, CornerDownRight, Flag, ListTree, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { KANBAN_COLUMNS, PRIORITY_META } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  NO_ASSIGNEE,
  buildTaskColumns,
  splitSubtasks,
  taskColumnId,
  type TaskColumn,
  type TaskGroupKey,
} from '@/lib/task-grouping';
import { useMoveTask, useUpdateTask } from '@/hooks/use-tasks';
import { useProjectMembers } from '@/hooks/use-projects';
import type { PriorityLevel, TaskStatus, TaskWithRelations } from '@/types/database';

/* ------------------------------------------------------------------ Card */
function TaskCard({
  task,
  subtasks = [],
  parentTitle,
  onOpen,
  dragging,
}: {
  task: TaskWithRelations;
  /** Subtarefas da tarefa — viram contador no card da mãe. */
  subtasks?: TaskWithRelations[];
  /** Preenchido só quando o card é de uma subtarefa. */
  parentTitle?: string;
  onOpen: () => void;
  dragging?: boolean;
}) {
  const priority = PRIORITY_META[task.priority];
  const isLate = task.due_date && task.status !== 'concluido' && new Date(task.due_date) < new Date();

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm transition-shadow',
        dragging ? 'rotate-2 shadow-card-hover' : 'hover:shadow-card-hover',
      )}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {parentTitle && (
          <p className="mb-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <CornerDownRight className="size-3 shrink-0" aria-hidden />
            {parentTitle}
          </p>
        )}
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-3 text-sm font-medium leading-snug">{task.title}</p>
          {task.is_milestone && <Flag className="size-3.5 shrink-0 text-primary" aria-label="Marco" />}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="soft" className={cn('text-[10px]', priority.className)} dot={priority.dot}>
            {priority.label}
          </Badge>
          {task.estimated_hours > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" aria-hidden />
              {task.estimated_hours}h
            </span>
          )}
          {subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <ListTree className="size-3" aria-hidden />
              {subtasks.filter((item) => item.status === 'concluido').length}/{subtasks.length}
            </span>
          )}
        </div>

        {task.progress > 0 && task.status !== 'concluido' && (
          <Progress value={task.progress} className="mt-2 h-1" />
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          {task.due_date ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px]',
                isLate ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              <CalendarDays className="size-3" aria-hidden />
              {formatDate(task.due_date, 'dd/MM')}
            </span>
          ) : (
            <span />
          )}
          {task.assignee && (
            <UserAvatar
              userId={task.assignee.id}
              name={task.assignee.full_name}
              src={task.assignee.avatar_url}
              className="size-6"
            />
          )}
        </div>
      </button>
    </div>
  );
}

function SortableTaskCard({
  task,
  subtasks,
  parentTitle,
  onOpen,
}: {
  task: TaskWithRelations;
  subtasks: TaskWithRelations[];
  parentTitle?: string;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('touch-none', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} subtasks={subtasks} parentTitle={parentTitle} onOpen={onOpen} />
    </li>
  );
}

/* ---------------------------------------------------------------- Coluna */
function Column({
  id,
  label,
  accent,
  tasks,
  childrenOf,
  parentTitles,
  canCreate,
  onOpenTask,
  onCreate,
}: {
  id: string;
  label: string;
  accent: string;
  tasks: TaskWithRelations[];
  childrenOf: Map<string, TaskWithRelations[]>;
  parentTitles: Map<string, string>;
  /** Criar direto na coluna só faz sentido quando ela é um status. */
  canCreate: boolean;
  onOpenTask: (task: TaskWithRelations) => void;
  onCreate: (columnId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const hours = tasks.reduce((total, task) => total + Number(task.estimated_hours ?? 0), 0);

  return (
    <section
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border bg-secondary/40 transition-colors',
        isOver && 'border-primary bg-primary/5',
      )}
      aria-label={label}
    >
      <header className="flex items-center gap-2 px-3 py-3">
        <span className={cn('size-2 rounded-full', accent)} aria-hidden />
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="rounded-full bg-card px-1.5 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
        {canCreate && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={() => onCreate(id)}
            aria-label={`Nova tarefa em ${label}`}
          >
            <Plus className="size-4" />
          </Button>
        )}
      </header>

      <div ref={setNodeRef} className="flex-1 space-y-2 overflow-y-auto px-2 pb-3 scrollbar-thin">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                subtasks={childrenOf.get(task.id) ?? []}
                parentTitle={task.parent_task_id ? parentTitles.get(task.parent_task_id) : undefined}
                onOpen={() => onOpenTask(task)}
              />
            ))}
          </ul>
        </SortableContext>

        {tasks.length === 0 && (
          <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            Arraste tarefas para cá
          </p>
        )}
      </div>

      {hours > 0 && (
        <footer className="border-t px-3 py-2 text-[11px] text-muted-foreground">{hours}h estimadas</footer>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- Board */
export function KanbanBoard({
  projectId,
  tasks,
  isLoading,
  groupKey = 'status',
  columns,
  includeSubtasks = false,
}: {
  projectId: string;
  tasks: TaskWithRelations[];
  isLoading?: boolean;
  /** O que vira coluna. É o mesmo agrupamento escolhido na lista. */
  groupKey?: TaskGroupKey;
  columns?: TaskColumn[];
  /** Ligado, cada subtarefa cadastrada também vira um card próprio. */
  includeSubtasks?: boolean;
}) {
  const moveTask = useMoveTask(projectId);
  const updateTask = useUpdateTask(projectId);
  const members = useProjectMembers(projectId);
  const [activeTask, setActiveTask] = React.useState<TaskWithRelations | null>(null);
  const [dialogTask, setDialogTask] = React.useState<TaskWithRelations | null>(null);
  const [creatingStatus, setCreatingStatus] = React.useState<TaskStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // Por padrão a subtarefa conta dentro da tarefa mãe, como no Monday. Com
  // `includeSubtasks` cada cadastro da lista vira um card por conta própria.
  const { parents, childrenOf } = React.useMemo(() => splitSubtasks(tasks), [tasks]);

  const cards = React.useMemo(
    () => (includeSubtasks ? tasks : parents),
    [includeSubtasks, tasks, parents],
  );

  const parentTitles = React.useMemo(
    () => new Map(tasks.map((task) => [task.id, task.title])),
    [tasks],
  );

  const boardColumns = React.useMemo(
    () => columns ?? buildTaskColumns(groupKey, cards, members.data ?? []),
    [columns, groupKey, cards, members.data],
  );

  const grouped = React.useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    boardColumns.forEach((column) => map.set(column.id, []));
    cards.forEach((task) => map.get(taskColumnId(task, groupKey))?.push(task));
    map.forEach((list) => list.sort((a, b) => a.position - b.position));
    return map;
  }, [boardColumns, cards, groupKey]);

  function onDragStart(event: DragStartEvent) {
    setActiveTask(cards.find((task) => task.id === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const task = cards.find((item) => item.id === active.id);
    if (!task) return;

    // O destino pode ser a própria coluna ou um card dentro dela.
    const overTask = cards.find((item) => item.id === over.id);
    const targetColumn = overTask ? taskColumnId(overTask, groupKey) : (over.id as string);
    if (!boardColumns.some((column) => column.id === targetColumn)) return;

    // Arrastar move a tarefa no campo que está agrupando o quadro.
    if (groupKey === 'priority') {
      if (task.priority !== targetColumn) {
        updateTask.mutate({ id: task.id, priority: targetColumn as PriorityLevel });
      }
      return;
    }

    if (groupKey === 'assignee') {
      const assigneeId = targetColumn === NO_ASSIGNEE ? null : targetColumn;
      if ((task.assignee_id ?? null) !== assigneeId) {
        updateTask.mutate({ id: task.id, assignee_id: assigneeId });
      }
      return;
    }

    if (groupKey !== 'status') return;

    const column = grouped.get(targetColumn) ?? [];
    const overIndex = overTask ? column.findIndex((item) => item.id === overTask.id) : column.length;
    const position = overIndex <= 0 ? 5 : (column[overIndex - 1]?.position ?? 0) + 5;

    if (task.status === targetColumn && task.position === position) return;

    moveTask.mutate({ taskId: task.id, status: targetColumn as TaskStatus, position });
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {KANBAN_COLUMNS.map((column) => (
          <Skeleton key={column.id} className="h-96 w-72 shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {boardColumns.map((column) => (
            <Column
              key={column.id}
              id={column.id}
              label={column.label}
              accent={column.accent}
              tasks={grouped.get(column.id) ?? []}
              childrenOf={childrenOf}
              parentTitles={parentTitles}
              canCreate={groupKey === 'status'}
              onOpenTask={setDialogTask}
              onCreate={(columnId) => setCreatingStatus(columnId as TaskStatus)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="w-72">
              <TaskCard
                task={activeTask}
                subtasks={childrenOf.get(activeTask.id) ?? []}
                parentTitle={activeTask.parent_task_id ? parentTitles.get(activeTask.parent_task_id) : undefined}
                onOpen={() => undefined}
                dragging
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        projectId={projectId}
        open={Boolean(dialogTask)}
        onOpenChange={(open) => !open && setDialogTask(null)}
        task={dialogTask}
      />

      <TaskDialog
        projectId={projectId}
        open={Boolean(creatingStatus)}
        onOpenChange={(open) => !open && setCreatingStatus(null)}
        initialStatus={creatingStatus ?? undefined}
      />
    </>
  );
}
