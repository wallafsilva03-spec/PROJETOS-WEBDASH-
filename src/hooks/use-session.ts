'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query-keys';
import { ROLE_META, normalizeRole } from '@/lib/constants';
import type { AppRole, Profile } from '@/types/database';

export interface SessionProfile extends Profile {
  department: { id: string; name: string; color: string } | null;
}

/** Perfil do usuário autenticado + helpers de permissão. */
export function useSession() {
  const query = useQuery({
    queryKey: qk.session,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SessionProfile | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*, department:departments(id, name, color)')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data as SessionProfile;
    },
  });

  // `gerente` ainda pode vir de um banco sem a migration 11 — é o analista.
  const role = normalizeRole(query.data?.role);

  return {
    ...query,
    profile: query.data ?? null,
    role,
    isAdmin: role === 'administrador',
    isManager: role === 'administrador' || role === 'analista',
    canCreateProject: role === 'administrador' || role === 'analista' || role === 'lider',
    hasRole: (minimum: AppRole) => (role ? ROLE_META[role].rank >= ROLE_META[minimum].rank : false),
  };
}
