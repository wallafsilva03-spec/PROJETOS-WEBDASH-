'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Timer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useTimeEntries, useTimeEntryMutations } from '@/hooks/use-project-details';
import { timeEntrySchema, type TimeEntryInput } from '@/lib/validations';
import { formatDate, formatHours } from '@/lib/format';
import type { TaskWithRelations } from '@/types/database';

const NONE = '__none__';

export function TimeEntriesPanel({ projectId, tasks }: { projectId: string; tasks: TaskWithRelations[] }) {
  const { data, isLoading } = useTimeEntries(projectId);
  const createEntry = useTimeEntryMutations(projectId);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TimeEntryInput>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: { work_date: new Date().toISOString().slice(0, 10), hours: 1, task_id: null },
  });

  const entries = data ?? [];
  const total = entries.reduce((sum, entry) => sum + Number(entry.hours), 0);

  async function onSubmit(values: TimeEntryInput) {
    await createEntry.mutateAsync({
      ...values,
      task_id: values.task_id ?? null,
      description: values.description || null,
    });
    reset({ work_date: values.work_date, hours: 1, task_id: values.task_id, description: '' });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="size-4 text-primary" aria-hidden />
            Apontar horas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Controller
              control={control}
              name="task_id"
              render={({ field }) => (
                <Field label="Tarefa">
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem tarefa específica</SelectItem>
                      {tasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data" htmlFor="entry-date" error={errors.work_date?.message} required>
                <Input id="entry-date" type="date" {...register('work_date')} />
              </Field>
              <Field label="Horas" htmlFor="entry-hours" error={errors.hours?.message} required>
                <Input id="entry-hours" type="number" step="0.25" min="0.25" max="24" {...register('hours')} />
              </Field>
            </div>

            <Field label="Descrição" htmlFor="entry-description">
              <Input id="entry-description" placeholder="O que foi executado" {...register('description')} />
            </Field>

            <Button type="submit" variant="brand" className="w-full" loading={isSubmitting}>
              <Plus className="size-4" />
              Registrar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Apontamentos</CardTitle>
          <span className="text-sm font-semibold">{formatHours(total)} no total</span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !entries.length ? (
            <EmptyState
              icon={Timer}
              title="Nenhuma hora apontada"
              description="Os apontamentos alimentam a eficiência e o workload da equipe."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2.5">
                  <UserAvatar userId={entry.user_id} name={entry.user?.full_name} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.user?.full_name ?? 'Usuário'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(entry.work_date)}
                      {entry.description && ` · ${entry.description}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{formatHours(entry.hours)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
