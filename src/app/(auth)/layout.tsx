import { AuroraBackdrop, AuroraRail } from '@/components/brand/aurora';
import { BrandPills, LogoMark } from '@/components/brand/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Painel institucional — a aurora corre por trás do texto */}
      <aside className="relative hidden overflow-hidden bg-moreno-blue-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <AuroraBackdrop />

        {/* Véu escuro: garante o contraste do texto sobre a cor em movimento. */}
        <div className="pointer-events-none absolute inset-0 bg-moreno-blue-900/35" aria-hidden />

        <AuroraRail className="absolute inset-y-0 right-0 w-[3px]" duration="5s" />

        <div className="relative flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-white p-2 shadow-brand">
            <LogoMark className="size-8" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">Grupo Moreno</p>
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Gestão de Projetos</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="text-balance font-display text-4xl font-semibold leading-tight drop-shadow-sm">
            Todo o portfólio corporativo em um só lugar.
          </h1>
          <p className="text-white/75">
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
      <main
        id="conteudo"
        className="relative flex items-center justify-center overflow-hidden bg-background p-6 sm:p-10"
      >
        {/* De leve também deste lado: o cartão flutua sobre a cor em movimento. */}
        <AuroraBackdrop className="opacity-[0.22]" intensity="soft" />
        <AuroraRail className="absolute inset-y-0 left-0 w-1 lg:hidden" duration="5s" />

        <div className="relative w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="size-10" />
            <div>
              <p className="font-display font-semibold text-moreno-blue-600 dark:text-moreno-blue-200">
                Grupo Moreno
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Gestão de Projetos</p>
            </div>
          </div>

          {/* Cartão de vidro: o conteúdo flutua sobre a cor sem perder legibilidade. */}
          <div className="overflow-hidden rounded-2xl border bg-card/85 shadow-card-hover backdrop-blur-xl">
            <div className="brand-bar rounded-none" />
            <div className="p-6 sm:p-7">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
