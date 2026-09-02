'use client';

import { Card } from '@/components/ui/card';
import {
  buildAreaMatrix,
  buildStatusShare,
  completionRate,
  type AreaRow,
  type BucketShare,
} from '@/lib/portfolio-overview';
import { formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectOverview } from '@/types/database';

/** Uma barra empilhada com todas as situações, em percentual. */
function ShareBar({ buckets, className }: { buckets: BucketShare[]; className?: string }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0);

  if (!total) {
    return <div className={cn('h-3 w-full rounded-full bg-secondary', className)} aria-hidden />;
  }

  return (
    <div className={cn('flex h-3 w-full overflow-hidden rounded-full bg-secondary', className)}>
      {buckets
        .filter((bucket) => bucket.total > 0)
        .map((bucket) => (
          <span
            key={bucket.id}
            className={bucket.tone}
            style={{ width: `${bucket.percent}%` }}
            title={`${bucket.label}: ${formatPercent(bucket.percent, 1)} (${bucket.total})`}
          />
        ))}
    </div>
  );
}

/**
 * Visão geral do portfólio em percentual — a leitura de abertura para a
 * Diretoria: quanto já terminou, e como o resto se distribui.
 *
 * O percentual vem primeiro e a contagem entra abaixo, menor: numa reunião a
 * pergunta é "quanto por cento", e o número absoluto só serve para conferir.
 */
export function PortfolioShare({
  projects,
  title = 'Visão geral do portfólio',
  description,
  className,
}: {
  projects: ProjectOverview[];
  title?: string;
  description?: string;
  className?: string;
}) {
  const buckets = buildStatusShare(projects);
  const done = completionRate(projects);

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>

        <div className="text-right">
          <p className="font-display text-3xl font-semibold leading-none text-moreno-green-600 dark:text-moreno-green-400">
            {formatPercent(done, 1)}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">concluídos</p>
        </div>
      </div>

      <ShareBar buckets={buckets} className="mt-4 h-4" />

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {buckets.map((bucket) => (
          <li key={bucket.id}>
            <div className="flex items-center gap-1.5">
              <span className={cn('size-2 shrink-0 rounded-full', bucket.tone)} aria-hidden />
              <span className="truncate text-xs text-muted-foreground">{bucket.label}</span>
            </div>
            <p className="mt-0.5 font-display text-xl font-semibold leading-none">
              {formatPercent(bucket.percent, 1)}
            </p>
            <p className="text-[11px] text-muted-foreground">{formatNumber(bucket.total)} projeto(s)</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Uma linha do gráfico gerencial: a área, sua fatia e a barra de situações. */
function AreaLine({ row, className }: { row: AreaRow; className?: string }) {
  return (
    <li className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <span className={cn('size-2.5 shrink-0 rounded-full', row.tone)} aria-hidden />
          <span className="text-sm font-medium">{row.label}</span>
          <span className="text-xs text-muted-foreground">
            {formatPercent(row.percent, 1)} do portfólio · {formatNumber(row.total)} projeto(s)
          </span>
        </div>

        <span className="text-xs">
          <strong className="font-display text-base font-semibold text-moreno-green-600 dark:text-moreno-green-400">
            {formatPercent(row.completion, 1)}
          </strong>{' '}
          <span className="text-muted-foreground">concluídos na área</span>
        </span>
      </div>

      <ShareBar buckets={row.buckets} />

      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {row.buckets
          .filter((bucket) => bucket.total > 0)
          .map((bucket) => (
            <li key={bucket.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn('size-1.5 rounded-full', bucket.tone)} aria-hidden />
              {bucket.label} {formatPercent(bucket.percent, 0)}
              <span className="opacity-60">({bucket.total})</span>
            </li>
          ))}
      </ul>
    </li>
  );
}

/**
 * Gráfico gerencial por área — Agrícola, Administrativo e Industrial.
 *
 * Cada área recebe a própria barra, e os percentuais de dentro somam 100% na
 * própria área. Comparar a barra de uma área com a de outra mostra a mistura,
 * não o tamanho; o tamanho está escrito ao lado, na fatia do portfólio.
 */
export function AreaBreakdown({
  projects,
  className,
}: {
  projects: ProjectOverview[];
  className?: string;
}) {
  const rows = buildAreaMatrix(projects);
  const classified = rows.filter((row) => row.id !== 'sem_area' && row.total > 0).length;

  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Projetos por área
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {classified
            ? 'Percentual por situação dentro de cada área. A fatia do portfólio aparece ao lado do nome.'
            : 'Nenhum projeto classificado ainda — a área é escolhida no formulário do projeto, em Governança.'}
        </p>
      </div>

      <ul className="space-y-5">
        {rows.map((row) => (
          <AreaLine key={row.id} row={row} />
        ))}
      </ul>
    </Card>
  );
}
