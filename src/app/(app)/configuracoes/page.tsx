import type { Metadata } from 'next';

import { ConfiguracoesView } from './configuracoes-view';

export const metadata: Metadata = {
  title: 'Configurações',
  description: 'Perfil do usuário, permissões de acesso e identidade visual.',
};

export default function ConfiguracoesPage() {
  return <ConfiguracoesView />;
}
