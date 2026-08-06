'use client';

import * as React from 'react';
import { startOfDay } from 'date-fns';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CalendarClock, CalendarDays, Layers, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Switch } from '@/components/ui/misc';
import { ExportMenu } from '@/components/projects/export-menu';
import { StageDialog, type StageProjectOption } from '@/components/projects/stage-dialog';
import { useStageBoardMutation, useStages } from '@/hooks/use-project-details';
import { useSession } from '@/hooks/use-session';
import { useRealtime } from '@/hooks/use-realtime';
import { STAGE_STATUS_META } from '@/lib/constants';
import { STAGE_COLUMNS } from '@/lib/report-columns';
import { describeDbError } from '@/lib/supabase/errors';
import { formatDate, formatPercent } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import {
  rescheduleStage,
  stageDateBucket,
  stageDateColumns,
  stageStatusColumns,
  toIsoDate,
  type StageColumn,
  type StageGrouping,
} from '@/lib/stage-kanban';
import { cn } from '@/lib/utils';
import type { ProjectStageView, StageStatus } from '@/types/database';

/* ------------------------------------------------------------------ Card */
function StageCard({
  stage,
  showProject,
  dragging,
}: {
  stage: ProjectStageView;
  showProject?: boolean;
  dragging?: boolean;
}) {
  const meta = STAGE_STATUS_META[stage.status];

  return (
    <article
      className={cn(
        'rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow',
        dragging ? 'rotate-2 shadow-card-hover' : 'hover:shadow-card-hover',
        stage.atrasada && 'border-destructive/40',
      )}
    >
      {showProject && (
        <p className="mb-1 truncate text-[11px] font-medium uppercase tracking-wide text-primary">
          {stage.project_code}
        </p>
      )}

      <p className="line-clamp-3 text-sm font-medium leading-snug">{stage.name}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="soft" className={cn('text-[10px]', meta.className)} dot={meta.dot}>
          {meta.label}
        </Badge>
        {stage.atrasada && (
          <Badge
            variant="soft"
            className="bg-rose-50 text-[10px] text-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
          >
            {stage.dias_atraso} dia(s) de atraso
          </Badge>
        )}
      </div>

      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <CalendarDays className="size-3 shrink-0" aria-hidden />
        {formatDate(stage.start_date, 'dd/MM/yy')} → {formatDate(stage.end_date, 'dd/MM/yy')}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <Progress value={stage.progress} indicatorClassName={meta.bar} className="h-1" />
        <span className="w-9 shrink-0 text-right text-[11px] font-medium">
          {formatPercent(stage.progress)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-[11px]',
            stage.atrasada ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          {stage.status === 'concluida'
            ? `Entregue em ${formatDate(stage.actual_end_date ?? stage.end_date, 'dd/MM')}`
            : stage.dias_restantes < 0
              ? `${Math.abs(stage.dias_restantes)} dia(s) vencidos`
              : stage.dias_restantes === 0
                ? 'Vence hoje'
                : `${stage.dias_restantes} dia(s) restantes`}
        </span>
        {stage.owner_id && (
          <UserAvatar
            userId={stage.owner_id}
            name={stage.owner_name ?? 'Responsável'}
            src={stage.owner_avatar}
            className="size-6"
          />
        )}
      </div>
    </article>
  );
}

function DraggableStage({
  stage,
  showProject,
  editable,
  onOpen,
}: {
  stage: ProjectStageView;
  showProject?: boolean;
  editable: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: stage.id,
    disabled: !editable,
  });

  return (
    <li ref={setNodeRef} className={cn('touch-none', isDragging && 'opacity-40')} {...attributes} {...listeners}>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Abrir etapa ${stage.name}`}
      >
        <StageCard stage={stage} showProject={showProject} />
      </button>
    </li>
  );
}

/* ---------------------------------------------------------------- Coluna */
function Column({
  column,
  stages,
  showProject,
  canCreate,
  isEditable,
  onOpenStage,
  onCreate,
}: {
  column: StageColumn;
  stages: ProjectStageView[];
  showProject?: boolean;
  canCreate: boolean;
  isEditable: (stage: ProjectStageView) => boolean;
  onOpenStage: (stage: ProjectStageView) => void;
  onCreate: (column: StageColumn) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const late = stages.filter((stage) => stage.atrasada).length;

  return (
    <section
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border bg-secondary/40 transition-colors',
        isOver && !column.readOnly && 'border-primary bg-primary/5',
      )}
      aria-label={column.label}
    >
      <header className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 shrink-0 rounded-full', column.accent)} aria-hidden />
          <h3 className="truncate text-sm font-semibold">{column.label}</h3>
          <span className="rounded-full bg-card px-1.5 text-xs font-medium text-muted-foreground">
            {stages.length}
          </span>
          {canCreate && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              onClick={() => onCreate(column)}
              aria-label={`Nova etapa em ${column.label}`}
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={column.hint}>
          {column.hint}
        </p>
      </header>

      <div ref={setNodeRef} className="flex-1 space-y-2 overflow-y-auto px-2 pb-3 scrollbar-thin">
        <ul className="space-y-2">
          {stages.map((stage) => (
            <DraggableStage
              key={stage.id}
              stage={stage}
              showProject={showProject}
              editable={isEditable(stage)}
              onOpen={() => onOpenStage(stage)}
            />
          ))}
        </ul>

        {stages.length === 0 && (
          <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            {column.readOnly ? 'Nenhuma etapa aqui' : 'Arraste etapas para cá'}
          </p>
        )}
      </div>

      {late > 0 && (
        <footer className="border-t px-3 py-2 text-[11px] font-medium text-destructive">
          {late} atrasada(s)
        </footer>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- Board */
interface StagesKanbanProps {
  /** Sem projeto, o quadro mostra as etapas de todo o portfólio. */
  projectId?: string;
  /** Quem pode gerenciar as etapas de um projeto (arrastar, criar, editar). */
  canManageProject: (projectId: string) => boolean;
  /** Projetos oferecidos ao criar uma etapa fora do contexto de um projeto. */
  projectOptions?: StageProjectOption[];
  /** Datas sugeridas para a primeira etapa — normalmente as do projeto. */
  defaultStart?: string;
  defaultEnd?: string;
}

export function StagesKanban({
  projectId,
  canManageProject,
  projectOptions,
  defaultStart,
  defaultEnd,
}: StagesKanbanProps) {
  const { data, isLoading, isError, error, refetch } = useStages(projectId);
  const move = useStageBoardMutation();
  const { profile } = useSession();

  const [grouping, setGrouping] = React.useState<StageGrouping>('prazo');
  const [showCancelled, setShowCancelled] = React.useState(false);
  const [active, setActive] = React.useState<ProjectStageView | null>(null);
  const [editing, setEditing] = React.useState<ProjectStageView | null>(null);
  const [creating, setCreating] = React.useState<{ start?: string; end?: string } | null>(null);

  useRealtime(
    'stages-kanban',
    [{ table: 'project_stages', filter: projectId ? `project_id=eq.${projectId}` : undefined }],
    [qk.allStages, projectId ? qk.stages(projectId) : qk.allStages],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  /** Hoje é a régua do quadro; fixar por render evita colunas discordantes. */
  const today = React.useMemo(() => startOfDay(new Date()), []);

  const stages = React.useMemo(
    () => (data ?? []).filter((stage) => showCancelled || stage.status !== 'cancelada'),
    [data, showCancelled],
  );

  const columns = React.useMemo(
    () => (grouping === 'prazo' ? stageDateColumns(today) : stageStatusColumns()),
    [grouping, today],
  );

  const grouped = React.useMemo(() => {
    const map = new Map<string, ProjectStageView[]>();
    columns.forEach((column) => map.set(column.id, []));

    stages.forEach((stage) => {
      const key = grouping === 'prazo' ? stageDateBucket(stage, today) : stage.status;
      map.get(key)?.push(stage);
    });

    map.forEach((list) =>
      list.sort((a, b) => a.end_date.localeCompare(b.end_date) || a.position - b.position),
    );
    return map;
  }, [columns, stages, grouping, today]);

  /** A RLS deixa o responsável pela etapa registrar o andamento dela. */
  const isEditable = React.useCallback(
    (stage: ProjectStageView) => canManageProject(stage.project_id) || stage.owner_id === profile?.id,
    [canManageProject, profile?.id],
  );

  const canCreate = projectId
    ? canManageProject(projectId)
    : Boolean(projectOptions?.some((option) => canManageProject(option.id)));

  function onDragStart(event: DragStartEvent) {
    setActive(stages.find((stage) => stage.id === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActive(null);

    const stage = stages.find((item) => item.id === event.active.id);
    const target = event.over ? columns.find((column) => column.id === event.over?.id) : null;
    if (!stage || !target) return;

    if (target.readOnly) {
      toast.info('A coluna de atrasadas é resultado da data — replaneje a etapa para outra coluna.');
      return;
    }

    if (grouping === 'situacao') {
      if (stage.status === target.status) return;
      move.mutate(
        { stage, patch: { status: target.status as StageStatus } },
        {
          onSuccess: () =>
            toast.success(
              `${stage.name}: ${STAGE_STATUS_META[target.status as StageStatus].label.toLowerCase()}.`,
            ),
        },
      );
      return;
    }

    if (target.status === 'concluida') {
      if (stage.status === 'concluida') return;
      move.mutate(
        { stage, patch: { status: 'concluida', progress: 100 } },
        { onSuccess: () => toast.success(`${stage.name} concluída.`) },
      );
      return;
    }

    if (!target.target) return;

    const dates = rescheduleStage(stage, target.target);
    if (dates.start_date === stage.start_date && dates.end_date === stage.end_date) return;

    // Etapa concluída que volta para uma coluna de prazo retoma a execução.
    const patch =
      stage.status === 'concluida'
        ? { ...dates, status: 'em_andamento' as StageStatus, progress: Math.min(stage.progress, 99) }
        : dates;

    move.mutate(
      { stage, patch },
      {
        onSuccess: () =>
          toast.success(`${stage.name} replanejada para ${formatDate(dates.end_date)}.`),
      },
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar as etapas"
        description={describeDbError(error)}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-secondary p-1" role="group" aria-label="Agrupar etapas por">
          {(
            [
              { id: 'prazo' as const, label: 'Por prazo', icon: CalendarClock },
              { id: 'situacao' as const, label: 'Por situação', icon: Layers },
            ]
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setGrouping(option.id)}
              aria-pressed={grouping === option.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                grouping === option.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <option.icon className="size-4" aria-hidden />
              {option.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={showCancelled} onCheckedChange={setShowCancelled} />
          Mostrar canceladas
        </label>

        <div className="ml-auto flex items-center gap-2">
          <ExportMenu
            rows={stages}
            columns={STAGE_COLUMNS}
            filename={projectId ? `etapas-${stages[0]?.project_code ?? 'projeto'}` : 'kanban-etapas'}
            title="Kanban de etapas"
            subtitle={
              grouping === 'prazo' ? 'Etapas por prazo de término' : 'Etapas por situação de execução'
            }
          />
          {canCreate && (
            <Button
              variant="brand"
              size="sm"
              onClick={() => setCreating({ start: defaultStart, end: defaultEnd })}
            >
              <Plus className="size-4" />
              Nova etapa
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {columns.map((column) => (
            <Skeleton key={column.id} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      ) : stages.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhuma etapa cadastrada"
          description={
            canCreate
              ? 'Quebre o projeto em etapas com data de início e de fim: elas alimentam este kanban automaticamente.'
              : 'As etapas cadastradas nos projetos aparecem aqui, organizadas pela data de término.'
          }
          action={
            canCreate ? (
              <Button variant="brand" onClick={() => setCreating({ start: defaultStart, end: defaultEnd })}>
                <Plus className="size-4" />
                Cadastrar primeira etapa
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActive(null)}
        >
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                stages={grouped.get(column.id) ?? []}
                showProject={!projectId}
                canCreate={canCreate}
                isEditable={isEditable}
                onOpenStage={(stage) => (isEditable(stage) ? setEditing(stage) : undefined)}
                onCreate={(target) =>
                  setCreating({
                    // A etapa criada dentro de uma coluna de prazo já nasce com
                    // o término dela — é isso que a coloca ali.
                    start: target.target ? toIsoDate(today) : defaultStart,
                    end: target.target ? toIsoDate(target.target) : defaultEnd,
                  })
                }
              />
            ))}
          </div>

          <DragOverlay>
            {active && (
              <div className="w-72">
                <StageCard stage={active} showProject={!projectId} dragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <p className="text-xs text-muted-foreground">
        As colunas de prazo são calculadas pela data de término da etapa. Arraste um card para
        replanejar a data — a duração planejada é preservada — ou solte em <strong>Concluídas</strong>{' '}
        para encerrar a etapa.
      </p>

      <StageDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        projectId={editing?.project_id ?? projectId}
        stage={editing}
      />

      <StageDialog
        open={Boolean(creating)}
        onOpenChange={(open) => !open && setCreating(null)}
        projectId={projectId}
        projectOptions={projectOptions?.filter((option) => canManageProject(option.id))}
        defaultStart={creating?.start}
        defaultEnd={creating?.end}
      />
    </div>
  );
}
