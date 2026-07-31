'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query-keys';
import { useRealtime } from '@/hooks/use-realtime';
import { useSession } from '@/hooks/use-session';
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

  const onInsert = React.useCallback((payload: { eventType: string; new: Record<string, unknown> }) => {
    if (payload.eventType !== 'INSERT') return;
    const record = payload.new as unknown as Notification;
    toast(record.title, { description: record.body ?? undefined });
  }, []);

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
