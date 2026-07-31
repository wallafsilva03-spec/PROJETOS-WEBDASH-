'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query-keys';
import { useRealtime } from '@/hooks/use-realtime';
import { extractMentions } from '@/lib/utils';
import type { CommentWithAuthor } from '@/types/database';

/** Chat do projeto/tarefa em tempo real. */
export function useComments(projectId: string, taskId?: string | null) {
  const query = useQuery({
    queryKey: qk.comments(projectId, taskId),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<CommentWithAuthor[]> => {
      let request = createClient()
        .from('comments')
        .select('*, author:profiles(id, full_name, avatar_url, job_title)')
        .eq('project_id', projectId);

      request = taskId ? request.eq('task_id', taskId) : request.is('task_id', null);

      const { data, error } = await request.order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as CommentWithAuthor[];
    },
  });

  useRealtime(
    `comments-${projectId}-${taskId ?? 'project'}`,
    [{ table: 'comments', filter: `project_id=eq.${projectId}` }],
    [qk.comments(projectId, taskId)],
  );

  return query;
}

export function useSendComment(projectId: string, taskId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada.');

      const { data: comment, error } = await supabase
        .from('comments')
        .insert({ project_id: projectId, task_id: taskId ?? null, author_id: user.id, body })
        .select()
        .single();
      if (error) throw error;

      // Resolve as @menções pelo primeiro nome e dispara as notificações.
      const mentions = extractMentions(body);
      if (mentions.length) {
        const { data: people } = await supabase.from('profiles').select('id, full_name, email');
        const matched = (people ?? []).filter((person) => {
          const handle = (person.full_name as string).split(/\s+/)[0].toLowerCase();
          const emailHandle = (person.email as string).split('@')[0].toLowerCase();
          return mentions.includes(handle) || mentions.includes(emailHandle);
        });

        if (matched.length) {
          await supabase
            .from('comment_mentions')
            .insert(matched.map((person) => ({ comment_id: comment.id, user_id: person.id })));
        }
      }

      return comment;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.comments(projectId, taskId) }),
    onError: (error: Error) => toast.error(`Falha ao enviar: ${error.message}`),
  });
}

export function useDeleteComment(projectId: string, taskId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('comments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.comments(projectId, taskId) }),
    onError: (error: Error) => toast.error(error.message),
  });
}
