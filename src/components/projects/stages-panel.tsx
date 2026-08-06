'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, Layers, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { StagesChart } from '@/components/charts/stages-chart';
import { ExportMenu } from '@/components/projects/export-menu';
import { StageDialog } from '@/components/projects/stage-dialog';
import { STAGE_COLUMNS } from '@/lib/report-columns';
import { useStageMutations, useStages } from '@/hooks/use-project-details';
import { useSession } from '@/hooks/use-session';
import { STAGE_STATUS_META } from '@/lib/constants';
import { formatDate, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectStageView } from '@/types/database';

interface StagesPanelProps {
  projectId: string;
  canManage: boolean;
  /** Datas do projeto — usadas como sugestão ao criar a primeira etapa. */
  projectStart: string;
  projectDue: string;
}

export function StagesPanel({ projectId, canManage, projectStart, projectDue }: StagesPanelProps) {
  const { data, isLoading } = useStages(projectId);
  const { remove, reorder } = useStageMutations(projectId);
  const { profile } = useSession();

  /** A RLS permite que o responsável pela etapa registre o andamento dela. */
  const canEditStage = React.useCallback(
    (stage: ProjectStageView) => canManage || stage.owner_id === profile?.id,
    [canManage, profile?.id],
  );

  const [editing, setEditing] = React.useState<ProjectStageView | null>(null);
  const [creating, setCreating] = React.useState(false);

  const stages = React.useMemo(() => data ?? [], [data]);

  /** A etapa nova começa onde a última terminou. */
  const nextStart = stages[stages.length - 1]?.end_date ?? projectStart;

  function openEdit(stage: ProjectStageView) {
    if (!canEditStage(stage)) return;
    setEditing(stage);
  }

  /** Troca a etapa com a vizinha, reescrevendo as posições da lista inteira. */
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;

    const next = [...stages];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((stage, position) => ({ id: stage.id, position: position + 1 })));
  }

  return (
    <div className="space-y-4">
      <StagesChart stages={stages} isLoading={isLoading} onSelectStage={openEdit} />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="size-4 text-primary" aria-hidden />
            Etapas do projeto
            <Badge variant="secondary">{stages.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <ExportMenu
              rows={stages}
              columns={STAGE_COLUMNS}
              filename={`etapas-${stages[0]?.project_code ?? 'projeto'}`}
              title="Etapas do projeto"
              subtitle={stages[0]?.project_name}
            />
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                <Plus className="size-3.5" />
                Nova etapa
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !stages.length ? (
            <EmptyState
              icon={Layers}
              title="Nenhuma etapa cadastrada"
              description="Quebre o projeto em etapas e registre o início e o andamento de cada uma."
              className="border-0 bg-transparent py-8"
              action={
                canManage ? (
                  <Button variant="brand" onClick={() => setCreating(true)}>
                    <Plus className="size-4" />
                    Cadastrar primeira etapa
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ol className="space-y-2">
              {stages.map((stage, index) => {
                const meta = STAGE_STATUS_META[stage.status];
                const editable = canEditStage(stage);

                return (
                  <li
                    key={stage.id}
                    className={cn(
                      'group rounded-lg border p-3 transition-colors hover:bg-secondary/50',
                      stage.atrasada && 'border-destructive/40',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                          meta.bar,
                        )}
                        aria-hidden
                      >
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{stage.name}</p>
                          <Badge variant="soft" className={meta.className}>
                            {meta.label}
                          </Badge>
                          {stage.atrasada && (
                            <Badge
                              variant="soft"
                              className="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
                            >
                              {stage.dias_atraso} dia(s) de atraso
                            </Badge>
                          )}
                          {stage.owner_name && (
                            <span className="text-[11px] text-muted-foreground">{stage.owner_name}</span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(stage.start_date)} → {formatDate(stage.end_date)} ·{' '}
                          {stage.actual_start_date
                            ? `iniciada em ${formatDate(stage.actual_start_date)}`
                            : 'ainda não iniciada'}
                          {stage.actual_end_date && ` · concluída em ${formatDate(stage.actual_end_date)}`}
                        </p>

                        {stage.progress_notes && (
                          <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                            {stage.progress_notes}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={stage.progress} indicatorClassName={meta.bar} className="h-1.5" />
                          <span className="w-10 shrink-0 text-right text-xs font-medium">
                            {formatPercent(stage.progress)}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {canManage && (
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => move(index, -1)}
                              disabled={index === 0 || reorder.isPending}
                              aria-label={`Mover ${stage.name} para cima`}
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => move(index, 1)}
                              disabled={index === stages.length - 1 || reorder.isPending}
                              aria-label={`Mover ${stage.name} para baixo`}
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                          </div>
                        )}

                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(stage)}
                            aria-label={`Editar etapa ${stage.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}

                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => remove.mutate(stage.id)}
                            aria-label={`Remover etapa ${stage.name}`}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <StageDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        projectId={projectId}
        stage={editing}
      />

      <StageDialog
        open={creating}
        onOpenChange={setCreating}
        projectId={projectId}
        defaultStart={nextStart}
        defaultEnd={projectDue}
      />
    </div>
  );
}
