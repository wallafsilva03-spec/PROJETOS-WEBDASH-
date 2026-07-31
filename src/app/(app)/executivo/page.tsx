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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();

  // A RLS já limita os dados; o guard evita expor a tela a quem não é gestão.
  if (profile?.role !== 'administrador' && profile?.role !== 'gerente') {
    redirect('/dashboard');
  }

  return <ExecutivoView />;
}
