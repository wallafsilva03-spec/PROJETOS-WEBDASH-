'use client';

import * as React from 'react';
import Link from 'next/link';
import { addMonths, differenceInCalendarMonths, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronRight, Flag } from 'lucide-react';

import { Hint } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

const MONTH_WIDTH = 132;
const LABEL_WIDTH = 260;
const HEADER_H = 44;
const GROUP_H = 38;
const ROW_H = 64;
const CHILD_H = 46;

export interface RoadmapMarker {
  id: string;
  label: string;
  date: Date;
  done?: boolean;
}

export interface RoadmapItem {
  id: string;
  label: string;
  sublabel?: string;
  start: Date;
  end: Date;
  progress: number;
  /** Texto curto dentro da barra, à direita do percentual. */
  caption?: string;
  tooltip?: React.ReactNode;
  href?: string;
  /** Cor da barra. Sem isto, o gradiente da marca. */
  barClassName?: string;
  /** Faixa colorida à esquerda do rótulo — usada para saúde e situação. */
  accentClassName?: string;
  late?: boolean;
  markers?: RoadmapMarker[];
  /** Linhas filhas (as etapas de um projeto), abertas ao clicar no rótulo. */
  children?: RoadmapItem[];
}

export interface RoadmapGroup {
  key: string;
  label: string;
  className?: string;
  items: RoadmapItem[];
}

/** Uma linha desenhada — cabeçalho de grupo, projeto ou etapa. */
type Line =
  | { kind: 'group'; key: string; label: string; total: number; className?: string; height: number }
  | {
      kind: 'item';
      key: string;
      item: RoadmapItem;
      depth: number;
      height: number;
      expanded: boolean;
    };

function toLines(groups: RoadmapGroup[], expanded: Set<string>, showGroups: boolean): Line[] {
  const lines: Line[] = [];

  groups.forEach((group) => {
    if (showGroups) {
      lines.push({
        kind: 'group',
        key: `group-${group.key}`,
        label: group.label,
        total: group.items.length,
        className: group.className,
        height: GROUP_H,
      });
    }

    group.items.forEach((item) => {
      const open = expanded.has(item.id);
      lines.push({ kind: 'item', key: item.id, item, depth: 0, height: ROW_H, expanded: open });

      if (open) {
        (item.children ?? []).forEach((child) => {
          lines.push({
            kind: 'item',
            key: `${item.id}-${child.id}`,
            item: child,
            depth: 1,
            height: CHILD_H,
            expanded: false,
          });
        });
      }
    });
  });

  return lines;
}

interface RoadmapTimelineProps {
  groups: RoadmapGroup[];
  /** Rótulo da coluna fixa da esquerda. */
  labelHeader?: string;
  /** Mostra o cabeçalho de cada grupo. Falso quando há um grupo só. */
  showGroups?: boolean;
  /** Ids abertos por padrão — o quadro guarda a abertura a partir daí. */
  expandedIds?: string[];
  footer?: React.ReactNode;
}

/**
 * Roadmap: uma linha por item, meses na horizontal, barra proporcional à
 * duração e preenchida pelo avanço.
 *
 * O mesmo componente desenha o roadmap do portfólio e o das etapas de um
 * projeto — é o que faz "ver as etapas no modelo do roadmap" ser literalmente
 * o mesmo desenho, e não uma segunda implementação parecida.
 *
 * A coluna de rótulos e a área das barras são geradas da mesma lista de
 * linhas, com a altura declarada em cada uma: é isso que mantém as duas
 * metades alinhadas quando um projeto abre e mostra as etapas.
 */
export function RoadmapTimeline({
  groups,
  labelHeader = 'Projeto',
  showGroups = true,
  expandedIds,
  footer,
}: RoadmapTimelineProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(expandedIds ?? []));

  // O `expandedIds` é um comando ("abra tudo", "feche tudo"), não o estado:
  // quem manda no dia a dia é o clique na seta de cada linha. Por isso só
  // reage quando a lista pedida muda de verdade — senão um refetch do
  // portfólio fecharia o projeto que a pessoa acabou de abrir.
  const wanted = (expandedIds ?? []).join('|');
  const applied = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!expandedIds || applied.current === wanted) return;
    applied.current = wanted;
    setExpanded(new Set(expandedIds));
  }, [expandedIds, wanted]);

  const items = React.useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const range = React.useMemo(() => {
    if (!items.length) return null;
    const starts = items.map((item) => item.start.getTime());
    const ends = items.map((item) => item.end.getTime());
    const min = startOfMonth(new Date(Math.min(...starts)));
    const max = startOfMonth(addMonths(new Date(Math.max(...ends)), 1));
    return { min, months: Math.max(differenceInCalendarMonths(max, min) + 1, 1) };
  }, [items]);

  const lines = React.useMemo(
    () => toLines(groups, expanded, showGroups),
    [groups, expanded, showGroups],
  );

  /** Converte uma data em pixels dentro da faixa de meses. */
  const toX = React.useCallback(
    (date: Date) => {
      if (!range) return 0;
      const months = differenceInCalendarMonths(date, range.min);
      const dayFraction = (date.getDate() - 1) / 30;
      return (months + dayFraction) * MONTH_WIDTH;
    },
    [range],
  );

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!range) return null;

  const bodyHeight = lines.reduce((sum, line) => sum + line.height, 0);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex">
        {/* ------------------------------------------------ Coluna fixa */}
        <div className="shrink-0 border-r" style={{ width: LABEL_WIDTH }}>
          <div
            className="flex items-center border-b bg-secondary/60 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ height: HEADER_H }}
          >
            {labelHeader}
          </div>

          {lines.map((line) => {
            if (line.kind === 'group') {
              return (
                <div
                  key={line.key}
                  className={cn(
                    'flex items-center gap-2 border-b bg-secondary/40 px-4 text-xs font-semibold',
                    line.className,
                  )}
                  style={{ height: line.height }}
                >
                  <span className="truncate">{line.label}</span>
                  <span className="rounded-full bg-card px-1.5 text-[11px] font-medium text-muted-foreground">
                    {line.total}
                  </span>
                </div>
              );
            }

            const { item, depth } = line;
            const hasChildren = Boolean(item.children?.length);

            return (
              <div
                key={line.key}
                className="flex items-center gap-1 border-b pr-2"
                style={{ height: line.height, paddingLeft: depth ? 22 : 0 }}
              >
                {item.accentClassName && (
                  <span className={cn('h-full w-1 shrink-0', item.accentClassName)} aria-hidden />
                )}

                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-expanded={line.expanded}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${line.expanded ? 'Ocultar' : 'Ver'} etapas de ${item.label}`}
                    title={`${line.expanded ? 'Ocultar' : 'Ver'} etapas`}
                  >
                    <ChevronRight
                      className={cn('size-4 transition-transform', line.expanded && 'rotate-90')}
                    />
                  </button>
                ) : (
                  <span className={cn('shrink-0', depth ? 'w-1' : 'w-6')} aria-hidden />
                )}

                <LabelContent item={item} depth={depth} />
              </div>
            );
          })}
        </div>

        {/* -------------------------------------------- Meses e barras */}
        <div className="flex-1 overflow-x-auto scrollbar-thin">
          <div style={{ width: range.months * MONTH_WIDTH }} className="relative">
            <div className="flex border-b bg-secondary/60" style={{ height: HEADER_H }}>
              {Array.from({ length: range.months }).map((_, index) => (
                <div
                  key={index}
                  className="flex shrink-0 items-center border-r px-3 text-xs font-semibold capitalize text-muted-foreground"
                  style={{ width: MONTH_WIDTH }}
                >
                  {format(addMonths(range.min, index), 'MMM/yy', { locale: ptBR })}
                </div>
              ))}
            </div>

            <div className="relative" style={{ height: bodyHeight }}>
              <div className="pointer-events-none absolute inset-0 flex">
                {Array.from({ length: range.months }).map((_, index) => (
                  <div
                    key={index}
                    className="shrink-0 border-r border-border/60"
                    style={{ width: MONTH_WIDTH }}
                  />
                ))}
              </div>

              <div
                className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-destructive"
                style={{ left: toX(new Date()) }}
                aria-hidden
              />

              <div className="relative z-10">
                {lines.map((line) => {
                  if (line.kind === 'group') {
                    return (
                      <div
                        key={line.key}
                        className="border-b bg-secondary/40"
                        style={{ height: line.height }}
                      />
                    );
                  }

                  const { item, depth } = line;
                  const left = toX(item.start);
                  const width = Math.max(toX(item.end) - left, 24);
                  const barHeight = depth ? 22 : 34;

                  // A barra — e só ela — é o alvo do clique e da dica. Cobrir a
                  // linha inteira faria o mês vazio ao lado abrir o projeto.
                  const barClassName = cn(
                    'absolute top-1/2 flex -translate-y-1/2 items-center overflow-hidden rounded-lg shadow-sm transition-transform',
                    item.href && 'hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    item.barClassName ?? 'bg-gradient-brand',
                    item.late && 'ring-2 ring-destructive/70',
                  );
                  const barStyle = { left, width, height: barHeight };
                  const barContent = (
                    <>
                      <span
                        className="absolute inset-y-0 left-0 bg-white/25"
                        style={{ width: `${Math.min(Math.max(item.progress, 0), 100)}%` }}
                        aria-hidden
                      />
                      {width > 88 ? (
                        <span className="relative flex items-center gap-1.5 truncate px-2.5 text-[11px] font-semibold text-white">
                          {Math.round(item.progress)}%
                          {item.caption && <span className="opacity-85">· {item.caption}</span>}
                        </span>
                      ) : (
                        <span className="sr-only">{item.label}</span>
                      )}
                    </>
                  );

                  return (
                    <div key={line.key} className="relative border-b" style={{ height: line.height }}>
                      <Hint label={item.tooltip ?? item.label}>
                        {item.href ? (
                          <Link href={item.href} className={barClassName} style={barStyle}>
                            {barContent}
                          </Link>
                        ) : (
                          <span className={barClassName} style={barStyle}>
                            {barContent}
                          </span>
                        )}
                      </Hint>

                      {(item.markers ?? []).map((marker) => (
                        <Hint key={marker.id} label={marker.label}>
                          <span
                            className={cn(
                              'absolute top-1/2 z-20 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-card',
                              marker.done ? 'bg-success' : 'bg-moreno-blue-700',
                            )}
                            style={{ left: toX(marker.date) }}
                          >
                            <Flag className="size-2.5 text-white" aria-hidden />
                          </span>
                        </Hint>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {footer && (
        <footer className="flex flex-wrap items-center gap-4 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
          {footer}
        </footer>
      )}
    </div>
  );
}

function LabelContent({ item, depth }: { item: RoadmapItem; depth: number }) {
  const content = (
    <>
      <span className={cn('truncate', depth ? 'text-[13px]' : 'text-sm font-medium')}>
        {item.label}
      </span>
      {item.sublabel && (
        <span className="truncate text-[11px] text-muted-foreground">{item.sublabel}</span>
      )}
    </>
  );

  if (!item.href) {
    return <span className="flex min-w-0 flex-col justify-center">{content}</span>;
  }

  return (
    <Link
      href={item.href}
      className="flex min-w-0 flex-1 flex-col justify-center py-1 transition-colors hover:text-primary"
    >
      {content}
    </Link>
  );
}
