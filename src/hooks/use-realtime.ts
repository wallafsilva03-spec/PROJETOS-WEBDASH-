'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

type Table =
  | 'projects'
  | 'tasks'
  | 'checklist_items'
  | 'comments'
  | 'attachments'
  | 'notifications'
  | 'activity_log'
  | 'project_members'
  | 'milestones'
  | 'risks'
  | 'time_entries'
  | 'task_dependencies'
  | 'user_presence';

interface Subscription {
  table: Table;
  /** Filtro no formato do Realtime, ex.: `project_id=eq.<uuid>`. */
  filter?: string;
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

/**
 * Assina alterações no Postgres e invalida as queries informadas.
 *
 * O nome do canal recebe um sufixo único por instância do hook. O Supabase
 * reaproveita o canal quando o nome se repete, e registrar `postgres_changes`
 * num canal já inscrito lança "cannot add postgres_changes callbacks after
 * subscribe()", derrubando a página. Isso acontecia sempre que uma tela
 * montava o mesmo hook duas vezes — como a executiva, que consulta o
 * portfólio para os projetos críticos e de novo para a exportação.
 */
export function useRealtime(
  channelName: string,
  subscriptions: Subscription[],
  invalidateKeys: ReadonlyArray<readonly unknown[]> = [],
) {
  const queryClient = useQueryClient();
  const instanceId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const uniqueChannelName = `${channelName}-${instanceId}`;

  // Mantém as referências estáveis para não recriar o canal a cada render.
  const subsRef = React.useRef(subscriptions);
  subsRef.current = subscriptions;
  const keysRef = React.useRef(invalidateKeys);
  keysRef.current = invalidateKeys;

  const signature = React.useMemo(
    () => subscriptions.map((s) => `${s.table}:${s.filter ?? '*'}`).join('|'),
    [subscriptions],
  );

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(uniqueChannelName);

    subsRef.current.forEach(({ table, filter }) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => {
          const handler = subsRef.current.find((s) => s.table === table)?.onChange;
          handler?.(payload as RealtimePostgresChangesPayload<Record<string, unknown>>);
          keysRef.current.forEach((key) => queryClient.invalidateQueries({ queryKey: [...key] }));
        },
      );
    });

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uniqueChannelName, signature, queryClient]);
}

/** Mantém o registro de presença vivo para o indicador "usuários online". */
export function usePresenceHeartbeat(intervalMs = 45_000) {
  React.useEffect(() => {
    const supabase = createClient();
    let active = true;

    const ping = async () => {
      if (!active) return;
      await supabase.rpc('heartbeat');
    };

    void ping();
    const timer = setInterval(ping, intervalMs);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [intervalMs]);
}
