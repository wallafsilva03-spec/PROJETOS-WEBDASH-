import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireSupabaseEnv } from './env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Cliente Supabase para Server Components, Route Handlers e Server Actions. */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseEnv();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Chamado a partir de um Server Component: a renovação do token
            // é feita pelo middleware, então é seguro ignorar.
          }
        },
      },
    },
  );
}

/** Sessão + perfil do usuário logado. Retorna null quando não autenticado. */
export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, department:departments(id, name, color)')
    .eq('id', user.id)
    .single();

  return profile ?? null;
}
