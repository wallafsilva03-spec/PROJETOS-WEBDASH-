'use client';

import * as React from 'react';
import { ListChecks, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useChecklist, useChecklistMutations } from '@/hooks/use-project-details';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ChecklistPanelProps {
  projectId: string;
  /** `undefined` = checklist do projeto; um id = checklist da tarefa. */
  taskId?: string;
}

export function ChecklistPanel({ projectId, taskId }: ChecklistPanelProps) {
  const { data, isLoading } = useChecklist(projectId, taskId ?? null);
  const { add, toggle, remove } = useChecklistMutations(projectId);
  const [title, setTitle] = React.useState('');

  const items = data ?? [];
  const done = items.filter((item) => item.is_done).length;
  const percent = items.length ? (done / items.length) * 100 : 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    add.mutate({ title: value, taskId: taskId ?? null });
    setTitle('');
  }

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {done} de {items.length} concluídos
            </span>
            <span className="font-semibold text-foreground">{percent.toFixed(0)}%</span>
          </div>
          <Progress value={percent} indicatorClassName="bg-success" />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Checklist vazio"
          description="Adicione itens para acompanhar as etapas menores."
          className="border-0 bg-transparent py-8"
        />
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary"
            >
              <Checkbox
                id={`check-${item.id}`}
                checked={item.is_done}
                onCheckedChange={(checked) => toggle.mutate({ id: item.id, isDone: checked === true })}
              />
              <label
                htmlFor={`check-${item.id}`}
                className={cn(
                  'flex-1 cursor-pointer text-sm',
                  item.is_done && 'text-muted-foreground line-through',
                )}
              >
                {item.title}
                {item.is_done && item.done_at && (
                  <span className="ml-2 text-xs opacity-70">{formatRelative(item.done_at)}</span>
                )}
              </label>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => remove.mutate(item.id)}
                aria-label={`Remover ${item.title}`}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Adicionar item ao checklist…"
          aria-label="Novo item do checklist"
        />
        <Button type="submit" variant="outline" size="icon" loading={add.isPending} aria-label="Adicionar">
          <Plus className="size-4" />
        </Button>
      </form>
    </div>
  );
}
