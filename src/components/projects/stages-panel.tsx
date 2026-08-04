'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Layers, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { StagesChart } from '@/components/charts/stages-chart';
import { ExportMenu } from '@/components/projects/export-menu';
import { STAGE_COLUMNS } from '@/lib/report-columns';
import { useStageMutations, useStages } from '@/hooks/use-project-details';
import { useProjectMembers } from '@/hooks/use-projects';
import { useSession } from '@/hooks/use-session';
import { STAGE_STATUS_META, STAGE_STATUS_OPTIONS } from '@/lib/constants';
import { stageSchema, type StageInput } from '@/lib/validations';
import { formatDate, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectStageView } from '@/types/database';

const NONE = '__none__';

interface StagesPanelProps {
  projectId: string;
  canManage: boolean;
  /** Datas do projeto — usadas como sugestão ao criar a primeira etapa. */
  projectStart: string;
  projectDue: string;
}

export function StagesPanel({ projectId, canManage, projectStart, projectDue }: StagesPanelProps) {
  const { data, isLoading } = useStages(projectId);
  const { save, remove, reorder } = useStageMutations(projectId);
  const members = useProjectMembers(projectId);
  const { profile } = useSession();

  /** A RLS permite que o responsável pela etapa registre o andamento dela. */
  const canEditStage = React.useCallback(
    (stage: ProjectStageView) => canManage || stage.owner_id === profile?.id,
    [canManage, profile?.id],
  );

  const [editing, setEditing] = React.useState<ProjectStageView | null>(null);
  const [open, setOpen] = React.useState(false);

  const stages = React.useMemo(() => data ?? [], [data]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StageInput>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: '',
      status: 'nao_iniciada',
      start_date: projectStart,
      end_date: projectDue,
      progress: 0,
      weight: 1,
    },
  });

  const status = watch('status');

  /**
   * Preenche o formulário na abertura do diálogo. Fazer isso aqui, e não num
   * efeito ligado à lista, evita que uma atualização em tempo real limpe o que
   * o usuário está digitando.
   */
  function openDialog(stage: ProjectStageView | null) {
    // A etapa nova começa onde a última terminou.
    const last = stages[stages.length - 1];

    reset({
      name: stage?.name ?? '',
      description: stage?.description ?? '',
      progress_notes: stage?.progress_notes ?? '',
      status: stage?.status ?? 'nao_iniciada',
      owner_id: stage?.owner_id ?? null,
      start_date: stage?.start_date ?? last?.end_date ?? projectStart,
      end_date: stage?.end_date ?? projectDue,
      actual_start_date: stage?.actual_start_date ?? '',
      progress: stage?.progress ?? 0,
      weight: stage?.weight ?? 1,
    });

    setEditing(stage);
    setOpen(true);
  }

  function openNew() {
    openDialog(null);
  }

  function openEdit(stage: ProjectStageView) {
    if (!canEditStage(stage)) return;
    openDialog(stage);
  }

  async function onSubmit(values: StageInput) {
    await save.mutateAsync({
      id: editing?.id,
      ...values,
      description: values.description || null,
      progress_notes: values.progress_notes || null,
      actual_start_date: values.actual_start_date || null,
    });
    setOpen(false);
    setEditing(null);
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
              <Button size="sm" variant="outline" onClick={openNew}>
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
                  <Button variant="brand" onClick={openNew}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar etapa' : 'Nova etapa'}</DialogTitle>
            <DialogDescription>
              O início, o andamento e o término alimentam o organograma e a linha do tempo do projeto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Nome da etapa" htmlFor="stage-name" error={errors.name?.message} required>
              <Input id="stage-name" placeholder="Diagnóstico" {...register('name')} />
            </Field>

            <Field label="Descrição" htmlFor="stage-description" error={errors.description?.message}>
              <Textarea id="stage-description" rows={2} placeholder="O que esta etapa entrega." {...register('description')} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Field label="Situação">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGE_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              <Controller
                control={control}
                name="owner_id"
                render={({ field }) => (
                  <Field label="Responsável pela etapa">
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem responsável</SelectItem>
                        {members.data?.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.profile?.full_name ?? 'Usuário'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Início previsto" htmlFor="stage-start" error={errors.start_date?.message} required>
                <Input id="stage-start" type="date" {...register('start_date')} />
              </Field>
              <Field label="Término previsto" htmlFor="stage-end" error={errors.end_date?.message} required>
                <Input id="stage-end" type="date" {...register('end_date')} />
              </Field>
              <Field
                label="Início real"
                htmlFor="stage-actual-start"
                hint="Em branco, é carimbado quando a etapa entra em andamento."
              >
                <Input id="stage-actual-start" type="date" {...register('actual_start_date')} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Andamento (%)"
                htmlFor="stage-progress"
                error={errors.progress?.message}
                hint={
                  status === 'nao_iniciada'
                    ? 'Etapas não iniciadas voltam para 0%.'
                    : status === 'concluida'
                      ? 'Etapas concluídas são gravadas com 100%.'
                      : undefined
                }
              >
                <Input id="stage-progress" type="number" min="0" max="100" step="1" {...register('progress')} />
              </Field>
              <Field
                label="Peso da etapa"
                htmlFor="stage-weight"
                error={errors.weight?.message}
                hint="Quanto esta etapa representa no avanço consolidado."
              >
                <Input id="stage-weight" type="number" min="0.1" max="99" step="0.5" {...register('weight')} />
              </Field>
            </div>

            <Field
              label="Andamento da etapa"
              htmlFor="stage-notes"
              error={errors.progress_notes?.message}
              hint="O que já foi feito, o que está em curso e o que trava a etapa."
            >
              <Textarea
                id="stage-notes"
                rows={4}
                placeholder="Ex.: base de dados consolidada; falta validar o custo por quilômetro com o financeiro."
                {...register('progress_notes')}
              />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" loading={isSubmitting}>
                Salvar etapa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
