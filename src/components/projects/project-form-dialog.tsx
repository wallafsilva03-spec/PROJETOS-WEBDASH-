'use client';

import * as React from 'react';
import { useForm, useWatch, Controller, type FieldErrors } from 'react-hook-form';
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
import { Switch } from '@/components/ui/misc';
import { ResponsiblesField } from '@/components/projects/responsibles-field';
import { CatalogField } from '@/components/projects/catalog-field';
import { AnalystsField } from '@/components/projects/analysts-field';
import {
  APROVACAO_OPTIONS,
  AREA_OPTIONS,
  COMPLEXITY_OPTIONS,
  MELHORIA_OPTIONS,
  PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from '@/lib/constants';
import { projectSchema, type ProjectInput } from '@/lib/validations';
import { generateProjectCode, PROJECT_CODE_HINT } from '@/lib/project-code';
import { formatCurrency, formatDelta } from '@/lib/format';
import {
  useClients,
  useDepartmentMutations,
  useDepartments,
  useProfiles,
  useTags,
} from '@/hooks/use-catalogs';
import { useCreateProject, useProjectMembers, useUpdateProject } from '@/hooks/use-projects';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';
import type { ProjectOverview } from '@/types/database';

const NONE = '__none__';

/**
 * Constante de módulo, não `= []` na assinatura: um array novo a cada render
 * mudaria a identidade de `defaultValues` e realimentaria o efeito de reset.
 */
const NO_TAGS: string[] = [];
const NO_RESPONSIBLES: string[] = [];
const NO_ANALYSTS: string[] = [];

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
  currentTagIds = NO_TAGS,
}: ProjectFormDialogProps) {
  const isEditing = Boolean(project);
  const departments = useDepartments();
  const departmentMutations = useDepartmentMutations();
  const clients = useClients();
  const people = useProfiles();
  const tags = useTags();
  const { isManager } = useSession();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  // Na edição, os analistas já gravados: o principal em `owner_id` e os
  // demais como gestores do projeto.
  const members = useProjectMembers(project?.id ?? '');

  const analystIds = React.useMemo(() => {
    if (!project) return NO_ANALYSTS;

    const managers = (members.data ?? [])
      .filter((member) => member.role_in_project === 'gestor' && member.user_id !== project.owner_id)
      .map((member) => member.user_id);

    return project.owner_id ? [project.owner_id, ...managers] : managers;
  }, [project, members.data]);

  const defaultValues = React.useMemo<ProjectInput>(
    () => ({
      code: project?.code ?? '',
      name: project?.name ?? '',
      description: project?.description ?? '',
      department_id: project?.department_id ?? null,
      client_id: project?.client_id ?? null,
      owner_id: project?.owner_id ?? null,
      analyst_ids: analystIds,
      prazo_a_definir: project?.prazo_a_definir ?? false,
      responsibles: project?.responsibles ?? NO_RESPONSIBLES,
      status: project?.status ?? 'nao_iniciado',
      priority: project?.priority ?? 'media',
      complexity: project?.complexity ?? 'media',
      category: project?.category ?? '',
      area: project?.area ?? null,
      aprovado_diretoria: project?.aprovado_diretoria ?? 'em_aprovacao',
      lancado_redmine: project?.lancado_redmine ?? false,
      data_medicao_aderencia: project?.data_medicao_aderencia ?? '',
      melhoria_continua: project?.melhoria_continua ?? 'em_avaliacao',
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
    [project, currentTagIds, analystIds],
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

  /**
   * O formulário é preenchido só na abertura. Reagir a `defaultValues` a cada
   * render faria o reset apagar o que está sendo digitado — e, como a
   * identidade do objeto muda junto, o par efeito + reset entrava em laço
   * infinito ("Maximum update depth exceeded") e travava o diálogo inteiro.
   */
  const defaultsRef = React.useRef(defaultValues);
  defaultsRef.current = defaultValues;

  // Em ref, e não nas dependências do efeito, pelo mesmo motivo acima.
  const editingRef = React.useRef(isEditing);
  editingRef.current = isEditing;

  React.useEffect(() => {
    if (!open) return;

    // O código do projeto novo é carimbado na abertura do formulário, para o
    // horário ser o do cadastro — e não o de quando a tela foi montada.
    const values = defaultsRef.current;
    reset(editingRef.current ? values : { ...values, code: generateProjectCode() });
  }, [open, reset]);

  const selectedTags = watch('tags') ?? [];

  // Prévia da viabilidade com os valores digitados, antes mesmo de salvar.
  const [budget, expectedReturn, periodMonths] = useWatch({
    control,
    name: ['budget', 'expected_return', 'return_period_months'],
  });

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
    const analysts = values.analyst_ids ?? [];

    const payload = {
      ...values,
      description: values.description || null,
      category: values.category || null,
      // Sem data escolhida a medição fica em aberto — null, nunca string vazia.
      data_medicao_aderencia: values.data_medicao_aderencia || null,
      financial_notes: values.financial_notes || null,
      // O primeiro analista é o principal, e é ele que fica em `owner_id` —
      // é de lá que as views tiram `owner_name`. Os demais são gravados como
      // gestores do projeto pela própria mutation.
      owner_id: analysts[0] ?? null,
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
            <Field
              label="Código"
              htmlFor="code"
              error={errors.code?.message}
              hint={isEditing ? undefined : PROJECT_CODE_HINT}
              required
            >
              <Input
                id="code"
                placeholder="PRJ-001"
                className={cn('font-mono uppercase', !isEditing && 'bg-secondary/60 text-muted-foreground')}
                readOnly={!isEditing}
                aria-readonly={!isEditing || undefined}
                title={isEditing ? undefined : PROJECT_CODE_HINT}
                {...register('code')}
              />
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
                <Field
                  label="Departamento"
                  hint={isManager ? 'Escreva para cadastrar um setor novo.' : undefined}
                >
                  <CatalogField
                    canEditCatalog={isManager}
                    options={departments.data ?? []}
                    loading={departments.isLoading}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    onCreate={async (name) => {
                      const created = await departmentMutations.add.mutateAsync(name).catch(() => null);
                      return created?.id ?? null;
                    }}
                    onDelete={(id) => {
                      // Some da lista: o projeto não pode continuar apontando para ele.
                      if (field.value === id) field.onChange(null);
                      departmentMutations.remove.mutate(id);
                    }}
                    emptyLabel="Sem departamento"
                    placeholder="Novo departamento"
                  />
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
              name="analyst_ids"
              render={({ field }) => (
                <Field
                  label="Analistas responsáveis"
                  error={errors.analyst_ids?.message}
                  hint="Quem responde e pode editar o projeto. O primeiro é o principal."
                >
                  <AnalystsField
                    people={people.data ?? []}
                    loading={people.isLoading}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                </Field>
              )}
            />
          </div>

          <Controller
            control={control}
            name="responsibles"
            render={({ field }) => (
              <Field
                label="Responsáveis"
                error={errors.responsibles?.message}
                hint="Áreas ou pessoas que respondem pelo projeto. Escreva o nome e tecle Enter, ou use os atalhos."
              >
                <ResponsiblesField value={field.value ?? []} onChange={field.onChange} />
              </Field>
            )}
          />

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
            <Controller
              control={control}
              name="prazo_a_definir"
              render={({ field }) => (
                <Field
                  label="Prazo final"
                  htmlFor="due_date"
                  error={errors.due_date?.message}
                  hint="Sem prazo combinado, marque abaixo — o projeto sai dos atrasados."
                  required
                >
                  <div className="space-y-2">
                    {/* A data continua guardada mesmo com a marca ligada: ela
                        volta a valer no instante em que a marca sair. */}
                    <Input id="due_date" type="date" disabled={field.value} {...register('due_date')} />
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                      Prazo a definir
                    </label>
                  </div>
                </Field>
              )}
            />
            <Field label="Orçamento (R$)" htmlFor="budget" error={errors.budget?.message}>
              <Input id="budget" type="number" step="0.01" min="0" {...register('budget')} />
            </Field>
            <Field label="Horas planejadas" htmlFor="planned_hours" error={errors.planned_hours?.message}>
              <Input id="planned_hours" type="number" step="0.5" min="0" {...register('planned_hours')} />
            </Field>
          </div>

          {/* Governança da Diretoria — o que o painel gerencial acompanha */}
          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Governança da Diretoria</legend>
            <p className="-mt-1 text-xs text-muted-foreground">
              Área do negócio, aprovação, formalização no Redmine, medição de aderência e Melhoria
              Contínua — os campos que alimentam a visão gerencial do portfólio.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <Controller
                control={control}
                name="area"
                render={({ field }) => (
                  <Field label="Área" hint="Macro-área do negócio, além do departamento executor.">
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Não definida</SelectItem>
                        {AREA_OPTIONS.map((option) => (
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
                name="aprovado_diretoria"
                render={({ field }) => (
                  <Field label="Aprovado pela Diretoria">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APROVACAO_OPTIONS.map((option) => (
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
                name="melhoria_continua"
                render={({ field }) => (
                  <Field label="Incorporar à Melhoria Contínua">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MELHORIA_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="lancado_redmine"
                render={({ field }) => (
                  <Field label="Lançado no Redmine" hint="Marque quando a ação já estiver formalizada.">
                    <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                      {field.value ? 'Sim' : 'Não'}
                    </label>
                  </Field>
                )}
              />

              <Field
                label="Data prevista para medição de aderência"
                htmlFor="data_medicao_aderencia"
                error={errors.data_medicao_aderencia?.message}
                hint="Quando a aderência será medida após a implantação. Em branco = ainda não programada."
              >
                <Input id="data_medicao_aderencia" type="date" {...register('data_medicao_aderencia')} />
              </Field>
            </div>
          </fieldset>

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
