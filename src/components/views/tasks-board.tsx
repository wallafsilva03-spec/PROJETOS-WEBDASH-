'use client';

import * as React from 'react';
import { ArrowUpDown, KanbanSquare, ListChecks, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { KanbanBoard } from '@/components/views/kanban-board';
import { TaskList } from '@/components/views/task-list';
import { buildTaskColumns, splitSubtasks, type TaskGroupKey, type TaskSortKey } from '@/lib/task-grouping';
import { cn } from '@/lib/utils';
import { useProjectMembers } from '@/hooks/use-projects';
import type { TaskWithRelations } from '@/types/database';

type ViewMode = 'lista' | 'kanban';

const VIEWS: { id: ViewMode; label: string; icon: typeof ListChecks }[] = [
  { id: 'lista', label: 'Lista', icon: ListChecks },
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
];

/**
 * Aba única de tarefas, no modelo do Monday: o mesmo quadro em dois formatos.
 * O agrupamento escolhido vale para os dois — os grupos da lista são
 * exatamente as colunas do Kanban, e trocar de formato não perde o contexto.
 */
export function TasksBoard({
  projectId,
  tasks,
  isLoading,
}: {
  projectId: string;
  tasks: TaskWithRelations[];
  isLoading?: boolean;
}) {
  const [view, setView] = React.useState<ViewMode>('lista');
  const [groupKey, setGroupKey] = React.useState<TaskGroupKey>('status');
  const [sortKey, setSortKey] = React.useState<TaskSortKey>('position');
  const [creating, setCreating] = React.useState(false);

  const members = useProjectMembers(projectId);

  // Colunas calculadas uma vez e usadas pelos dois formatos, para a ordem bater.
  const columns = React.useMemo(() => {
    const { parents } = splitSubtasks(tasks);
    return buildTaskColumns(groupKey, parents, members.data ?? []);
  }, [groupKey, tasks, members.data]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-secondary/40 p-0.5" role="tablist" aria-label="Formato">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(item.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>

        <Select value={groupKey} onValueChange={(value) => setGroupKey(value as TaskGroupKey)}>
          <SelectTrigger className="w-52" aria-label="Agrupar por">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Agrupar por status</SelectItem>
            <SelectItem value="priority">Agrupar por prioridade</SelectItem>
            <SelectItem value="assignee">Agrupar por responsável</SelectItem>
            <SelectItem value="none">Sem agrupamento</SelectItem>
          </SelectContent>
        </Select>

        {view === 'lista' && (
          <Select value={sortKey} onValueChange={(value) => setSortKey(value as TaskSortKey)}>
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
        )}

        <Button variant="brand" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nova tarefa
        </Button>
      </div>

      {view === 'lista' ? (
        <TaskList
          projectId={projectId}
          tasks={tasks}
          isLoading={isLoading}
          groupKey={groupKey}
          sortKey={sortKey}
          columns={columns}
          onCreateTask={() => setCreating(true)}
        />
      ) : (
        <KanbanBoard
          projectId={projectId}
          tasks={tasks}
          isLoading={isLoading}
          groupKey={groupKey}
          columns={columns}
        />
      )}

      {groupKey !== 'status' && view === 'kanban' && (
        <p className="text-xs text-muted-foreground">
          Arrastando um card aqui você troca {groupKey === 'priority' ? 'a prioridade' : 'o responsável'} da tarefa.
        </p>
      )}

      <TaskDialog projectId={projectId} open={creating} onOpenChange={setCreating} />
    </div>
  );
}
