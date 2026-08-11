import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { normalizeRole } from '@/lib/constants';
import { AnalistasView } from './analistas-view';

export const metadata: Metadata = {
  title: 'Gestão por analista',
  description: 'Projetos, prazos e atrasos de cada responsável — visão exclusiva da administração.',
};

export default async function AnalistasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sem sessão legível no servidor, seguir adiante quebraria a página inteira.
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // Acompanhamento pessoa a pessoa é só da administração. Perfil ainda não
  // criado é tratado como sem permissão, não como erro.
  if (normalizeRole(profile?.role) !== 'administrador') {
    redirect('/dashboard');
  }

  return <AnalistasView />;
}
