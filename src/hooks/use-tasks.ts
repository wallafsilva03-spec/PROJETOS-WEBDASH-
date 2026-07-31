'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query-keys';
import type { GanttTask, Task, TaskDependency, TaskStatus, TaskWithRelations } from '@/types/database';

const TASK_SELECT = '*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)';

export function useTasks(projectId?: string) {
  return useQuery({
    queryKey: qk.tasks(projectId),
    queryFn: async (): Promise<TaskWithRelations[]> => {
      let request = createClient().from('tasks').select(TASK_SELECT);
      if (projectId) request = request.eq('project_id', projectId);

      const { data, error } = await request
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as unknown as TaskWithRelations[];
    },
  });
}

/** Tarefas do usuário logado — usado em "Minhas tarefas" e no calendário. */
export function useMyTasks() {
  return useQuery({
    queryKey: ['tasks', 'mine'],
    queryFn: async (): Promise<(TaskWithRelations & { project: { id: string; name: string; code: string } })[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select(`${TASK_SELECT}, project:projects(id, name, code)`)
        .eq('assignee_id', user.id)
        .neq('status', 'concluido')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(50);

      if (error) throw error;
      return data as never;
    },
  });
}

export function useGantt(projectId?: string) {
  return useQuery({
    queryKey: qk.gantt(projectId),
    queryFn: async (): Promise<GanttTask[]> => {
      let request = createClient().from('v_task_gantt').select('*');
      if (projectId) request = request.eq('project_id', projectId);

      const { data, error } = await request.order('start_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as GanttTask[];
    },
  });
}

export function useTaskDependencies(projectId: string) {
  return useQuery({
    queryKey: qk.dependencies(projectId),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<TaskDependency[]> => {
      const supabase = createClient();
      const { data: tasks } = await supabase.from('tasks').select('id').eq('project_id', projectId);
      const ids = (tasks ?? []).map((t) => t.id as string);
      if (!ids.length) return [];

      const { data, error } = await supabase.from('task_dependencies').select('*').in('successor_id', ids);
      if (error) throw error;
      return data as TaskDependency[];
    },
  });
}

function useTaskInvalidation(projectId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: qk.tasks(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.gantt(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.burn(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.kpis });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'mine'] });
  };
}

export function useCreateTask(projectId: string) {
  const invalidate = useTaskInvalidation(projectId);

  return useMutation({
    mutationFn: async (payload: Partial<Task>) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...payload, project_id: projectId, created_by: user?.id })
        .select()
        .single();

      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Tarefa criada.');
    },
    onError: (error: Error) => toast.error(`Falha ao criar a tarefa: ${error.message}`),
  });
}

export function useUpdateTask(projectId: string) {
  const invalidate = useTaskInvalidation(projectId);

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Task> & { id: string }) => {
      const { data, error } = await createClient().from('tasks').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(`Falha ao atualizar a tarefa: ${error.message}`),
  });
}

export function useDeleteTask(projectId: string) {
  const invalidate = useTaskInvalidation(projectId);

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Tarefa excluída.');
    },
    onError: (error: Error) => toast.error(`Falha ao excluir: ${error.message}`),
  });
}

/**
 * Drag & drop do Kanban com atualização otimista:
 * o card muda de coluna imediatamente e o Realtime confirma para os demais usuários.
 */
export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = useTaskInvalidation(projectId);

  return useMutation({
    mutationFn: async ({ taskId, status, position }: { taskId: string; status: TaskStatus; position: number }) => {
      const { error } = await createClient().rpc('move_task', {
        p_task_id: taskId,
        p_status: status,
        p_position: position,
      });
      if (error) throw error;
    },
    onMutate: async ({ taskId, status, position }) => {
      const key = qk.tasks(projectId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskWithRelations[]>(key);

      queryClient.setQueryData<TaskWithRelations[]>(key, (tasks) =>
        (tasks ?? []).map((task) => (task.id === taskId ? { ...task, status, position } : task)),
      );

      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(qk.tasks(projectId), context.previous);
      toast.error(`Não foi possível mover a tarefa: ${error.message}`);
    },
    onSettled: () => invalidate(),
  });
}

export function useDependencyMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.dependencies(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.gantt(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.tasks(projectId) });
  };

  const add = useMutation({
    mutationFn: async (payload: Pick<TaskDependency, 'predecessor_id' | 'successor_id' | 'type' | 'lag_days'>) => {
      const { error } = await createClient().from('task_dependencies').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Dependência criada. O cronograma foi recalculado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('task_dependencies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Dependência removida.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { add, remove };
}
