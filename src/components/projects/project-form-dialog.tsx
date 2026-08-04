'use client';

import * as React from 'react';
import { useForm, Controller, type FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  COMPLEXITY_OPTIONS,
  PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from '@/lib/constants';
import { projectSchema, type ProjectInput } from '@/lib/validations';
import { formatCurrency, formatDelta } from '@/lib/format';
import { useClients, useDepartments, useProfiles, useTags } from '@/hooks/use-catalogs';
import { useCreateProject, useUpdateProject } from '@/hooks/use-projects';
import { cn } from '@/lib/utils';
import type { ProjectOverview } from '@/types/database';

const NONE = '__none__';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectOverview | null;
  /** Tags já vinculadas ao projeto (modo edição). */
  currentTagIds?: string[];
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  currentTagIds = [],
}: ProjectFormDialogProps) {
  const isEditing = Boolean(project);
  const departments = useDepartments();
  const clients = useClients();
  const people = useProfiles();
  const tags = useTags();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const defaultValues = React.useMemo<ProjectInput>(
    () => ({
      code: project?.code ?? '',
      name: project?.name ?? '',
      description: project?.description ?? '',
      department_id: project?.department_id ?? null,
      client_id: project?.client_id ?? null,
      owner_id: project?.owner_id ?? null,
      status: project?.status ?? 'backlog',
      priority: project?.priority ?? 'media',
      complexity: project?.complexity ?? 'media',
      category: project?.category ?? '',
      start_date: project?.start_date ?? today(),
      due_date: project?.due_date ?? inDays(30),
      budget: project?.budget ?? 0,
      planned_hours: project?.planned_hours ?? 0,
      expected_return: project?.expected_return ?? 0,
      actual_return: project?.actual_return ?? 0,
      return_period_months: project?.return_period_months ?? 12,
      financial_notes: project?.financial_notes ?? '',
      tags: currentTagIds,
    }),
    [project, currentTagIds],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectInput>({ resolver: zodResolver(projectSchema), defaultValues });

  React.useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  const selectedTags = watch('tags') ?? [];

  // Prévia da viabilidade com os valores digitados, antes mesmo de salvar.
  const [budget, expectedReturn, periodMonths] = watch([
    'budget',
    'expected_return',
    'return_period_months',
  ]);

  const preview = React.useMemo(() => {
    const investment = Number(budget) || 0;
    const gain = Number(expectedReturn) || 0;
    const months = Number(periodMonths) || 0;

    return {
      roi: investment > 0 ? ((gain - investment) / investment) * 100 : null,
      net: gain - investment,
      payback: investment > 0 && gain > 0 && months > 0 ? investment / (gain / months) : null,
    };
  }, [budget, expectedReturn, periodMonths]);

  function toggleTag(tagId: string) {
    setValue(
      'tags',
      selectedTags.includes(tagId) ? selectedTags.filter((id) => id !== tagId) : [...selectedTags, tagId],
      { shouldDirty: true },
    );
  }

  /** Sem isto o botão "Criar projeto" parece não fazer nada quando há erro. */
  function onInvalid(formErrors: FieldErrors<ProjectInput>) {
    const first = Object.values(formErrors).find((field) => field?.message)?.message;
    toast.error(first ? String(first) : 'Revise os campos destacados em vermelho.');
  }

  async function onSubmit(values: ProjectInput) {
    const payload = {
      ...values,
      description: values.description || null,
      category: values.category || null,
      financial_notes: values.financial_notes || null,
    };

    if (isEditing && project) {
      await updateProject.mutateAsync({ id: project.id, ...payload });
    } else {
      await createProject.mutateAsync(payload);
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar projeto' : 'Novo projeto'}</DialogTitle>
          <DialogDescription>
            Os campos alimentam a inteligência do projeto: saúde, cronograma e indicadores executivos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Código" htmlFor="code" error={errors.code?.message} required>
              <Input id="code" placeholder="PRJ-001" className="font-mono uppercase" {...register('code')} />
            </Field>

            <Field label="Nome do projeto" htmlFor="name" error={errors.name?.message} required className="sm:col-span-2">
              <Input id="name" placeholder="Portal Corporativo" {...register('name')} />
            </Field>
          </div>

          <Field label="Descrição" htmlFor="description" error={errors.description?.message}>
            <Textarea
              id="description"
              rows={3}
              placeholder="Objetivo, escopo e resultado esperado."
              {...register('description')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Controller
              control={control}
              name="department_id"
              render={({ field }) => (
                <Field label="Departamento">
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem departamento</SelectItem>
                      {departments.data?.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Controller
              control={control}
              name="client_id"
              render={({ field }) => (
                <Field label="Cliente">
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem cliente</SelectItem>
                      {clients.data?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
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
                <Field label="Responsável">
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Definir depois</SelectItem>
                      {people.data?.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Field label="Status">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUS_OPTIONS.map((option) => (
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
              name="priority"
              render={({ field }) => (
                <Field label="Prioridade">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((option) => (
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
              name="complexity"
              render={({ field }) => (
                <Field label="Complexidade">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPLEXITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Field label="Categoria" htmlFor="category">
              <Input id="category" placeholder="Transformação Digital" {...register('category')} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Data de início" htmlFor="start_date" error={errors.start_date?.message} required>
              <Input id="start_date" type="date" {...register('start_date')} />
            </Field>
            <Field label="Prazo final" htmlFor="due_date" error={errors.due_date?.message} required>
              <Input id="due_date" type="date" {...register('due_date')} />
            </Field>
            <Field label="Orçamento (R$)" htmlFor="budget" error={errors.budget?.message}>
              <Input id="budget" type="number" step="0.01" min="0" {...register('budget')} />
            </Field>
            <Field label="Horas planejadas" htmlFor="planned_hours" error={errors.planned_hours?.message}>
              <Input id="planned_hours" type="number" step="0.5" min="0" {...register('planned_hours')} />
            </Field>
          </div>

          {/* Viabilidade econômica — retorno financeiro do projeto */}
          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Viabilidade econômica</legend>
            <p className="-mt-1 text-xs text-muted-foreground">
              O retorno esperado é comparado ao orçamento para calcular ROI, benefício líquido e payback.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Retorno esperado (R$)"
                htmlFor="expected_return"
                error={errors.expected_return?.message}
                hint="Receita nova, ganho ou economia gerada."
              >
                <Input id="expected_return" type="number" step="0.01" min="0" {...register('expected_return')} />
              </Field>
              <Field
                label="Horizonte (meses)"
                htmlFor="return_period_months"
                error={errors.return_period_months?.message}
                hint="Período considerado para o retorno."
              >
                <Input
                  id="return_period_months"
                  type="number"
                  step="1"
                  min="1"
                  max="240"
                  {...register('return_period_months')}
                />
              </Field>
              <Field
                label="Retorno já realizado (R$)"
                htmlFor="actual_return"
                error={errors.actual_return?.message}
                hint="Valor comprovado até hoje."
              >
                <Input id="actual_return" type="number" step="0.01" min="0" {...register('actual_return')} />
              </Field>
            </div>

            <Field
              label="Premissas do cálculo"
              htmlFor="financial_notes"
              error={errors.financial_notes?.message}
              hint="De onde vem o retorno e como ele será medido."
            >
              <Textarea
                id="financial_notes"
                rows={2}
                placeholder="Ex.: economia de 11% no frete próprio, medida pelo painel de logística."
                {...register('financial_notes')}
              />
            </Field>

            <dl className="grid gap-2 rounded-md bg-secondary/60 p-3 text-xs sm:grid-cols-3">
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">ROI estimado</dt>
                <dd className={cn('font-semibold', preview.roi !== null && preview.roi < 0 && 'text-destructive')}>
                  {preview.roi === null ? '—' : formatDelta(preview.roi)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Benefício líquido</dt>
                <dd className={cn('font-semibold', preview.net < 0 && 'text-destructive')}>
                  {formatCurrency(preview.net)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">Payback</dt>
                <dd className="font-semibold">
                  {preview.payback === null ? '—' : `${preview.payback.toFixed(1)} meses`}
                </dd>
              </div>
            </dl>
          </fieldset>

          {Boolean(tags.data?.length) && (
            <Field label="Tags" hint="Clique para marcar ou desmarcar.">
              <div className="flex flex-wrap gap-2">
                {tags.data?.map((tag) => {
                  const active = selectedTags.includes(tag.id);
                  return (
                    <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}>
                      <Badge
                        variant="outline"
                        className={cn(
                          'cursor-pointer transition-all',
                          active && 'border-transparent text-white',
                        )}
                        style={active ? { backgroundColor: tag.color } : undefined}
                        dot={active ? undefined : 'bg-current opacity-50'}
                      >
                        {tag.name}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" loading={isSubmitting}>
              {isEditing ? 'Salvar alterações' : 'Criar projeto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
