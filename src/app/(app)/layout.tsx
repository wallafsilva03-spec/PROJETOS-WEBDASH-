import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { ConfigErrorScreen } from '@/components/layout/config-error';
import { createClient } from '@/lib/supabase/server';
import { readSupabaseEnv } from '@/lib/supabase/env';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Sem credenciais válidas o cliente do Supabase lança exceção. Verificar antes
  // troca o "Application error" opaco do Next por uma orientação do que fazer.
  const { env, error } = readSupabaseEnv();
  if (!env) return <ConfigErrorScreen message={error!} />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return <AppShell>{children}</AppShell>;
}
