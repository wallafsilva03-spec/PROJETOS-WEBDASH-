import type { Metadata, Viewport } from 'next';

import { TvView } from './tv-view';

export const metadata: Metadata = {
  title: 'Mural de indicadores',
  description: 'Painel de descanso para TV: indicadores do portfólio em rotação automática.',
};

/** Numa TV a tela não dorme por conta do navegador, mas o fundo escuro ajuda. */
export const viewport: Viewport = {
  themeColor: '#0B1B3F',
};

export default function TvPage() {
  return <TvView />;
}
