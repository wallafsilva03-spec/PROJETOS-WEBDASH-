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
import { CalendarDays, Clock, Flag, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { KANBAN_COLUMNS, PRIORITY_META } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMoveTask } from '@/hooks/use-tasks';
import type { TaskStatus, TaskWithRelations } from '@/types/database';

/* ------------------------------------------------------------------ Card */
function TaskCard({ task, onOpen, dragging }: { task: TaskWithRelations; onOpen: () => void; dragging?: boolean }) {
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
    </div>
  );
}

function SortableTaskCard({ task, onOpen }: { task: TaskWithRelations; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('touch-none', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onOpen={onOpen} />
    </li>
  );
}

/* ---------------------------------------------------------------- Coluna */
function Column({
  id,
  label,
  accent,
  tasks,
  onOpenTask,
  onCreate,
}: {
  id: TaskStatus;
  label: string;
  accent: string;
  tasks: TaskWithRelations[];
  onOpenTask: (task: TaskWithRelations) => void;
  onCreate: (status: TaskStatus) => void;
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={() => onCreate(id)}
          aria-label={`Nova tarefa em ${label}`}
        >
          <Plus className="size-4" />
        </Button>
      </header>

      <div ref={setNodeRef} className="flex-1 space-y-2 overflow-y-auto px-2 pb-3 scrollbar-thin">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {tasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} onOpen={() => onOpenTask(task)} />
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
}: {
  projectId: string;
  tasks: TaskWithRelations[];
  isLoading?: boolean;
}) {
  const moveTask = useMoveTask(projectId);
  const [activeTask, setActiveTask] = React.useState<TaskWithRelations | null>(null);
  const [dialogTask, setDialogTask] = React.useState<TaskWithRelations | null>(null);
  const [creatingStatus, setCreatingStatus] = React.useState<TaskStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = React.useMemo(() => {
    const map = new Map<TaskStatus, TaskWithRelations[]>();
    KANBAN_COLUMNS.forEach((column) => map.set(column.id, []));
    tasks.forEach((task) => map.get(task.status)?.push(task));
    map.forEach((list) => list.sort((a, b) => a.position - b.position));
    return map;
  }, [tasks]);

  function onDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((task) => task.id === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const task = tasks.find((item) => item.id === active.id);
    if (!task) return;

    // O destino pode ser a própria coluna ou um card dentro dela.
    const overTask = tasks.find((item) => item.id === over.id);
    const targetStatus = (overTask?.status ?? (over.id as TaskStatus)) as TaskStatus;
    if (!KANBAN_COLUMNS.some((column) => column.id === targetStatus)) return;

    const column = grouped.get(targetStatus) ?? [];
    const overIndex = overTask ? column.findIndex((item) => item.id === overTask.id) : column.length;
    const position = overIndex <= 0 ? 5 : (column[overIndex - 1]?.position ?? 0) + 5;

    if (task.status === targetStatus && task.position === position) return;

    moveTask.mutate({ taskId: task.id, status: targetStatus, position });
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
          {KANBAN_COLUMNS.map((column) => (
            <Column
              key={column.id}
              id={column.id}
              label={column.label}
              accent={column.accent}
              tasks={grouped.get(column.id) ?? []}
              onOpenTask={setDialogTask}
              onCreate={setCreatingStatus}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="w-72">
              <TaskCard task={activeTask} onOpen={() => undefined} dragging />
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
