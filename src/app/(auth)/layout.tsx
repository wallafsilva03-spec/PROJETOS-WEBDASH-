import { BrandPills, LogoMark } from '@/components/brand/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Painel institucional */}
      <aside className="relative hidden overflow-hidden bg-moreno-blue-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #8CC63F 0%, transparent 70%)' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 size-[26rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #0E8F46 0%, transparent 70%)' }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-white p-2">
            <LogoMark className="size-8" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">Grupo Moreno</p>
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Gestão de Projetos</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="text-balance font-display text-4xl font-semibold leading-tight">
            Todo o portfólio corporativo em um só lugar.
          </h1>
          <p className="text-white/70">
            Kanban, Gantt, roadmap executivo, capacidade da equipe e indicadores de saúde dos projetos —
            atualizados em tempo real para todos os times.
          </p>
          <BrandPills />
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} Grupo Moreno · Plataforma interna de gestão de projetos
        </p>
      </aside>

      {/* Formulário */}
      <main id="conteudo" className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="size-10" />
            <div>
              <p className="font-display font-semibold text-moreno-blue-600 dark:text-moreno-blue-200">
                Grupo Moreno
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Gestão de Projetos</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
