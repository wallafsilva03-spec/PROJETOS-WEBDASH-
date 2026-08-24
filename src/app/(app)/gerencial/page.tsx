import type { Metadata } from 'next';

import { GerencialView } from './gerencial-view';

export const metadata: Metadata = {
  title: 'Visão Gerencial',
  description:
    'Portfólio consolidado para a Diretoria: percentual de conclusão, distribuição por status, ' +
    'evolução por área e indicadores de governança.',
};

export default function GerencialPage() {
  return <GerencialView />;
}
