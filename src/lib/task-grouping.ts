import { KANBAN_COLUMNS, PRIORITY_META, TASK_STATUS_META } from '@/lib/constants';
import type { PriorityLevel, TaskWithRelations } from '@/types/database';

/** Como as tarefas são fatiadas — vale para os grupos da lista e para as colunas do Kanban. */
export type TaskGroupKey = 'status' | 'priority' | 'assignee' | 'none';
export type TaskSortKey = 'position' | 'due_date' | 'priority' | 'title' | 'progress';

/** Colunas/grupos que não vêm de um id real. */
export const NO_ASSIGNEE = '__sem_responsavel__';
export const ALL_TASKS = '__todas__';

/**
 * Três níveis, no modelo do Monday: tarefa principal, subtarefa e item.
 * O banco aceita mais (é `parent_task_id` apontando para a mesma tabela),
 * mas a partir do quarto nível a leitura em tabela deixa de caber na tela.
 */
export const MAX_TASK_DEPTH = 2;

/** Como cada nível é chamado na tela. */
export const TASK_LEVELS = [
  { singular: 'tarefa', plural: 'tarefas', article: 'a', of: 'das tarefas' },
  { singular: 'subtarefa', plural: 'subtarefas', article: 'a', of: 'das subtarefas' },
  { singular: 'item', plural: 'itens', article: 'o', of: 'dos itens' },
  // Quarto nível não é criável, mas o rótulo evita um undefined em tela.
  { singular: 'item', plural: 'itens', article: 'o', of: 'dos itens' },
] as const;

/** Tudo que pendura abaixo de uma tarefa, em qualquer nível. */
export function collectDescendants(
  taskId: string,
  childrenOf: Map<string, TaskWithRelations[]>,
): TaskWithRelations[] {
  const out: TaskWithRelations[] = [];
  const queue = [...(childrenOf.get(taskId) ?? [])];

  while (queue.length) {
    const task = queue.shift() as TaskWithRelations;
    out.push(task);
    queue.push(...(childrenOf.get(task.id) ?? []));
  }

  return out;
}

export const PRIORITY_ORDER: Record<PriorityLevel, number> = { critica: 4, alta: 3, media: 2, baixa: 1 };

export interface TaskColumn {
  id: string;
  label: string;
  /** Bolinha de cor do cabeçalho. */
  accent: string;
}

/** Membro do projeto, no mínimo que o agrupamento por responsável precisa. */
export interface GroupingMember {
  user_id: string;
  profile?: { full_name?: string | null } | null;
}

export function isLateTask(task: TaskWithRelations) {
  return Boolean(task.due_date) && task.status !== 'concluido' && new Date(task.due_date as string) < new Date();
}

/**
 * Separa as tarefas de topo do resto e indexa os filhos por pai — vale para
 * qualquer nível, então `childrenOf.get(subtarefa.id)` devolve os itens dela.
 *
 * Filho cujo pai não está na lista (filtrado ou removido) volta a ser raiz,
 * senão ele sumiria da tela.
 */
export function splitSubtasks(tasks: TaskWithRelations[]) {
  const childrenOf = new Map<string, TaskWithRelations[]>();
  const parents: TaskWithRelations[] = [];

  for (const task of tasks) {
    if (task.parent_task_id) {
      const siblings = childrenOf.get(task.parent_task_id) ?? [];
      siblings.push(task);
      childrenOf.set(task.parent_task_id, siblings);
    } else {
      parents.push(task);
    }
  }

  const ids = new Set(tasks.map((task) => task.id));
  for (const [parentId, children] of childrenOf) {
    if (!ids.has(parentId)) {
      parents.push(...children);
      childrenOf.delete(parentId);
    }
  }

  for (const children of childrenOf.values()) {
    children.sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.position - b.position);
  }

  return { parents, childrenOf };
}

export function sortTasks(tasks: TaskWithRelations[], sortKey: TaskSortKey) {
  return [...tasks].sort((a, b) => {
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
}

/** Em qual grupo/coluna a tarefa cai. */
export function taskColumnId(task: TaskWithRelations, groupKey: TaskGroupKey) {
  switch (groupKey) {
    case 'status':
      return task.status;
    case 'priority':
      return task.priority;
    case 'assignee':
      return task.assignee_id ?? NO_ASSIGNEE;
    default:
      return ALL_TASKS;
  }
}

/**
 * Colunas na ordem em que aparecem. As de status e prioridade são fixas;
 * as de responsável saem da equipe do projeto mais quem já tem tarefa.
 */
export function buildTaskColumns(
  groupKey: TaskGroupKey,
  tasks: TaskWithRelations[],
  members: GroupingMember[] = [],
): TaskColumn[] {
  if (groupKey === 'status') {
    return KANBAN_COLUMNS.map((column) => ({ id: column.id, label: column.label, accent: column.accent }));
  }

  if (groupKey === 'priority') {
    return (['critica', 'alta', 'media', 'baixa'] as PriorityLevel[]).map((priority) => ({
      id: priority,
      label: PRIORITY_META[priority].label,
      accent: PRIORITY_META[priority].dot ?? 'bg-slate-400',
    }));
  }

  if (groupKey === 'assignee') {
    const names = new Map<string, string>();
    for (const member of members) {
      names.set(member.user_id, member.profile?.full_name ?? 'Usuário');
    }
    for (const task of tasks) {
      if (task.assignee) names.set(task.assignee.id, task.assignee.full_name);
    }

    const columns = Array.from(names, ([id, label]) => ({ id, label, accent: 'bg-moreno-blue-400' })).sort((a, b) =>
      a.label.localeCompare(b.label, 'pt-BR'),
    );

    return [...columns, { id: NO_ASSIGNEE, label: 'Sem responsável', accent: 'bg-slate-400' }];
  }

  return [{ id: ALL_TASKS, label: 'Todas as tarefas', accent: 'bg-moreno-blue-400' }];
}

/** Rótulo do grupo na lista — mesmo texto do cabeçalho da coluna do Kanban. */
export function taskGroupLabel(task: TaskWithRelations, groupKey: TaskGroupKey) {
  switch (groupKey) {
    case 'status':
      return TASK_STATUS_META[task.status].label;
    case 'priority':
      return PRIORITY_META[task.priority].label;
    case 'assignee':
      return task.assignee?.full_name ?? 'Sem responsável';
    default:
      return 'Todas as tarefas';
  }
}
