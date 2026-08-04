'use client';

import * as React from 'react';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { ChevronRight, Network } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Hint } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { STAGE_STATUS_META } from '@/lib/constants';
import { formatDate, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectStageView } from '@/types/database';

function day(value: string) {
  return startOfDay(new Date(`${value}T00:00:00`));
}

/**
 * Organograma de etapas: o fluxo do projeto etapa a etapa, com início,
 * andamento e término de cada uma, seguido da linha do tempo proporcional.
 */
export function StagesChart({
  stages,
  isLoading,
  onSelectStage,
}: {
  stages: ProjectStageView[];
  isLoading?: boolean;
  onSelectStage?: (stage: ProjectStageView) => void;
}) {
  const ordered = React.useMemo(
    () => [...stages].sort((a, b) => a.position - b.position || a.start_date.localeCompare(b.start_date)),
    [stages],
  );

  const timeline = React.useMemo(() => {
    if (!ordered.length) return null;

    const min = new Date(Math.min(...ordered.map((stage) => day(stage.start_date).getTime())));
    const max = new Date(Math.max(...ordered.map((stage) => day(stage.end_date).getTime())));
    const days = Math.max(differenceInCalendarDays(max, min) + 1, 1);

    const today = startOfDay(new Date());
    const todayOffset = differenceInCalendarDays(today, min);

    return {
      min,
      max,
      days,
      todayPercent: todayOffset < 0 || todayOffset > days ? null : (todayOffset / days) * 100,
      bars: ordered.map((stage) => {
        const offset = differenceInCalendarDays(day(stage.start_date), min);
        const span = Math.max(differenceInCalendarDays(day(stage.end_date), day(stage.start_date)) + 1, 1);
        return { stage, left: (offset / days) * 100, width: (span / days) * 100 };
      }),
    };
  }, [ordered]);

  if (isLoading) return <Skeleton className="h-72 w-full" />;

  if (!ordered.length) {
    return (
      <EmptyState
        icon={Network}
        title="Nenhuma etapa cadastrada"
        description="Cadastre as etapas do projeto com início e andamento para montar o organograma."
      />
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="size-4 text-primary" aria-hidden />
          Organograma de etapas
          <Badge variant="secondary">{ordered.length}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Fluxo das etapas ------------------------------------------------ */}
        <div className="overflow-x-auto scrollbar-thin pb-2">
          <ol className="flex min-w-max items-stretch gap-0">
            {ordered.map((stage, index) => {
              const meta = STAGE_STATUS_META[stage.status];
              const late = stage.atrasada;

              return (
                <li key={stage.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => onSelectStage?.(stage)}
                    className={cn(
                      'flex w-64 flex-col gap-2 rounded-xl border bg-card p-3 text-left shadow-sm transition-all',
                      'hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      late && 'border-destructive/50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
                          meta.bar,
                        )}
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{stage.name}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="soft" className={meta.className}>
                        {meta.label}
                      </Badge>
                      {late && (
                        <Badge
                          variant="soft"
                          className="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
                        >
                          {stage.dias_atraso} dia(s) de atraso
                        </Badge>
                      )}
                    </div>

                    <dl className="space-y-0.5 text-[11px] text-muted-foreground">
                      <div className="flex justify-between gap-2">
                        <dt>Início previsto</dt>
                        <dd className="font-medium text-foreground">{formatDate(stage.start_date)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Início real</dt>
                        <dd
                          className={cn(
                            'font-medium',
                            stage.actual_start_date ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {stage.actual_start_date ? formatDate(stage.actual_start_date) : 'não iniciada'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Término previsto</dt>
                        <dd className={cn('font-medium', late ? 'text-destructive' : 'text-foreground')}>
                          {formatDate(stage.end_date)}
                        </dd>
                      </div>
                    </dl>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          Andamento
                          {stage.expected_progress > 0 && (
                            <span className="ml-1 opacity-70">
                              (previsto {formatPercent(stage.expected_progress)})
                            </span>
                          )}
                        </span>
                        <span className="font-semibold">{formatPercent(stage.progress)}</span>
                      </div>
                      <Progress value={stage.progress} indicatorClassName={meta.bar} />
                    </div>

                    {stage.progress_notes && (
                      <p className="line-clamp-3 border-t pt-2 text-[11px] leading-relaxed text-muted-foreground">
                        {stage.progress_notes}
                      </p>
                    )}
                  </button>

                  {index < ordered.length - 1 && (
                    <ChevronRight className="mx-1 size-5 shrink-0 text-muted-foreground/60" aria-hidden />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Linha do tempo das etapas --------------------------------------- */}
        {timeline && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{formatDate(timeline.min)}</span>
              <span className="font-medium uppercase tracking-wide">Linha do tempo das etapas</span>
              <span>{formatDate(timeline.max)}</span>
            </div>

            <div className="relative space-y-1.5">
              {timeline.todayPercent !== null && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-destructive"
                  style={{ left: `${timeline.todayPercent}%` }}
                  aria-hidden
                />
              )}

              {timeline.bars.map(({ stage, left, width }) => {
                const meta = STAGE_STATUS_META[stage.status];
                return (
                  <div key={stage.id} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-muted-foreground" title={stage.name}>
                      {stage.name}
                    </span>
                    <div className="relative h-5 flex-1 rounded-md bg-secondary">
                      <Hint
                        label={
                          <span className="block space-y-0.5">
                            <span className="block font-semibold">{stage.name}</span>
                            <span className="block">
                              {formatDate(stage.start_date)} → {formatDate(stage.end_date)}
                            </span>
                            <span className="block">
                              {stage.duracao_dias_uteis} dias úteis · {formatPercent(stage.progress)} concluído
                            </span>
                            <span className="block">{meta.label}</span>
                            {stage.owner_name && <span className="block">Responsável: {stage.owner_name}</span>}
                          </span>
                        }
                      >
                        <button
                          type="button"
                          onClick={() => onSelectStage?.(stage)}
                          className={cn(
                            'absolute inset-y-0 overflow-hidden rounded-md shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            meta.bar,
                            stage.atrasada && 'ring-1 ring-destructive',
                          )}
                          style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }}
                          aria-label={`Etapa ${stage.name}`}
                        >
                          <span className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${stage.progress}%` }} aria-hidden />
                        </button>
                      </Hint>
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-medium">
                      {formatPercent(stage.progress)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
