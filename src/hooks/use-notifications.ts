'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query-keys';
import { useRealtime } from '@/hooks/use-realtime';
import { useSession } from '@/hooks/use-session';
import { useWebNotifications } from '@/hooks/use-web-notifications';
import type { Notification } from '@/types/database';

export function useNotifications(limit = 30) {
  const queryClient = useQueryClient();
  const { profile } = useSession();

  const query = useQuery({
    queryKey: qk.notifications,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await createClient()
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as Notification[];
    },
  });

  const web = useWebNotifications();

  /**
   * Um alerta, um aviso. Com a aba à vista, o toast dentro do app basta e é
   * menos intrusivo; com a aba escondida — outra aba, janela minimizada — só
   * o balão do navegador chega. Mandar os dois sempre faria a pessoa receber
   * a mesma coisa duas vezes ao voltar para a aba.
   */
  const onInsert = React.useCallback(
    (payload: { eventType: string; new: Record<string, unknown> }) => {
      if (payload.eventType !== 'INSERT') return;
      const record = payload.new as unknown as Notification;

      if (typeof document !== 'undefined' && document.hidden) {
        web.show({
          title: record.title,
          body: record.body,
          tag: record.id,
          href: record.project_id ? `/projetos/${record.project_id}` : undefined,
        });
        return;
      }

      toast(record.title, { description: record.body ?? undefined });
    },
    [web],
  );

  useRealtime(
    'notifications',
    profile ? [{ table: 'notifications', filter: `user_id=eq.${profile.id}`, onChange: onInsert as never }] : [],
    [qk.notifications],
  );

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await createClient().rpc('mark_all_notifications_read');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient()
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  });

  const items = query.data ?? [];

  return {
    ...query,
    items,
    unreadCount: items.filter((item) => !item.is_read).length,
    markAllRead,
    markRead,
  };
}
