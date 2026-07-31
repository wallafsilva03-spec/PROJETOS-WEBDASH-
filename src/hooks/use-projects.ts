'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query-keys';
import { useRealtime } from '@/hooks/use-realtime';
import type {
  HealthStatus,
  PriorityLevel,
  Project,
  ProjectMemberWithProfile,
  ProjectOverview,
  ProjectStatus,
} from '@/types/database';

export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus[];
  priority?: PriorityLevel[];
  health?: HealthStatus[];
  departmentId?: string | null;
  clientId?: string | null;
  ownerId?: string | null;
  onlyMine?: boolean;
  includeArchived?: boolean;
  sort?: 'due_date' | 'progress' | 'priority' | 'name' | 'created_at';
}

const SORT_CONFIG: Record<NonNullable<ProjectFilters['sort']>, { column: string; ascending: boolean }> = {
  due_date: { column: 'due_date', ascending: true },
  progress: { column: 'progress', ascending: false },
  priority: { column: 'priority', ascending: false },
  name: { column: 'name', ascending: true },
  created_at: { column: 'created_at', ascending: false },
};

/** Portfólio de projetos com métricas calculadas (view `v_project_overview`). */
export function useProjects(filters: ProjectFilters = {}) {
  const query = useQuery({
    queryKey: qk.projects(filters),
    queryFn: async (): Promise<ProjectOverview[]> => {
      const supabase = createClient();
      let request = supabase.from('v_project_overview').select('*');

      if (!filters.includeArchived) request = request.eq('is_archived', false);
      if (filters.search) request = request.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      if (filters.status?.length) request = request.in('status', filters.status);
      if (filters.priority?.length) request = request.in('priority', filters.priority);
      if (filters.health?.length) request = request.in('health', filters.health);
      if (filters.departmentId) request = request.eq('department_id', filters.departmentId);
      if (filters.clientId) request = request.eq('client_id', filters.clientId);
      if (filters.ownerId) request = request.eq('owner_id', filters.ownerId);

      const sort = SORT_CONFIG[filters.sort ?? 'due_date'];
      const { data, error } = await request.order(sort.column, { ascending: sort.ascending });

      if (error) throw error;
      return data as ProjectOverview[];
    },
  });

  useRealtime('portfolio', [{ table: 'projects' }, { table: 'tasks' }], [['projects'], qk.kpis]);

  return query;
}

export function useProject(id: string) {
  const query = useQuery({
    queryKey: qk.project(id),
    enabled: Boolean(id),
    queryFn: async (): Promise<ProjectOverview> => {
      const { data, error } = await createClient()
        .from('v_project_overview')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as ProjectOverview;
    },
  });

  useRealtime(
    `project-${id}`,
    [
      { table: 'projects', filter: `id=eq.${id}` },
      { table: 'tasks', filter: `project_id=eq.${id}` },
      { table: 'checklist_items', filter: `project_id=eq.${id}` },
      { table: 'comments', filter: `project_id=eq.${id}` },
      { table: 'risks', filter: `project_id=eq.${id}` },
      { table: 'milestones', filter: `project_id=eq.${id}` },
      { table: 'attachments', filter: `project_id=eq.${id}` },
      { table: 'project_members', filter: `project_id=eq.${id}` },
      { table: 'time_entries', filter: `project_id=eq.${id}` },
    ],
    [['project', id], qk.tasks(id), qk.comments(id), qk.activity(id)],
  );

  return query;
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: qk.projectMembers(projectId),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProjectMemberWithProfile[]> => {
      const { data, error } = await createClient()
        .from('project_members')
        .select('*, profile:profiles(id, full_name, avatar_url, job_title, role)')
        .eq('project_id', projectId);
      if (error) throw error;
      return data as ProjectMemberWithProfile[];
    },
  });
}

type ProjectPayload = Partial<Project> & { tags?: string[] };

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tags = [], ...payload }: ProjectPayload) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('projects')
        .insert({ ...payload, created_by: user?.id, owner_id: payload.owner_id ?? user?.id })
        .select()
        .single();

      if (error) throw error;
      const project = data as Project;

      if (project.owner_id) {
        await supabase
          .from('project_members')
          .upsert({ project_id: project.id, user_id: project.owner_id, role_in_project: 'gestor' });
      }

      if (tags.length) {
        await supabase.from('project_tags').insert(tags.map((tag_id) => ({ project_id: project.id, tag_id })));
      }

      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: qk.kpis });
      toast.success(`Projeto ${project.code} criado.`);
    },
    onError: (error: Error) => toast.error(`Falha ao criar o projeto: ${error.message}`),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tags, ...payload }: ProjectPayload & { id: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase.from('projects').update(payload).eq('id', id).select().single();
      if (error) throw error;

      if (tags) {
        await supabase.from('project_tags').delete().eq('project_id', id);
        if (tags.length) {
          await supabase.from('project_tags').insert(tags.map((tag_id) => ({ project_id: id, tag_id })));
        }
      }

      return data as Project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: qk.project(project.id) });
      queryClient.invalidateQueries({ queryKey: qk.kpis });
      toast.success('Projeto atualizado.');
    },
    onError: (error: Error) => toast.error(`Falha ao atualizar: ${error.message}`),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('projects').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: qk.kpis });
      toast.success('Projeto excluído.');
    },
    onError: (error: Error) => toast.error(`Falha ao excluir: ${error.message}`),
  });
}

export function useProjectMemberMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.projectMembers(projectId) });

  const add = useMutation({
    mutationFn: async ({ userId, role = 'membro' }: { userId: string; role?: string }) => {
      const { error } = await createClient()
        .from('project_members')
        .upsert({ project_id: projectId, user_id: userId, role_in_project: role });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Integrante adicionado à equipe.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await createClient()
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Integrante removido.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { add, remove };
}
