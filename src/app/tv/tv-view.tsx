'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  LogOut,
  Maximize,
  Minimize,
  ShieldCheck,
  Timer,
  UserCog,
} from 'lucide-react';

import { AuroraBackdrop, AuroraRail } from '@/components/brand/aurora';
import { BrandManifesto } from '@/components/brand/manifesto';
import { LogoMark } from '@/components/brand/logo';
import { useDashboardKpis } from '@/hooks/use-analytics';
import { useProjects } from '@/hooks/use-projects';
import { buildAnalystSummaries, UNASSIGNED } from '@/lib/analyst-overview';
import { HEALTH_META, PROJECT_STATUS_META } from '@/lib/constants';
import { isClosed, isDueWithin, isLate } from '@/lib/project-filters';
import { formatDate, formatHours, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { HealthStatus, ProjectOverview } from '@/types/database';

/** Quanto cada lâmina fica no ar. Onze segundos dá para ler sem cansar. */
const SLIDE_MS = 11_000;

/** Rede de segurança: o Realtime já atualiza, isto cobre evento perdido. */
const REFRESH_MS = 5 * 60_000;

/**
 * Cor da situação, sem confiar que o valor esteja no dicionário.
 *
 * Este projeto já convive com banco mais novo que o site — um status ou uma
 * saúde criados no SQL antes do deploy chegariam aqui sem entrada
 * correspondente. Numa tela comum isso vira um card feio; num telão que fica
 * ligado o dia inteiro, sem ninguém olhando, vira a tela de erro do Next
 * projetada na parede. Então cai num tom neutro e segue.
 */
function statusDot(status: string) {
  return PROJECT_STATUS_META[status as keyof typeof PROJECT_STATUS_META]?.dot ?? 'bg-white/40';
}

function healthDot(health: string) {
  return HEALTH_META[health as HealthStatus]?.dot ?? 'bg-white/40';
}

/* ------------------------------------------------------------------ Peças */

/** Bloco que sobe ao entrar. O atraso escalona a lâmina inteira. */
function Rise({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('animate-tv-rise', className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Número gigante com rótulo — a unidade de leitura à distância. */
function BigStat({
  label,
  value,
  hint,
  tone = 'text-white',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[clamp(0.7rem,1.1vw,1rem)] font-semibold uppercase tracking-[0.2em] text-white/50">
        {label}
      </p>
      <p
        className={cn(
          'animate-tv-breathe font-display font-semibold leading-none tracking-tight',
          'text-[clamp(3rem,8vw,7.5rem)]',
          tone,
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-[clamp(0.75rem,1.1vw,1.05rem)] text-white/60">{hint}</p>}
    </div>
  );
}

/** Cabeçalho de lâmina: ícone, título e uma linha de contexto. */
function SlideTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof AlertTriangle;
  title: string;
  subtitle?: string;
}) {
  return (
    <Rise className="flex items-center gap-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
        <Icon className="size-7 text-white" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-[clamp(1.6rem,3.2vw,3rem)] font-semibold leading-tight text-white">
          {title}
        </h2>
        {subtitle && <p className="text-[clamp(0.85rem,1.2vw,1.15rem)] text-white/60">{subtitle}</p>}
      </div>
    </Rise>
  );
}

/** Linha de projeto usada nas lâminas de atenção e de prazo. */
function ProjectLine({
  project,
  delay,
  right,
  tone,
}: {
  project: ProjectOverview;
  delay: number;
  right: React.ReactNode;
  tone: string;
}) {
  return (
    <Rise delay={delay}>
      <div className="flex items-center gap-5 rounded-2xl bg-white/[0.06] px-6 py-4 backdrop-blur-sm">
        <span className={cn('h-12 w-1.5 shrink-0 rounded-full', tone)} aria-hidden />

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[clamp(1rem,1.7vw,1.6rem)] font-semibold text-white">
            {project.name}
          </p>
          <p className="truncate text-[clamp(0.7rem,1vw,0.95rem)] text-white/55">
            {project.code}
            {project.department_name ? ` · ${project.department_name}` : ''}
            {project.responsibles?.length
              ? ` · ${project.responsibles.slice(0, 2).join(', ')}`
              : project.owner_name
                ? ` · ${project.owner_name}`
                : ''}
          </p>
        </div>

        <div className="hidden w-40 shrink-0 sm:block">
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white/80"
              style={{ width: `${Math.min(Math.max(project.progress, 0), 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-right text-[clamp(0.65rem,0.9vw,0.85rem)] text-white/55">
            {formatPercent(project.progress)} executado
          </p>
        </div>

        <div className="w-36 shrink-0 text-right">{right}</div>
      </div>
    </Rise>
  );
}

/** Vazio de lâmina — boa notícia, e não erro. */
function AllClear({ message }: { message: string }) {
  return (
    <Rise delay={120} className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <ShieldCheck className="size-20 text-moreno-lime-400" aria-hidden />
      <p className="font-display text-[clamp(1.4rem,3vw,2.6rem)] font-semibold text-white">{message}</p>
    </Rise>
  );
}

/* ---------------------------------------------------------------- Relógio */

/**
 * Isolado num componente só dele: é o único pedaço que muda de segundo em
 * segundo, e assim o resto do mural não volta a renderizar junto.
 *
 * Só aparece depois de montado — a hora do servidor e a do navegador não
 * batem, e o React reclamaria da diferença.
 */
function Clock() {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <div className="h-14" aria-hidden />;

  return (
    <div className="text-right">
      <p className="font-display text-[clamp(1.4rem,2.4vw,2.4rem)] font-semibold leading-none text-white tabular-nums">
        {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
      {/* `first-letter`, e não `capitalize`: em português só a primeira letra
          sobe — `capitalize` produziria "Terça-Feira, 11 De Agosto". */}
      <p className="mt-1 text-[clamp(0.7rem,1vw,0.9rem)] text-white/55 first-letter:uppercase">
        {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Tela */

export function TvView() {
  const kpis = useDashboardKpis();
  const projects = useProjects({ sort: 'due_date' });

  const list = React.useMemo(() => projects.data ?? [], [projects.data]);

  /* Recortes do portfólio, todos derivados da mesma lista. */
  const late = React.useMemo(
    () => list.filter(isLate).sort((a, b) => b.days_late - a.days_late).slice(0, 5),
    [list],
  );

  const soon = React.useMemo(
    () =>
      list
        .filter((project) => !project.prazo_a_definir && isDueWithin(project, 15))
        .sort((a, b) => a.days_remaining - b.days_remaining)
        .slice(0, 5),
    [list],
  );

  const health = React.useMemo(() => {
    const open = list.filter((project) => !isClosed(project));
    const counts = Object.keys(HEALTH_META).map((key) => ({
      key: key as HealthStatus,
      meta: HEALTH_META[key as HealthStatus],
      total: open.filter((project) => project.health === key).length,
    }));
    return { counts, open: open.length };
  }, [list]);

  const analysts = React.useMemo(
    () =>
      buildAnalystSummaries(list)
        .filter((analyst) => analyst.name !== UNASSIGNED && analyst.total > 0)
        .sort((a, b) => b.atrasados - a.atrasados || b.total - a.total)
        .slice(0, 5),
    [list],
  );

  /* ------------------------------------------------------------- Lâminas */
  const k = kpis.data;

  const slides: { key: string; node: React.ReactNode }[] = [
    {
      key: 'panorama',
      node: (
        <div className="flex flex-1 flex-col justify-center gap-12">
          <Rise>
            <p className="text-[clamp(0.8rem,1.3vw,1.2rem)] font-semibold uppercase tracking-[0.28em] text-moreno-lime-400">
              Panorama do portfólio
            </p>
          </Rise>

          <div className="grid grid-cols-2 gap-x-10 gap-y-12 xl:grid-cols-4">
            <Rise delay={80}>
              <BigStat
                label="Projetos ativos"
                value={formatNumber(k?.projetos_ativos ?? 0)}
                hint={`${formatNumber(k?.projetos_concluidos ?? 0)} já concluídos`}
              />
            </Rise>
            <Rise delay={160}>
              <BigStat
                label="Em atraso"
                value={formatNumber(k?.projetos_atrasados ?? 0)}
                hint={`${formatNumber(k?.projetos_em_risco ?? 0)} em risco`}
                tone={k?.projetos_atrasados ? 'text-rose-400' : 'text-moreno-lime-400'}
              />
            </Rise>
            <Rise delay={240}>
              <BigStat
                label="Indicador geral"
                value={formatPercent(k?.indicador_geral ?? 0)}
                hint="Saúde consolidada do portfólio"
                tone="text-moreno-lime-400"
              />
            </Rise>
            <Rise delay={320}>
              <BigStat
                label="Tarefas concluídas"
                value={formatNumber(k?.tarefas_concluidas ?? 0)}
                hint={`de ${formatNumber(k?.total_tarefas ?? 0)} no total`}
              />
            </Rise>
          </div>

          <Rise delay={420}>
            <div className="flex flex-wrap items-center gap-x-12 gap-y-4 border-t border-white/10 pt-8 text-[clamp(0.8rem,1.2vw,1.15rem)] text-white/70">
              <span>
                <strong className="font-semibold text-white">{formatHours(k?.horas_realizadas ?? 0)}</strong>{' '}
                realizadas de {formatHours(k?.horas_planejadas ?? 0)} planejadas
              </span>
              <span>
                <strong className="font-semibold text-white">
                  {formatNumber(k?.tarefas_concluidas_hoje ?? 0)}
                </strong>{' '}
                entregas hoje
              </span>
              <span>
                <strong className="font-semibold text-white">{formatNumber(k?.usuarios_online ?? 0)}</strong>{' '}
                pessoas online agora
              </span>
            </div>
          </Rise>
        </div>
      ),
    },
    {
      key: 'saude',
      node: (
        <div className="flex flex-1 flex-col gap-10">
          <SlideTitle
            icon={ShieldCheck}
            title="Saúde do portfólio"
            subtitle={`${formatNumber(health.open)} projeto(s) em aberto, por situação de execução`}
          />

          <div className="flex flex-1 flex-col justify-center gap-5">
            {health.counts.map((row, index) => {
              const share = health.open ? (row.total / health.open) * 100 : 0;

              return (
                <Rise key={row.key} delay={100 + index * 90}>
                  <div className="flex items-center gap-6">
                    <span className="w-40 shrink-0 text-[clamp(0.9rem,1.4vw,1.35rem)] font-medium text-white/80">
                      {row.meta.label}
                    </span>
                    <div className="h-8 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn('h-full rounded-full transition-[width] duration-1000', row.meta.dot)}
                        style={{ width: `${Math.max(share, row.total ? 3 : 0)}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right font-display text-[clamp(1.2rem,2.4vw,2.2rem)] font-semibold text-white tabular-nums">
                      {formatNumber(row.total)}
                    </span>
                  </div>
                </Rise>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      key: 'atencao',
      node: (
        <div className="flex flex-1 flex-col gap-8">
          <SlideTitle
            icon={AlertTriangle}
            title="Exigem atenção"
            subtitle="Projetos atrasados ou críticos, do mais vencido para o menos"
          />

          {late.length ? (
            <div className="flex flex-1 flex-col justify-center gap-4">
              {late.map((project, index) => (
                <ProjectLine
                  key={project.id}
                  project={project}
                  delay={100 + index * 90}
                  tone={healthDot(project.health)}
                  right={
                    <>
                      <p className="font-display text-[clamp(1.3rem,2.6vw,2.4rem)] font-semibold leading-none text-rose-400 tabular-nums">
                        {formatNumber(project.days_late)}
                      </p>
                      <p className="text-[clamp(0.65rem,0.9vw,0.85rem)] uppercase tracking-wider text-white/50">
                        dias de atraso
                      </p>
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <AllClear message="Nenhum projeto atrasado. Portfólio no prazo." />
          )}
        </div>
      ),
    },
    {
      key: 'prazos',
      node: (
        <div className="flex flex-1 flex-col gap-8">
          <SlideTitle
            icon={CalendarClock}
            title="Próximas entregas"
            subtitle="Projetos com prazo nos próximos 15 dias"
          />

          {soon.length ? (
            <div className="flex flex-1 flex-col justify-center gap-4">
              {soon.map((project, index) => (
                <ProjectLine
                  key={project.id}
                  project={project}
                  delay={100 + index * 90}
                  tone={statusDot(project.status)}
                  right={
                    <>
                      <p className="font-display text-[clamp(1.3rem,2.6vw,2.4rem)] font-semibold leading-none text-white tabular-nums">
                        {formatNumber(project.days_remaining)}
                      </p>
                      <p className="text-[clamp(0.65rem,0.9vw,0.85rem)] uppercase tracking-wider text-white/50">
                        dias · {formatDate(project.due_date, 'dd/MM')}
                      </p>
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <AllClear message="Nenhuma entrega nos próximos 15 dias." />
          )}
        </div>
      ),
    },
    {
      key: 'analistas',
      node: (
        <div className="flex flex-1 flex-col gap-8">
          <SlideTitle
            icon={UserCog}
            title="Gestão por analista"
            subtitle="Quem responde por mais projetos, e quanto está em atraso"
          />

          {analysts.length ? (
            <div className="flex flex-1 flex-col justify-center gap-4">
              {analysts.map((analyst, index) => (
                <Rise key={analyst.key} delay={100 + index * 90}>
                  <div className="flex items-center gap-6 rounded-2xl bg-white/[0.06] px-6 py-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-lg font-semibold text-white">
                      {analyst.name.slice(0, 2).toUpperCase()}
                    </span>

                    <p className="min-w-0 flex-1 truncate font-display text-[clamp(1rem,1.8vw,1.7rem)] font-semibold text-white">
                      {analyst.name}
                    </p>

                    <div className="w-32 shrink-0 text-right">
                      <p className="font-display text-[clamp(1.2rem,2.2vw,2rem)] font-semibold leading-none text-white tabular-nums">
                        {formatNumber(analyst.total)}
                      </p>
                      <p className="text-[clamp(0.65rem,0.9vw,0.8rem)] uppercase tracking-wider text-white/50">
                        projetos
                      </p>
                    </div>

                    <div className="w-32 shrink-0 text-right">
                      <p
                        className={cn(
                          'font-display text-[clamp(1.2rem,2.2vw,2rem)] font-semibold leading-none tabular-nums',
                          analyst.atrasados ? 'text-rose-400' : 'text-moreno-lime-400',
                        )}
                      >
                        {formatNumber(analyst.atrasados)}
                      </p>
                      <p className="text-[clamp(0.65rem,0.9vw,0.8rem)] uppercase tracking-wider text-white/50">
                        em atraso
                      </p>
                    </div>
                  </div>
                </Rise>
              ))}
            </div>
          ) : (
            <AllClear message="Nenhum responsável com projeto em aberto." />
          )}
        </div>
      ),
    },
    {
      key: 'marca',
      node: (
        <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
          <Rise>
            <LogoMark className="size-24" />
          </Rise>
          <Rise delay={120}>
            <p className="font-display text-[clamp(2rem,5vw,4.5rem)] font-semibold leading-tight text-white">
              Todo o portfólio corporativo
              <br />
              em um só lugar.
            </p>
          </Rise>
          <Rise delay={240}>
            <BrandManifesto className="flex flex-col items-center" />
          </Rise>
        </div>
      ),
    },
  ];

  /* ------------------------------------------------------------- Rotação */
  const [index, setIndex] = React.useState(0);
  const total = slides.length;

  /**
   * `setTimeout` recriado a cada troca, e não um `setInterval` fixo: assim a
   * lâmina escolhida no rodapé ganha o tempo inteiro dela. Com o intervalo
   * fixo, clicar num ponto podia mostrar a lâmina por um segundo antes de o
   * relógio antigo passar para a seguinte.
   */
  React.useEffect(() => {
    const id = setTimeout(() => setIndex((current) => (current + 1) % total), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, total]);

  /**
   * Teclado — e, por tabela, o controle remoto: quase todo navegador de TV
   * manda as setas do controle como setas do teclado, então dá para passar as
   * lâminas sem chegar perto de um mouse.
   */
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const next = () => setIndex((current) => (current + 1) % total);
      const previous = () => setIndex((current) => (current - 1 + total) % total);

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        previous();
      } else if (event.key.toLowerCase() === 'f') {
        void toggleFullscreen();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  React.useEffect(() => {
    const id = setInterval(() => {
      void kpis.refetch();
      void projects.refetch();
    }, REFRESH_MS);
    return () => clearInterval(id);
    // As funções de refetch trocam de identidade a cada render; o intervalo
    // não deve ser recriado por causa disso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------ Tela cheia e cursor */
  const [fullscreen, setFullscreen] = React.useState(false);
  const [idle, setIdle] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  // Sem mexer o mouse por cinco segundos, o cursor e o botão somem da TV.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 5000);
    };

    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen().catch(() => undefined);
  }

  const loading = kpis.isLoading || projects.isLoading;

  return (
    <main
      className={cn(
        'relative flex h-dvh flex-col overflow-hidden bg-moreno-blue-900 text-white',
        idle && 'cursor-none',
      )}
    >
      <AuroraBackdrop />
      <div className="pointer-events-none absolute inset-0 bg-moreno-blue-900/55" aria-hidden />
      <AuroraRail className="absolute inset-x-0 bottom-0 h-1 w-full" duration="6s" />

      {/* Barra do tempo da lâmina: reinicia a cada troca porque é remontada. */}
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/10">
        <div
          key={index}
          className="h-full origin-left animate-tv-progress bg-gradient-brand"
          style={{ animationDuration: `${SLIDE_MS}ms` }}
        />
      </div>

      {/* Cabeçalho */}
      <header className="relative z-10 flex items-start justify-between px-[4vw] pb-6 pt-10">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white p-2.5">
            <LogoMark className="size-9" />
          </span>
          <div>
            <p className="font-display text-[clamp(1.1rem,1.8vw,1.7rem)] font-semibold leading-tight">
              Grupo Moreno
            </p>
            <p className="text-[clamp(0.65rem,0.9vw,0.85rem)] uppercase tracking-[0.22em] text-white/50">
              Mural de indicadores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Clock />

          {/* Somem juntos quando o mouse para: na TV a tela fica só o mural. */}
          <div className={cn('flex items-center gap-2 transition-opacity', idle && 'pointer-events-none opacity-0')}>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="rounded-xl bg-white/10 p-3 hover:bg-white/20"
              aria-label={fullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
              title="Tela cheia (F)"
            >
              {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>

            <Link
              href="/dashboard"
              className="rounded-xl bg-white/10 p-3 hover:bg-white/20"
              aria-label="Sair do modo TV"
              title="Sair do modo TV"
            >
              <LogOut className="size-5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Lâmina */}
      <section className="relative z-10 flex flex-1 flex-col px-[4vw] pb-6">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Timer className="size-16 animate-pulse text-white/40" aria-hidden />
          </div>
        ) : (
          /* A `key` remonta o bloco: é o que faz as entradas rodarem de novo. */
          <div key={slides[index].key} className="flex flex-1 flex-col">
            {slides[index].node}
          </div>
        )}
      </section>

      {/* Rodapé */}
      <footer className="relative z-10 flex items-center justify-between px-[4vw] pb-8">
        <p className="text-[clamp(0.7rem,1vw,0.9rem)] text-white/45">
          Atualizado em tempo real · {formatNumber(list.length)} projeto(s) no portfólio
        </p>

        <ul className="flex items-center gap-2" aria-label="Lâminas do mural">
          {slides.map((slide, position) => (
            <li key={slide.key}>
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Ir para a lâmina ${position + 1}`}
                aria-current={position === index}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  position === index ? 'w-10 bg-white' : 'w-4 bg-white/25 hover:bg-white/50',
                  idle && 'pointer-events-none',
                )}
              />
            </li>
          ))}
        </ul>
      </footer>
    </main>
  );
}
