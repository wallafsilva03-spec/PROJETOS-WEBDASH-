import { AlertTriangle } from 'lucide-react';

import { LogoMark } from '@/components/brand/logo';

/**
 * Tela exibida quando a aplicação sobe sem credenciais válidas do Supabase.
 * Substitui o "Application error" genérico do Next por uma orientação concreta.
 */
export function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl space-y-6 rounded-xl border bg-card p-8 shadow-card">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <p className="font-display font-semibold text-moreno-blue-600 dark:text-moreno-blue-200">
              Grupo Moreno
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Gestão de Projetos</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="space-y-1">
            <h1 className="font-semibold">Configuração incompleta</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <p className="font-medium">Para resolver:</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>
              No Supabase, abra <strong>Project Settings → API</strong> e copie a{' '}
              <strong>Project URL</strong> e a chave <strong>anon public</strong>.
            </li>
            <li>
              Na Vercel, vá em <strong>Settings → Environment Variables</strong> e cadastre{' '}
              <code className="rounded bg-secondary px-1">NEXT_PUBLIC_SUPABASE_URL</code> e{' '}
              <code className="rounded bg-secondary px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, marcando o
              ambiente <strong>Production</strong>.
            </li>
            <li>
              Refaça o deploy em <strong>Deployments → ⋯ → Redeploy</strong>, sem usar o cache de build.
              Essas variáveis entram no código durante a compilação, então só passam a valer depois de um
              build novo.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Rodando na sua máquina, os mesmos valores vão no arquivo <code>.env.local</code>.
          </p>
        </div>
      </div>
    </main>
  );
}
