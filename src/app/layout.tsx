import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

import { Providers } from '@/components/providers';
import '@/styles/globals.css';

/**
 * Fontes servidas pelo próprio projeto (src/fonts), não pelo Google.
 * `next/font/google` baixa os arquivos durante o build, e ambientes de CI sem
 * acesso a fonts.gstatic.com falham. Com os arquivos versionados no
 * repositório o build fica offline e determinístico.
 *
 * São variáveis (um arquivo cobre toda a faixa de peso) e trazem o subconjunto
 * latin, cuja faixa U+00C0–U+00FF cobre toda a acentuação do português.
 */
const inter = localFont({
  src: './../fonts/inter-latin.woff2',
  variable: '--font-sans',
  display: 'swap',
  weight: '100 900',
  fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

const mono = localFont({
  src: './../fonts/jetbrains-mono-latin.woff2',
  variable: '--font-mono',
  display: 'swap',
  weight: '100 800',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});

export const metadata: Metadata = {
  title: {
    default: 'WebDash · Gestão de Projetos — Grupo Moreno',
    template: '%s · WebDash Grupo Moreno',
  },
  description:
    'Plataforma corporativa de gestão de projetos do Grupo Moreno: portfólio, Kanban, Gantt, workload e KPIs em tempo real.',
  applicationName: 'WebDash Grupo Moreno',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1B3F94' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1220' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Pular para o conteúdo principal
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
