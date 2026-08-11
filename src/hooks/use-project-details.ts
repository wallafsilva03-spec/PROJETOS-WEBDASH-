'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { describeDbError } from '@/lib/supabase/errors';
import { qk } from '@/lib/query-keys';
import type {
  Attachment,
  ChecklistItem,
  Milestone,
  ProjectStage,
  ProjectStageView,
  Risk,
  TimeEntry,
} from '@/types/database';

/* --------------------------------------------------------------- Checklist */
export function useChecklist(projectId: string, taskId?: string | null) {
  return useQuery({
    queryKey: [...qk.checklist(projectId), taskId ?? 'all'],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ChecklistItem[]> => {
      let request = createClient().from('checklist_items').select('*').eq('project_id', projectId);
      if (taskId) request = request.eq('task_id', taskId);
      else if (taskId === null) request = request.is('task_id', null);

      const { data, error } = await request.order('position').order('created_at');
      if (error) throw error;
      return data as ChecklistItem[];
    },
  });
}

export function useChecklistMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.checklist(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
  };

  const add = useMutation({
    mutationFn: async ({ title, taskId }: { title: string; taskId?: string | null }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from('checklist_items').insert({
        project_id: projectId,
        task_id: taskId ?? null,
        title,
        created_by: user?.id,
        position: Date.now() % 100000,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, isDone }: { id: string; isDone: boolean }) => {
      const { error } = await createClient().from('checklist_items').update({ is_done: isDone }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('checklist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  return { add, toggle, remove };
}

/* ------------------------------------------------------------------ Marcos */
export function useMilestones(projectId: string) {
  return useQuery({
    queryKey: qk.milestones(projectId),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<Milestone[]> => {
      const { data, error } = await createClient()
        .from('milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date');
      if (error) throw error;
      return data as Milestone[];
    },
  });
}

export function useMilestoneMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.milestones(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.roadmap });
  };

  const save = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Milestone> & { id?: string }) => {
      const supabase = createClient();
      const { error } = id
        ? await supabase.from('milestones').update(payload).eq('id', id)
        : await supabase.from('milestones').insert({ ...payload, project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Marco salvo.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('milestones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Marco removido.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { save, remove };
}

/* ------------------------------------------------------------------ Etapas */
/**
 * Etapas com prazo, avanço e atraso já calculados no banco.
 * Sem `projectId`, devolve as etapas de todos os projetos visíveis.
 */
export function useStages(projectId?: string) {
  return useQuery({
    queryKey: projectId ? qk.stages(projectId) : qk.allStages,
    queryFn: async (): Promise<ProjectStageView[]> => {
      let request = createClient().from('v_project_stages').select('*');
      if (projectId) request = request.eq('project_id', projectId);

      const { data, error } = await request.order('project_code').order('position').order('start_date');
      if (error) throw error;
      return data as ProjectStageView[];
    },
  });
}

/**
 * Exclusão de etapa, compartilhada pelo painel do projeto e pelo kanban.
 *
 * O `select` devolve o que foi realmente apagado: sem ele, uma exclusão
 * barrada pela RLS volta como sucesso com zero linhas e a etapa "sumiria"
 * da tela só até o próximo recarregamento.
 */
async function deleteStageRow(id: string) {
  const { data, error } = await createClient()
    .from('project_stages')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      'A etapa não foi excluída: só quem cadastrou a etapa, o dono do projeto ou a gestão pode removê-la.',
    );
  }
}

export function useStageMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.stages(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.activity(projectId) });
    // O kanban corporativo lê as etapas de todos os projetos.
    queryClient.invalidateQueries({ queryKey: qk.allStages });
  };

  const save = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ProjectStage> & { id?: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = id
        ? await supabase.from('project_stages').update(payload).eq('id', id)
        : await supabase
            .from('project_stages')
            .insert({ ...payload, project_id: projectId, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Etapa salva.');
    },
    onError: (error: Error) => toast.error(describeDbError(error)),
  });

  const remove = useMutation({
    mutationFn: deleteStageRow,
    onSuccess: () => {
      invalidate();
      toast.success('Etapa removida.');
    },
    onError: (error: Error) => toast.error(describeDbError(error)),
  });

  /** Troca a etapa de lugar no organograma. */
  const reorder = useMutation({
    mutationFn: async (stages: { id: string; position: number }[]) => {
      const supabase = createClient();
      for (const stage of stages) {
        const { error } = await supabase
          .from('project_stages')
          .update({ position: stage.position })
          .eq('id', stage.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  return { save, remove, reorder };
}

/**
 * Atualização pontual de uma etapa feita direto no quadro kanban.
 *
 * Diferente de `useStageMutations`, não fica presa a um projeto: o quadro
 * corporativo mistura etapas de todo o portfólio e cada card sabe a que
 * projeto pertence.
 */
export function useStageBoardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stage,
      patch,
    }: {
      stage: Pick<ProjectStageView, 'id' | 'project_id'>;
      patch: Partial<ProjectStage>;
    }) => {
      const { error } = await createClient().from('project_stages').update(patch).eq('id', stage.id);
      if (error) throw error;
    },
    onSuccess: (_result, { stage }) => {
      queryClient.invalidateQueries({ queryKey: qk.allStages });
      queryClient.invalidateQueries({ queryKey: qk.project(stage.project_id) });
      queryClient.invalidateQueries({ queryKey: qk.projects() });
    },
    onError: (error: Error) => toast.error(describeDbError(error)),
  });
}

/**
 * Exclusão feita direto no quadro kanban, onde cada card sabe a que projeto
 * pertence — o mesmo motivo que fez `useStageBoardMutation` existir.
 */
export function useStageBoardDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stage: Pick<ProjectStageView, 'id' | 'project_id'>) =>
      deleteStageRow(stage.id),
    onSuccess: (_result, stage) => {
      queryClient.invalidateQueries({ queryKey: qk.allStages });
      queryClient.invalidateQueries({ queryKey: qk.stages(stage.project_id) });
      queryClient.invalidateQueries({ queryKey: qk.project(stage.project_id) });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Etapa removida.');
    },
    onError: (error: Error) => toast.error(describeDbError(error)),
  });
}

/* ------------------------------------------------------------------ Riscos */
export function useRisks(projectId: string) {
  return useQuery({
    queryKey: qk.risks(projectId),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<Risk[]> => {
      const { data, error } = await createClient()
        .from('risks')
        .select('*')
        .eq('project_id', projectId)
        .order('severity', { ascending: false });
      if (error) throw error;
      return data as Risk[];
    },
  });
}

export function useRiskMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.risks(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.riskHeatmap });
    queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
  };

  const save = useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Risk> & { id?: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = id
        ? await supabase.from('risks').update(payload).eq('id', id)
        : await supabase.from('risks').insert({ ...payload, project_id: projectId, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Risco salvo.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('risks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Risco removido.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { save, remove };
}

/* ----------------------------------------------------------------- Arquivos */
export function useAttachments(projectId: string) {
  return useQuery({
    queryKey: qk.attachments(projectId),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<(Attachment & { uploader: { full_name: string } | null })[]> => {
      const { data, error } = await createClient()
        .from('attachments')
        .select('*, uploader:profiles(full_name, avatar_url)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as never;
    },
  });
}

export function useAttachmentMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.attachments(projectId) });

  const upload = useMutation({
    mutationFn: async ({ file, taskId }: { file: File; taskId?: string | null }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // A policy do Storage exige que a primeira pasta seja o id do projeto.
      const safeName = file.name.replace(/[^\w.\-]/g, '_');
      const path = `${projectId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from('project-files').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error } = await supabase.from('attachments').insert({
        project_id: projectId,
        task_id: taskId ?? null,
        uploader_id: user?.id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Arquivo enviado.');
    },
    onError: (error: Error) => toast.error(`Falha no upload: ${error.message}`),
  });

  const remove = useMutation({
    mutationFn: async (attachment: Attachment) => {
      const supabase = createClient();
      await supabase.storage.from(attachment.bucket_id).remove([attachment.storage_path]);
      const { error } = await supabase.from('attachments').delete().eq('id', attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Arquivo removido.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /** URL temporária para download de um arquivo privado. */
  async function getSignedUrl(attachment: Attachment) {
    const { data, error } = await createClient()
      .storage.from(attachment.bucket_id)
      .createSignedUrl(attachment.storage_path, 60);
    if (error) throw error;
    return data.signedUrl;
  }

  return { upload, remove, getSignedUrl };
}

/* -------------------------------------------------------------- Apontamento */
export function useTimeEntries(projectId: string) {
  return useQuery({
    queryKey: qk.timeEntries(projectId),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<(TimeEntry & { user: { full_name: string } | null })[]> => {
      const { data, error } = await createClient()
        .from('time_entries')
        .select('*, user:profiles(full_name, avatar_url)')
        .eq('project_id', projectId)
        .order('work_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as never;
    },
  });
}

export function useTimeEntryMutations(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<TimeEntry>) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('time_entries')
        .insert({ ...payload, project_id: projectId, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.timeEntries(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
      queryClient.invalidateQueries({ queryKey: qk.workload });
      queryClient.invalidateQueries({ queryKey: qk.kpis });
      toast.success('Horas apontadas.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
