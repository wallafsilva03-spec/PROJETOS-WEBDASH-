'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';

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
import { Checkbox, Separator } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommentsPanel } from '@/components/projects/comments-panel';
import { ChecklistPanel } from '@/components/projects/checklist-panel';
import { PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from '@/lib/constants';
import { taskSchema, type TaskInput } from '@/lib/validations';
import { useProjectMembers } from '@/hooks/use-projects';
import { useCreateTask, useDeleteTask, useUpdateTask } from '@/hooks/use-tasks';
import type { TaskStatus, TaskWithRelations } from '@/types/database';

const NONE = '__none__';

interface TaskDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskWithRelations | null;
  /** Coluna do Kanban usada como status inicial ao criar. */
  initialStatus?: TaskStatus;
}

export function TaskDialog({ projectId, open, onOpenChange, task, initialStatus }: TaskDialogProps) {
  const isEditing = Boolean(task);
  const members = useProjectMembers(projectId);
  const createTask = useCreateTask(projectId);
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);

  const defaultValues = React.useMemo<TaskInput>(
    () => ({
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: task?.status ?? initialStatus ?? 'backlog',
      priority: task?.priority ?? 'media',
      assignee_id: task?.assignee_id ?? null,
      start_date: task?.start_date ?? '',
      due_date: task?.due_date ?? '',
      estimated_hours: task?.estimated_hours ?? 0,
      progress: task?.progress ?? 0,
      is_milestone: task?.is_milestone ?? false,
    }),
    [task, initialStatus],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskInput>({ resolver: zodResolver(taskSchema), defaultValues });

  // Preenche na abertura. Reagir a `defaultValues` faria uma atualização em
  // tempo real na tarefa apagar o que o usuário está digitando.
  const defaultsRef = React.useRef(defaultValues);
  defaultsRef.current = defaultValues;

  React.useEffect(() => {
    if (open) reset(defaultsRef.current);
  }, [open, reset]);

  async function onSubmit(values: TaskInput) {
    const payload = {
      ...values,
      description: values.description || null,
      start_date: values.start_date || null,
      due_date: values.due_date || null,
    };

    if (isEditing && task) {
      await updateTask.mutateAsync({ id: task.id, ...payload });
    } else {
      await createTask.mutateAsync(payload);
    }

    onOpenChange(false);
  }

  async function handleDelete() {
    if (!task) return;
    await deleteTask.mutateAsync(task.id);
    onOpenChange(false);
  }

  const form = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Título" htmlFor="task-title" error={errors.title?.message} required>
        <Input id="task-title" placeholder="Descreva a entrega" {...register('title')} />
      </Field>

      <Field label="Descrição" htmlFor="task-description">
        <Textarea id="task-description" rows={3} {...register('description')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
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
                  {TASK_STATUS_OPTIONS.map((option) => (
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
          name="assignee_id"
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

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Data início" htmlFor="task-start">
          <Input id="task-start" type="date" {...register('start_date')} />
        </Field>
        <Field label="Data fim" htmlFor="task-due" error={errors.due_date?.message}>
          <Input id="task-due" type="date" {...register('due_date')} />
        </Field>
        <Field label="Horas estimadas" htmlFor="task-hours">
          <Input id="task-hours" type="number" min="0" step="0.5" {...register('estimated_hours')} />
        </Field>
        <Field label="% concluído" htmlFor="task-progress">
          <Input id="task-progress" type="number" min="0" max="100" step="5" {...register('progress')} />
        </Field>
      </div>

      <Controller
        control={control}
        name="is_milestone"
        render={({ field }) => (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
            Marcar como marco do cronograma
          </label>
        )}
      />

      <DialogFooter className="sm:justify-between">
        {isEditing ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            loading={deleteTask.isPending}
          >
            <Trash2 className="size-4" />
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="brand" loading={isSubmitting}>
            {isEditing ? 'Salvar' : 'Criar tarefa'}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? task?.title : 'Nova tarefa'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Alterações de datas recalculam automaticamente as tarefas dependentes.'
              : 'Defina prazo e horas para alimentar o Gantt e o workload.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing && task ? (
          <Tabs defaultValue="detalhes">
            <TabsList>
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="comentarios">Comentários</TabsTrigger>
            </TabsList>

            <TabsContent value="detalhes">{form}</TabsContent>

            <TabsContent value="checklist">
              <ChecklistPanel projectId={projectId} taskId={task.id} />
            </TabsContent>

            <TabsContent value="comentarios">
              <Separator className="mb-4" />
              <CommentsPanel projectId={projectId} taskId={task.id} compact />
            </TabsContent>
          </Tabs>
        ) : (
          form
        )}
      </DialogContent>
    </Dialog>
  );
}
