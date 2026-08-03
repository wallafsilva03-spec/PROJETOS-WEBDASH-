import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { ExecutivoView } from './executivo-view';

export const metadata: Metadata = {
  title: 'Dashboard Executivo',
  description: 'KPIs de portfólio para a diretoria: fluxo, saúde, distribuição e projetos críticos.',
};

export default async function ExecutivoPage() {
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

  // A RLS já limita os dados; o guard evita expor a tela a quem não é gestão.
  // Perfil ainda não criado é tratado como sem permissão, não como erro.
  if (profile?.role !== 'administrador' && profile?.role !== 'gerente') {
    redirect('/dashboard');
  }

  return <ExecutivoView />;
}
