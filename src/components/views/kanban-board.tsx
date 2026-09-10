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
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  CornerDownRight,
  Flag,
  ListTree,
  Plus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { KANBAN_COLUMNS, PRIORITY_META, TASK_STATUS_META } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  NO_ASSIGNEE,
  buildRootIndex,
  buildTaskColumns,
  splitSubtasks,
  taskColumnId,
  type TaskColumn,
  type TaskGroupKey,
} from '@/lib/task-grouping';
import { useMoveTask, useUpdateTask } from '@/hooks/use-tasks';
import { useProjectMembers } from '@/hooks/use-projects';
import type { PriorityLevel, TaskStatus, TaskWithRelations } from '@/types/database';

/* ------------------------------------------------------- Árvore no card */
/**
 * Uma linha da árvore de dentro do card. Cada linha guarda a própria
 * abertura: abrir a tarefa principal mostra as subtarefas, e os itens de
 * cada subtarefa só aparecem quando você clica na setinha dela. Sem isso o
 * card despejaria a árvore inteira de uma vez.
 */
function BranchRow({
  task,
  childrenOf,
  depth,
  onOpenTask,
}: {
  task: TaskWithRelations;
  childrenOf: Map<string, TaskWithRelations[]>;
  depth: number;
  onOpenTask: (task: TaskWithRelations) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const children = childrenOf.get(task.id) ?? [];
  const meta = TASK_STATUS_META[task.status];
  const late = task.due_date && task.status !== 'concluido' && new Date(task.due_date) < new Date();

  return (
    <li>
      <div className="flex items-center gap-1">
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? `Ocultar itens de ${task.title}` : `Ver itens de ${task.title}`}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" aria-hidden />
        )}

        <button
          type="button"
          onClick={() => onOpenTask(task)}
          className="flex flex-1 items-center gap-1.5 overflow-hidden rounded px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-secondary"
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden />
          <span
            className={cn('flex-1 truncate', task.status === 'concluido' && 'text-muted-foreground line-through')}
          >
            {task.title}
          </span>
          {children.length > 0 && (
            <span className="shrink-0 text-muted-foreground">
              {children.filter((item) => item.status === 'concluido').length}/{children.length}
            </span>
          )}
          {task.due_date && (
            <span className={cn('shrink-0', late ? 'font-medium text-destructive' : 'text-muted-foreground')}>
              {formatDate(task.due_date, 'dd/MM')}
            </span>
          )}
        </button>
      </div>

      {open && children.length > 0 && (
        <CardBranch tasks={children} childrenOf={childrenOf} depth={depth + 1} onOpenTask={onOpenTask} />
      )}
    </li>
  );
}

function CardBranch({
  tasks,
  childrenOf,
  depth,
  onOpenTask,
}: {
  tasks: TaskWithRelations[];
  childrenOf: Map<string, TaskWithRelations[]>;
  depth: number;
  onOpenTask: (task: TaskWithRelations) => void;
}) {
  return (
    <ul className={cn('space-y-1', depth > 1 && 'ml-4 border-l pl-2')}>
      {tasks.map((task) => (
        <BranchRow
          key={task.id}
          task={task}
          childrenOf={childrenOf}
          depth={depth}
          onOpenTask={onOpenTask}
        />
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ Card */
function TaskCard({
  task,
  subtasks = [],
  childrenOf,
  expanded,
  onToggleExpand,
  parentTitle,
  showProject,
  onOpen,
  onOpenTask,
  dragging,
}: {
  task: TaskWithRelations;
  /** Subtarefas diretas — viram contador e, abertas, a árvore dentro do card. */
  subtasks?: TaskWithRelations[];
  childrenOf?: Map<string, TaskWithRelations[]>;
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** Preenchido só quando o card é de uma subtarefa. */
  parentTitle?: string;
  /** No quadro que mistura projetos, o card precisa dizer de onde veio. */
  showProject?: boolean;
  onOpen: () => void;
  onOpenTask?: (task: TaskWithRelations) => void;
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
        {showProject && task.project && (
          <p className="mb-1 truncate text-[11px] font-medium uppercase tracking-wide text-primary">
            {task.project.code}
          </p>
        )}
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

      {subtasks.length > 0 && (
        <>
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={Boolean(expanded)}
            className="mt-2 flex w-full items-center gap-1 rounded px-1 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            <ListTree className="size-3" aria-hidden />
            {subtasks.filter((item) => item.status === 'concluido').length}/{subtasks.length} subtarefas
          </button>

          {expanded && childrenOf && (
            <div className="mt-1 border-t pt-2">
              <CardBranch
                tasks={subtasks}
                childrenOf={childrenOf}
                depth={1}
                onOpenTask={onOpenTask ?? (() => undefined)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SortableTaskCard({
  task,
  subtasks,
  childrenOf,
  expanded,
  onToggleExpand,
  parentTitle,
  showProject,
  onOpen,
  onOpenTask,
}: {
  task: TaskWithRelations;
  subtasks: TaskWithRelations[];
  childrenOf: Map<string, TaskWithRelations[]>;
  expanded: boolean;
  onToggleExpand: () => void;
  parentTitle?: string;
  showProject?: boolean;
  onOpen: () => void;
  onOpenTask: (task: TaskWithRelations) => void;
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
      <TaskCard
        task={task}
        subtasks={subtasks}
        childrenOf={childrenOf}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        parentTitle={parentTitle}
        showProject={showProject}
        onOpen={onOpen}
        onOpenTask={onOpenTask}
      />
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
  expandedCards,
  onToggleCard,
  onOpenSubtask,
  showProject,
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
  expandedCards: Record<string, boolean>;
  onToggleCard: (taskId: string) => void;
  onOpenSubtask: (task: TaskWithRelations) => void;
  showProject?: boolean;
  /** Criar direto na coluna só faz sentido quando ela é um status de um projeto. */
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
                childrenOf={childrenOf}
                expanded={Boolean(expandedCards[task.id])}
                onToggleExpand={() => onToggleCard(task.id)}
                parentTitle={task.parent_task_id ? parentTitles.get(task.parent_task_id) : undefined}
                showProject={showProject}
                onOpen={() => onOpenTask(task)}
                onOpenTask={onOpenSubtask}
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
  /** Ausente no quadro geral, que mistura tarefas de vários projetos. */
  projectId?: string;
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
  const members = useProjectMembers(projectId ?? '');
  const [activeTask, setActiveTask] = React.useState<TaskWithRelations | null>(null);
  const [expandedCards, setExpandedCards] = React.useState<Record<string, boolean>>({});
  const [dialogTask, setDialogTask] = React.useState<TaskWithRelations | null>(null);
  const [creatingStatus, setCreatingStatus] = React.useState<TaskStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // Por padrão a subtarefa conta dentro da tarefa mãe, como no Monday. Com
  // `includeSubtasks` cada cadastro da lista vira um card por conta própria.
  const { parents, childrenOf } = React.useMemo(() => splitSubtasks(tasks), [tasks]);

  const rootOf = React.useMemo(() => buildRootIndex(tasks), [tasks]);

  /**
   * Agrupando por tarefa principal, quem vira card é a subtarefa: a tarefa
   * principal já é a coluna, e repeti-la dentro dela não diria nada.
   */
  const cards = React.useMemo(() => {
    if (groupKey === 'parent') {
      return tasks.filter((task) =>
        includeSubtasks ? Boolean(task.parent_task_id) : Boolean(task.parent_task_id) && rootOf.get(task.id) === task.parent_task_id,
      );
    }

    return includeSubtasks ? tasks : parents;
  }, [groupKey, includeSubtasks, tasks, parents, rootOf]);

  const parentTitles = React.useMemo(
    () => new Map(tasks.map((task) => [task.id, task.title])),
    [tasks],
  );

  const boardColumns = React.useMemo(
    () => columns ?? buildTaskColumns(groupKey, groupKey === 'parent' ? tasks : cards, members.data ?? []),
    [columns, groupKey, cards, tasks, members.data],
  );

  const grouped = React.useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    boardColumns.forEach((column) => map.set(column.id, []));
    cards.forEach((task) => map.get(taskColumnId(task, groupKey, rootOf))?.push(task));
    map.forEach((list) => list.sort((a, b) => a.position - b.position));
    return map;
  }, [boardColumns, cards, groupKey, rootOf]);

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
    const targetColumn = overTask ? taskColumnId(overTask, groupKey, rootOf) : (over.id as string);
    if (!boardColumns.some((column) => column.id === targetColumn)) return;

    // Arrastar move a tarefa no campo que está agrupando o quadro.
    if (groupKey === 'priority') {
      if (task.priority !== targetColumn) {
        updateTask.mutate({ id: task.id, priority: targetColumn as PriorityLevel });
      }
      return;
    }

    // Arrastar entre colunas de tarefa principal é rependurar a subtarefa.
    if (groupKey === 'parent') {
      if (targetColumn !== task.id && task.parent_task_id !== targetColumn) {
        updateTask.mutate({ id: task.id, parent_task_id: targetColumn });
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

    moveTask.mutate({
      taskId: task.id,
      status: targetColumn as TaskStatus,
      position,
      projectId: task.project_id,
    });
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
              expandedCards={expandedCards}
              onToggleCard={(taskId) =>
                setExpandedCards((state) => ({ ...state, [taskId]: !state[taskId] }))
              }
              onOpenSubtask={setDialogTask}
              showProject={!projectId}
              canCreate={groupKey === 'status' && Boolean(projectId)}
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
                showProject={!projectId}
                onOpen={() => undefined}
                dragging
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {dialogTask && (
        <TaskDialog
          projectId={dialogTask.project_id}
          open
          onOpenChange={(open) => !open && setDialogTask(null)}
          task={dialogTask}
        />
      )}

      {projectId && (
        <TaskDialog
          projectId={projectId}
          open={Boolean(creatingStatus)}
          onOpenChange={(open) => !open && setCreatingStatus(null)}
          initialStatus={creatingStatus ?? undefined}
        />
      )}
    </>
  );
}
