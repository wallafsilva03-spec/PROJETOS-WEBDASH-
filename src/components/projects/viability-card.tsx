'use client';

import { CalendarClock, TrendingUp } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Hint } from '@/components/ui/misc';
import { VIABILITY_META } from '@/lib/constants';
import {
  formatCompactCurrency,
  formatDate,
  formatDelta,
  formatPercent,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectOverview } from '@/types/database';

export function viabilityMeta(project: ProjectOverview) {
  return VIABILITY_META[project.viability] ?? VIABILITY_META.sem_dados;
}

/** Meses de payback em texto curto. */
function paybackLabel(months: number | null) {
  if (months === null || months === undefined) return '—';
  if (months === 0) return 'imediato';
  if (months < 12) return `${months.toFixed(months % 1 === 0 ? 0 : 1)} meses`;
  return `${(months / 12).toFixed(1)} anos`;
}

/**
 * Viabilidade econômica: quanto o projeto devolve para o negócio
 * comparado ao que consome.
 */
export function ViabilityCard({ project }: { project: ProjectOverview }) {
  const meta = viabilityMeta(project);
  const hasReturn = project.expected_return > 0;

  // Quanto do retorno esperado já foi realizado.
  const realized = hasReturn
    ? Math.min((project.actual_return / project.expected_return) * 100, 100)
    : 0;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Viabilidade econômica
        </p>
        <Hint label={meta.description}>
          <Badge variant="soft" className={meta.className}>
            {meta.label}
          </Badge>
        </Hint>
      </div>

      <p className="mt-1 font-display text-3xl font-semibold">
        {project.roi_percent === null ? '—' : formatDelta(project.roi_percent)}
        <span className="ml-1.5 align-middle text-xs font-medium text-muted-foreground">ROI</span>
      </p>

      {hasReturn && (
        <div className="mt-3 space-y-1">
          <Progress
            value={realized}
            className="h-1.5"
            indicatorClassName={project.net_benefit >= 0 ? 'bg-success' : 'bg-destructive'}
          />
          <p className="text-[11px] text-muted-foreground">
            {formatPercent(realized)} do retorno esperado já realizado
          </p>
        </div>
      )}

      <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Investimento (orçamento)</dt>
          <dd className="font-medium text-foreground">{formatCompactCurrency(project.budget)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Retorno esperado ({project.return_period_months} m)</dt>
          <dd className="font-medium text-foreground">{formatCompactCurrency(project.expected_return)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Benefício líquido</dt>
          <dd className={cn('font-medium', project.net_benefit >= 0 ? 'text-success' : 'text-destructive')}>
            {formatCompactCurrency(project.net_benefit)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Payback</dt>
          <dd className="font-medium text-foreground">{paybackLabel(project.payback_months)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Retorno realizado</dt>
          <dd className="font-medium text-foreground">
            {formatCompactCurrency(project.actual_return)}
            {project.roi_real_percent !== null && (
              <span className="ml-1 opacity-70">({formatDelta(project.roi_real_percent)})</span>
            )}
          </dd>
        </div>
      </dl>

      {project.financial_notes && (
        <p className="mt-3 border-t pt-2 text-[11px] leading-relaxed text-muted-foreground">
          {project.financial_notes}
        </p>
      )}

      {!hasReturn && (
        <p className="mt-3 flex items-center gap-1.5 border-t pt-2 text-[11px] text-muted-foreground">
          <TrendingUp className="size-3.5" aria-hidden />
          Informe o retorno esperado na edição do projeto para calcular ROI e payback.
        </p>
      )}
    </Card>
  );
}

/**
 * Conclusão por tempo: quanto do prazo já foi consumido, em que data o
 * projeto termina mantendo o ritmo atual e qual o desvio disso.
 */
export function TimeCompletionCard({ project }: { project: ProjectOverview }) {
  const isFinished = project.status === 'concluido' || project.status === 'cancelado';
  const elapsed = project.time_elapsed_percent;
  const delay = project.forecast_delay_days;

  const tone =
    delay === null ? 'text-muted-foreground' : delay > 0 ? 'text-destructive' : 'text-success';

  const paceLabel =
    project.schedule_index === null
      ? 'sem base de comparação'
      : project.schedule_index >= 1
        ? 'no ritmo ou acima do previsto'
        : `${formatPercent(project.schedule_index * 100)} do ritmo previsto`;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Conclusão por tempo
        </p>
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>

      <p className="mt-1 font-display text-3xl font-semibold">{formatPercent(elapsed)}</p>
      <p className="text-[11px] text-muted-foreground">do prazo consumido</p>

      <div className="mt-3 space-y-1">
        <Progress
          value={Math.min(elapsed, 100)}
          className="h-1.5"
          indicatorClassName={elapsed > 100 ? 'bg-destructive' : 'bg-primary'}
        />
        <Progress
          value={project.progress}
          className="h-1.5"
          indicatorClassName={project.progress >= elapsed ? 'bg-success' : 'bg-warning'}
        />
        <p className="text-[11px] text-muted-foreground">
          Tempo consumido × execução ({formatPercent(project.progress)})
        </p>
      </div>

      <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Conclusão projetada</dt>
          <dd className="font-medium text-foreground">
            {isFinished && project.actual_end_date
              ? formatDate(project.actual_end_date)
              : project.forecast_end_date
                ? formatDate(project.forecast_end_date)
                : 'sem execução'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Desvio da projeção</dt>
          <dd className={cn('font-medium', tone)}>
            {delay === null
              ? '—'
              : delay === 0
                ? 'na data'
                : delay > 0
                  ? `${delay} dia(s) depois`
                  : `${Math.abs(delay)} dia(s) antes`}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Ritmo (executado ÷ previsto)</dt>
          <dd className="font-medium text-foreground">
            {project.schedule_index === null ? '—' : project.schedule_index.toFixed(2)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">{paceLabel}</p>
    </Card>
  );
}
