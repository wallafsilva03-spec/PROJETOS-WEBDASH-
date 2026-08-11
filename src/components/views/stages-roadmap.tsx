'use client';

import * as React from 'react';
import { Map as MapIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { RoadmapTimeline, type RoadmapItem } from '@/components/views/roadmap-timeline';
import { STAGE_STATUS_META } from '@/lib/constants';
import { formatDate, formatPercent } from '@/lib/format';
import type { ProjectStageView } from '@/types/database';

function day(value: string) {
  return new Date(`${value}T00:00:00`);
}

/**
 * Etapas no formato do roadmap — a mesma barra do portfólio, uma linha por
 * etapa. Serve tanto para abrir dentro de um projeto no roadmap corporativo
 * quanto para a aba de etapas do projeto.
 */
export function stageRoadmapItems(
  stages: ProjectStageView[],
  options: { href?: (stage: ProjectStageView) => string } = {},
): RoadmapItem[] {
  return [...stages]
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.position - b.position)
    .map((stage) => {
      const meta = STAGE_STATUS_META[stage.status];

      return {
        id: stage.id,
        label: stage.name,
        sublabel: stage.owner_name ?? undefined,
        start: day(stage.start_date),
        end: day(stage.end_date),
        progress: Number(stage.progress),
        caption: meta.label,
        barClassName: meta.bar,
        accentClassName: meta.bar,
        late: stage.atrasada,
        href: options.href?.(stage),
        tooltip: (
          <span className="block space-y-0.5">
            <span className="block font-semibold">{stage.name}</span>
            <span className="block">
              {formatDate(stage.start_date)} → {formatDate(stage.end_date)}
            </span>
            <span className="block">
              {formatPercent(stage.progress)} de {formatPercent(stage.expected_progress)} previstos ·{' '}
              {meta.label}
            </span>
            {stage.atrasada && (
              <span className="block font-medium">{stage.dias_atraso} dia(s) de atraso</span>
            )}
            {stage.owner_name && <span className="block">Responsável: {stage.owner_name}</span>}
          </span>
        ),
      } satisfies RoadmapItem;
    });
}

/** Bloco de roadmap das etapas usado na aba de etapas do projeto. */
export function StagesRoadmap({
  stages,
  isLoading,
}: {
  stages: ProjectStageView[];
  isLoading?: boolean;
}) {
  const items = React.useMemo(() => stageRoadmapItems(stages), [stages]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapIcon className="size-4 text-primary" aria-hidden />
          Roadmap das etapas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !items.length ? (
          <EmptyState
            icon={MapIcon}
            title="Nenhuma etapa para posicionar"
            description="Cadastre etapas com início e término para vê-las na linha do tempo."
            className="border-0 bg-transparent py-8"
          />
        ) : (
          <RoadmapTimeline
            groups={[{ key: 'etapas', label: 'Etapas', items }]}
            labelHeader="Etapa"
            showGroups={false}
            footer={
              <>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-6 rounded-sm bg-moreno-lime-500" /> Em andamento
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-6 rounded-sm bg-moreno-green-500" /> Concluída
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-6 rounded-sm bg-slate-400" /> Não iniciada
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-6 rounded-sm ring-2 ring-destructive/70" /> Atrasada
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-0.5 bg-destructive" /> Hoje
                </span>
              </>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
