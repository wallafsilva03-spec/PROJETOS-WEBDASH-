'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
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

  function toggleTag(tagId: string) {
    setValue(
      'tags',
      selectedTags.includes(tagId) ? selectedTags.filter((id) => id !== tagId) : [...selectedTags, tagId],
      { shouldDirty: true },
    );
  }

  async function onSubmit(values: ProjectInput) {
    const payload = {
      ...values,
      description: values.description || null,
      category: values.category || null,
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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
