'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import {
  describeDbError,
  isDuplicateProjectCode,
  isSchemaOutdated,
  SETUP_HINT,
} from '@/lib/supabase/errors';
import { fillProjectDefaults, withoutOptionalColumns } from '@/lib/project-compat';
import { generateProjectCode, withCodeSuffix } from '@/lib/project-code';
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

/**
 * Portfólio de projetos com métricas calculadas (view `v_project_360`:
 * overview + viabilidade econômica + conclusão por tempo + etapas).
 */
export function useProjects(filters: ProjectFilters = {}) {
  const query = useQuery({
    queryKey: qk.projects(filters),
    queryFn: async (): Promise<ProjectOverview[]> => {
      const supabase = createClient();

      // `view` cai para a antiga enquanto o setup.sql novo não é executado.
      const run = async (view: string) => {
        let request = supabase.from(view).select('*');

        if (!filters.includeArchived) request = request.eq('is_archived', false);
        if (filters.search) request = request.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
        if (filters.status?.length) request = request.in('status', filters.status);
        if (filters.priority?.length) request = request.in('priority', filters.priority);
        if (filters.health?.length) request = request.in('health', filters.health);
        if (filters.departmentId) request = request.eq('department_id', filters.departmentId);
        if (filters.clientId) request = request.eq('client_id', filters.clientId);
        if (filters.ownerId) request = request.eq('owner_id', filters.ownerId);

        const sort = SORT_CONFIG[filters.sort ?? 'due_date'];
        return request.order(sort.column, { ascending: sort.ascending });
      };

      let { data, error } = await run('v_project_360');
      if (error && isSchemaOutdated(error)) ({ data, error } = await run('v_project_overview'));

      if (error) throw error;
      return (data ?? []).map(fillProjectDefaults);
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
      const supabase = createClient();
      const run = (view: string) => supabase.from(view).select('*').eq('id', id).single();

      let { data, error } = await run('v_project_360');
      if (error && isSchemaOutdated(error)) ({ data, error } = await run('v_project_overview'));

      if (error) throw error;
      return fillProjectDefaults(data as Record<string, unknown>);
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
      { table: 'project_stages', filter: `project_id=eq.${id}` },
      { table: 'attachments', filter: `project_id=eq.${id}` },
      { table: 'project_members', filter: `project_id=eq.${id}` },
      { table: 'time_entries', filter: `project_id=eq.${id}` },
    ],
    [['project', id], qk.tasks(id), qk.comments(id), qk.activity(id), qk.stages(id)],
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

      const row = {
        ...payload,
        code: payload.code || generateProjectCode(),
        created_by: user?.id,
        owner_id: payload.owner_id ?? user?.id,
      };

      const insert = (values: Record<string, unknown>) =>
        supabase.from('projects').insert(values).select().single();

      /**
       * O código é o carimbo de ano-data-hora do cadastro, então dois projetos
       * criados no mesmo segundo colidem na unicidade da coluna. Em vez de
       * devolver erro para quem só clicou em salvar, tenta o sufixo.
       */
      const insertProject = async (values: Record<string, unknown>) => {
        let result = await insert(values);

        for (let attempt = 2; attempt <= 4 && isDuplicateProjectCode(result.error); attempt += 1) {
          result = await insert({ ...values, code: withCodeSuffix(String(values.code), attempt) });
        }

        return result;
      };

      let { data, error } = await insertProject(row);

      // Banco ainda sem as colunas de viabilidade: grava o resto e avisa.
      if (error && isSchemaOutdated(error)) {
        ({ data, error } = await insertProject(withoutOptionalColumns(row)));
        if (!error) toast.warning(`Projeto criado sem viabilidade econômica e sem responsáveis. ${SETUP_HINT}`);
      }

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
    onError: (error: Error) => toast.error(`Falha ao criar o projeto: ${describeDbError(error)}`),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tags, ...payload }: ProjectPayload & { id: string }) => {
      const supabase = createClient();
      const update = (values: Record<string, unknown>) =>
        supabase.from('projects').update(values).eq('id', id).select().single();

      let { data, error } = await update(payload);

      if (error && isSchemaOutdated(error)) {
        ({ data, error } = await update(withoutOptionalColumns(payload)));
        if (!error) toast.warning(`Viabilidade econômica e responsáveis não gravados. ${SETUP_HINT}`);
      }

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
    onError: (error: Error) => toast.error(`Falha ao atualizar: ${describeDbError(error)}`),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // O `select` devolve o que foi realmente apagado. Sem ele, a exclusão
      // barrada pela RLS volta como sucesso com zero linhas e o usuário acha
      // que o projeto sumiu.
      const { data, error } = await createClient().from('projects').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) {
        throw new Error('Somente administradores podem excluir projetos.');
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: qk.kpis });
      queryClient.invalidateQueries({ queryKey: qk.allStages });
      queryClient.removeQueries({ queryKey: qk.project(id) });
      toast.success('Projeto excluído.');
    },
    onError: (error: Error) => toast.error(`Falha ao excluir: ${describeDbError(error)}`),
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
