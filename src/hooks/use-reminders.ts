'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { describeDbError, isSchemaOutdated, SETUP_HINT } from '@/lib/supabase/errors';
import { qk } from '@/lib/query-keys';
import { useSession } from '@/hooks/use-session';
import { useWebNotifications } from '@/hooks/use-web-notifications';
import type { Reminder, ReminderInput } from '@/types/database';

/** De quanto em quanto tempo a tela confere se venceu algum lembrete. */
const CHECK_MS = 30_000;

export function useReminders(projectId?: string) {
  const { profile } = useSession();

  return useQuery({
    queryKey: qk.reminders(projectId),
    enabled: Boolean(profile),
    queryFn: async (): Promise<Reminder[]> => {
      let request = createClient()
        .from('reminders')
        .select('*, project:projects(id, name, code)')
        .order('next_at', { ascending: true });

      if (projectId) request = request.eq('project_id', projectId);

      const { data, error } = await request;

      // Banco ainda sem a migration 13: a tela some, em vez de quebrar.
      if (error) {
        if (isSchemaOutdated(error)) return [];
        throw error;
      }
      return data as Reminder[];
    },
  });
}

export function useReminderMutations(projectId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reminders'] });

  const save = useMutation({
    mutationFn: async ({ id, ...input }: ReminderInput & { id?: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sua sessão expirou. Recarregue a página e entre de novo.');

      const row = { ...input, user_id: user.id, project_id: input.project_id ?? projectId ?? null };

      const { error } = id
        ? await supabase.from('reminders').update(row).eq('id', id)
        : await supabase.from('reminders').insert(row);

      if (error) {
        throw new Error(
          isSchemaOutdated(error)
            ? `Os lembretes ainda não existem neste banco. ${SETUP_HINT}`
            : describeDbError(error),
        );
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success('Lembrete programado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('reminders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Lembrete removido.');
    },
    onError: (error: Error) => toast.error(describeDbError(error)),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await createClient().from('reminders').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(describeDbError(error)),
  });

  return { save, remove, toggle };
}

/**
 * O relógio dos lembretes. Fica montado uma vez no app inteiro e, de meio em
 * meio minuto, pergunta ao banco o que venceu.
 *
 * Por que o banco decide, e não um `setTimeout` no navegador: um timer só vale
 * enquanto a aba está viva. Guardando a hora no banco, o lembrete sobrevive a
 * recarregar a página, trocar de máquina e fechar tudo no fim do dia — e, se
 * ninguém estava com o sistema aberto na hora marcada, ele aparece na próxima
 * vez que abrir, atrasado mas não perdido.
 *
 * Com várias abas abertas, todas perguntam ao mesmo tempo. Quem avisa é a
 * primeira que conseguir *reservar* o lembrete: o UPDATE condicional só
 * devolve linha para uma delas, e as outras recebem vazio e ficam quietas.
 */
export function useReminderRunner() {
  const { profile } = useSession();
  const queryClient = useQueryClient();
  const web = useWebNotifications();

  // Em ref para o efeito não ser recriado a cada render do app.
  const showRef = React.useRef(web.show);
  showRef.current = web.show;

  React.useEffect(() => {
    if (!profile) return;

    let stopped = false;

    async function check() {
      const supabase = createClient();
      const now = new Date();

      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('is_active', true)
        .lte('next_at', now.toISOString())
        .order('next_at', { ascending: true })
        .limit(10);

      // Banco sem a migration 13, ou offline: silêncio é melhor que um toast
      // de erro a cada trinta segundos.
      if (error || !data?.length) return;

      for (const reminder of data as Reminder[]) {
        const repeat = reminder.repeat_minutes;

        // Reserva: quem levar a linha é quem avisa. O `next_at` no filtro é o
        // que a outra aba também viu — se ela chegou antes, aqui volta vazio.
        const claim = await supabase
          .from('reminders')
          .update(
            repeat
              ? {
                  next_at: new Date(now.getTime() + repeat * 60_000).toISOString(),
                  last_fired_at: now.toISOString(),
                }
              : { is_active: false, last_fired_at: now.toISOString() },
          )
          .eq('id', reminder.id)
          .eq('next_at', reminder.next_at)
          .select('id');

        if (claim.error || !claim.data?.length || stopped) continue;

        showRef.current({
          title: reminder.title,
          body: reminder.body,
          tag: reminder.id,
          href: reminder.project_id ? `/projetos/${reminder.project_id}` : undefined,
        });

        // Com a aba à vista o balão do navegador não aparece; o aviso dentro
        // do app garante que a pessoa veja de um jeito ou de outro.
        if (typeof document !== 'undefined' && !document.hidden) {
          toast(reminder.title, { description: reminder.body ?? undefined });
        }

        // Entra no sino, junto com os outros alertas do dia.
        await supabase.from('notifications').insert({
          user_id: reminder.user_id,
          type: 'sistema',
          title: reminder.title,
          body: reminder.body,
          project_id: reminder.project_id,
          entity_type: 'reminder',
          entity_id: reminder.id,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: qk.notifications });
    }

    void check();
    const id = setInterval(() => void check(), CHECK_MS);

    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [profile, queryClient]);
}
