'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query-keys';
import { ROLE_META, normalizeRole } from '@/lib/constants';
import type { AppRole, Profile } from '@/types/database';

export type SessionProfile = Profile;

/**
 * Perfil do usuário autenticado + helpers de permissão.
 *
 * A consulta pede só a linha de `profiles`, sem embutir o departamento.
 * O motivo é histórico e concreto: quando a migration 10 acrescentou
 * `departments.created_by`, passaram a existir duas ligações entre as duas
 * tabelas e o PostgREST recusou `profiles?select=*,departments(...)` com
 * PGRST201. Como o papel de acesso saía dessa mesma consulta, o site inteiro
 * rebaixou todo mundo a usuário comum — e o botão de criar projeto sumiu sem
 * dizer por quê. O `join` nunca foi usado por tela nenhuma (quem precisa do
 * departamento lê `profile.department_id` com o catálogo de `useDepartments`),
 * então ele sai daqui de vez: o papel não depende mais de relacionamento.
 */
export function useSession() {
  const query = useQuery({
    queryKey: qk.session,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SessionProfile | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // Sem sessão não há o que carregar — é o estado do visitante, não falha.
      if (!user) return null;

      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

      if (error) throw error;
      // Autenticado sem linha em `profiles` é banco inconsistente, não visitante:
      // vira erro para a tela poder avisar em vez de tratar como sem permissão.
      if (!data) throw new Error('Perfil do usuário não encontrado no banco.');

      return data as SessionProfile;
    },
  });

  // `gerente` ainda pode vir de um banco sem a migration 11 — é o analista.
  const role = normalizeRole(query.data?.role);

  /** O perfil existe, mas não chegou: papel desconhecido, não papel baixo. */
  const profileUnavailable = query.isError;

  return {
    ...query,
    profile: query.data ?? null,
    role,
    profileUnavailable,
    /** Mensagem do erro que impediu o perfil de carregar, se houve um. */
    profileError: query.error as Error | null,
    // Superfícies privilegiadas continuam fechadas quando o papel é desconhecido.
    isAdmin: role === 'administrador',
    isManager: role === 'administrador' || role === 'analista',
    /**
     * Criar projeto é a exceção deliberada: quando o perfil não carregou, o
     * papel é desconhecido — e esconder a ação transforma uma falha de leitura
     * em uma plataforma sem entrada de projeto, silenciosamente. Aqui a ação
     * continua à mostra e quem decide é a policy `projects_insert` no banco,
     * que já devolve um erro explícito em toast para quem não pode inserir.
     */
    canCreateProject: role
      ? role === 'administrador' || role === 'analista' || role === 'lider'
      : profileUnavailable,
    hasRole: (minimum: AppRole) => (role ? ROLE_META[role].rank >= ROLE_META[minimum].rank : false),
  };
}
