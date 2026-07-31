'use client';

import * as React from 'react';
import { Flag, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useMilestoneMutations, useMilestones } from '@/hooks/use-project-details';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MilestoneStatus } from '@/types/database';

const STATUS_META: Record<MilestoneStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  em_andamento: {
    label: 'Em andamento',
    className: 'bg-moreno-lime-50 text-moreno-lime-800 dark:bg-moreno-lime-900/40 dark:text-moreno-lime-200',
  },
  concluido: {
    label: 'Concluído',
    className: 'bg-moreno-green-50 text-moreno-green-700 dark:bg-moreno-green-900/50 dark:text-moreno-green-200',
  },
  atrasado: { label: 'Atrasado', className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200' },
};

export function MilestonesPanel({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { data, isLoading } = useMilestones(projectId);
  const { save, remove } = useMilestoneMutations(projectId);
  const [name, setName] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');

  const milestones = data ?? [];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !dueDate) return;
    save.mutate({ name: name.trim(), due_date: dueDate });
    setName('');
    setDueDate('');
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flag className="size-4 text-primary" aria-hidden />
          Marcos
          <Badge variant="secondary">{milestones.length}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !milestones.length ? (
          <EmptyState
            icon={Flag}
            title="Nenhum marco"
            description="Marcos destacam entregas-chave no roadmap executivo."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ol className="space-y-2">
            {milestones.map((milestone) => {
              const isLate = milestone.status !== 'concluido' && milestone.due_date < new Date().toISOString().slice(0, 10);
              return (
                <li
                  key={milestone.id}
                  className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-secondary/50"
                >
                  <span
                    className={cn(
                      'size-2.5 shrink-0 rotate-45 rounded-sm',
                      milestone.status === 'concluido' ? 'bg-success' : isLate ? 'bg-destructive' : 'bg-primary',
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{milestone.name}</p>
                    <p className={cn('text-xs text-muted-foreground', isLate && 'font-medium text-destructive')}>
                      {formatDate(milestone.due_date)}
                    </p>
                  </div>

                  {canManage ? (
                    <Select
                      value={milestone.status}
                      onValueChange={(value) =>
                        save.mutate({ id: milestone.id, status: value as MilestoneStatus })
                      }
                    >
                      <SelectTrigger className="h-8 w-36 text-xs" aria-label="Status do marco">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_META).map(([value, meta]) => (
                          <SelectItem key={value} value={value}>
                            {meta.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="soft" className={STATUS_META[milestone.status].className}>
                      {STATUS_META[milestone.status].label}
                    </Badge>
                  )}

                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => remove.mutate(milestone.id)}
                      aria-label={`Remover marco ${milestone.name}`}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {canManage && (
          <form onSubmit={submit} className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do marco"
              aria-label="Nome do marco"
            />
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="sm:w-44"
              aria-label="Data do marco"
            />
            <Button type="submit" variant="outline" size="icon" loading={save.isPending} aria-label="Adicionar marco">
              <Plus className="size-4" />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
