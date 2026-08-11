'use client';

import * as React from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStageMutations } from '@/hooks/use-project-details';
import { useProjectMembers } from '@/hooks/use-projects';
import { STAGE_STATUS_OPTIONS } from '@/lib/constants';
import { stageSchema, type StageInput } from '@/lib/validations';
import type { ProjectStageView } from '@/types/database';

const NONE = '__none__';

export interface StageProjectOption {
  id: string;
  code: string;
  name: string;
}

interface StageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Projeto fixo do formulário. Sem ele, a etapa nova pergunta o projeto. */
  projectId?: string;
  /** Etapa em edição; ausente ou nula abre o formulário de criação. */
  stage?: ProjectStageView | null;
  /** Projetos oferecidos quando `projectId` não é informado. */
  projectOptions?: StageProjectOption[];
  /** Datas sugeridas para a etapa nova — vêm do projeto ou da coluna do kanban. */
  defaultStart?: string;
  defaultEnd?: string;
  /** Mostra o botão de excluir na edição. A RLS é quem decide de verdade. */
  canDelete?: boolean;
}

/**
 * Formulário único de etapa — usado pelo painel de etapas e pelo kanban.
 *
 * O `reset` acontece apenas na abertura do diálogo. Ligá-lo à lista faria uma
 * atualização em tempo real apagar o que o usuário está digitando.
 */
export function StageDialog({
  open,
  onOpenChange,
  projectId,
  stage,
  projectOptions,
  defaultStart,
  defaultEnd,
  canDelete,
}: StageDialogProps) {
  const [chosenProject, setChosenProject] = React.useState('');
  const targetProject = stage?.project_id ?? projectId ?? chosenProject;
  const askProject = !projectId && !stage;

  const { save, remove } = useStageMutations(targetProject);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const members = useProjectMembers(targetProject);

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
      start_date: defaultStart ?? '',
      end_date: defaultEnd ?? '',
      progress: 0,
      weight: 1,
    },
  });

  const status = watch('status');
  const filled = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      filled.current = false;
      setConfirmingDelete(false);
      return;
    }
    if (filled.current) return;
    filled.current = true;

    setChosenProject(projectOptions?.length === 1 ? projectOptions[0].id : '');
    reset({
      name: stage?.name ?? '',
      description: stage?.description ?? '',
      progress_notes: stage?.progress_notes ?? '',
      status: stage?.status ?? 'nao_iniciada',
      owner_id: stage?.owner_id ?? null,
      start_date: stage?.start_date ?? defaultStart ?? '',
      end_date: stage?.end_date ?? defaultEnd ?? '',
      actual_start_date: stage?.actual_start_date ?? '',
      progress: stage?.progress ?? 0,
      weight: stage?.weight ?? 1,
    });
  }, [open, stage, projectOptions, defaultStart, defaultEnd, reset]);

  function onInvalid(formErrors: FieldErrors<StageInput>) {
    const first = Object.values(formErrors).find((field) => field?.message)?.message;
    toast.error(first ? String(first) : 'Revise os campos destacados em vermelho.');
  }

  async function onSubmit(values: StageInput) {
    if (!targetProject) {
      toast.error('Escolha o projeto que vai receber a etapa.');
      return;
    }

    await save.mutateAsync({
      id: stage?.id,
      ...values,
      description: values.description || null,
      progress_notes: values.progress_notes || null,
      actual_start_date: values.actual_start_date || null,
    });
    onOpenChange(false);
  }

  /** Exclusão em dois toques — não existe desfazer para etapa apagada. */
  async function onDelete() {
    if (!stage) return;

    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    await remove.mutateAsync(stage.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{stage ? 'Editar etapa' : 'Nova etapa'}</DialogTitle>
          <DialogDescription>
            O início e o término previstos posicionam a etapa no kanban, no organograma e na linha do
            tempo do projeto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
          {askProject && (
            <Field label="Projeto" hint="A etapa entra no fim da lista deste projeto." required>
              <Select value={chosenProject} onValueChange={setChosenProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o projeto" />
                </SelectTrigger>
                <SelectContent>
                  {(projectOptions ?? []).map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.code} · {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Nome da etapa" htmlFor="stage-name" error={errors.name?.message} required>
            <Input id="stage-name" placeholder="Diagnóstico" {...register('name')} />
          </Field>

          <Field label="Descrição" htmlFor="stage-description" error={errors.description?.message}>
            <Textarea
              id="stage-description"
              rows={2}
              placeholder="O que esta etapa entrega."
              {...register('description')}
            />
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
            <Field label="Data início" htmlFor="stage-start" error={errors.start_date?.message} required>
              <Input id="stage-start" type="date" {...register('start_date')} />
            </Field>
            <Field label="Data fim" htmlFor="stage-end" error={errors.end_date?.message} required>
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

          <DialogFooter className="sm:justify-between">
            {stage && canDelete ? (
              <Button
                type="button"
                variant={confirmingDelete ? 'destructive' : 'ghost'}
                onClick={onDelete}
                loading={remove.isPending}
                className={confirmingDelete ? undefined : 'text-destructive hover:text-destructive'}
              >
                <Trash2 className="size-4" />
                {confirmingDelete ? 'Confirmar exclusão' : 'Excluir etapa'}
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" loading={isSubmitting}>
                Salvar etapa
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
