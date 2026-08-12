'use client';

import * as React from 'react';
import { BellRing, Repeat, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/empty-state';
import { useReminderMutations, useReminders } from '@/hooks/use-reminders';
import { useWebNotifications } from '@/hooks/use-web-notifications';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Repetições oferecidas, em minutos. `0` é "uma vez só". */
const REPEATS = [
  { value: '0', label: 'Uma vez só' },
  { value: '60', label: 'A cada hora' },
  { value: '240', label: 'A cada 4 horas' },
  { value: '1440', label: 'Todo dia' },
  { value: '10080', label: 'Toda semana' },
] as const;

/** `datetime-local` fala no fuso do navegador; `toISOString`, em UTC. */
function toLocalInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function repeatLabel(minutes: number | null) {
  return REPEATS.find((option) => option.value === String(minutes ?? 0))?.label ?? `A cada ${minutes} min`;
}

export function RemindersDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}) {
  const { data, isLoading } = useReminders(projectId);
  const { save, remove, toggle } = useReminderMutations(projectId);
  const web = useWebNotifications();

  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [when, setWhen] = React.useState('');
  const [repeat, setRepeat] = React.useState('0');

  // Sugere daqui a uma hora sempre que o diálogo abre.
  React.useEffect(() => {
    if (!open) return;
    setWhen(toLocalInput(new Date(Date.now() + 60 * 60_000)));
    setTitle('');
    setBody('');
    setRepeat('0');
  }, [open]);

  const reminders = data ?? [];
  const past = when ? new Date(when).getTime() < Date.now() : false;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !when) return;

    await save.mutateAsync({
      title: title.trim(),
      body: body.trim() || null,
      // O input entrega hora local; o banco guarda o instante absoluto.
      next_at: new Date(when).toISOString(),
      repeat_minutes: repeat === '0' ? null : Number(repeat),
      project_id: projectId,
    });

    setTitle('');
    setBody('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lembretes de {projectName}</DialogTitle>
          <DialogDescription>
            Você marca a hora e o navegador avisa — inclusive com o sistema aberto em outra aba.
          </DialogDescription>
        </DialogHeader>

        {/* Sem a permissão, o lembrete só aparece dentro do app. Melhor dizer
            isso antes de a pessoa programar e achar que falhou. */}
        {web.permission !== 'granted' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="text-sm">
              {web.permission === 'denied'
                ? 'Os avisos estão bloqueados neste navegador — libere no cadeado da barra de endereço. Sem isso o lembrete só aparece com a aba à vista.'
                : 'Libere os avisos para o lembrete chegar mesmo com você em outra aba.'}
            </p>
            {web.permission === 'default' && (
              <Button type="button" variant="outline" size="sm" onClick={() => void web.request()}>
                <BellRing className="size-3.5" />
                Liberar avisos
              </Button>
            )}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
          <Field label="O que lembrar" htmlFor="reminder-title" required>
            <Input
              id="reminder-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Cobrar a ata da reunião de status"
              maxLength={120}
            />
          </Field>

          <Field label="Detalhe" htmlFor="reminder-body" hint="Opcional — aparece no corpo do aviso.">
            <Textarea
              id="reminder-body"
              rows={2}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Confirmar com o fornecedor antes da reunião de quinta."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Quando"
              htmlFor="reminder-when"
              required
              error={past ? 'Essa hora já passou — o aviso sairia agora.' : undefined}
            >
              <Input
                id="reminder-when"
                type="datetime-local"
                value={when}
                onChange={(event) => setWhen(event.target.value)}
              />
            </Field>

            <Field label="Repetir" hint="Depois do primeiro aviso.">
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger aria-label="Repetição do lembrete">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPEATS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="brand" loading={save.isPending} disabled={!title.trim() || !when}>
              <BellRing className="size-4" />
              Programar
            </Button>
          </div>
        </form>

        <div className="max-h-64 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : !reminders.length ? (
            <EmptyState
              icon={BellRing}
              title="Nenhum lembrete"
              description="Programe o primeiro no formulário acima."
              className="border-0 bg-transparent py-6"
            />
          ) : (
            <ul className="divide-y">
              {reminders.map((reminder) => (
                <li key={reminder.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm font-medium', !reminder.is_active && 'text-muted-foreground')}>
                      {reminder.title}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{formatDateTime(reminder.next_at)}</span>
                      {reminder.repeat_minutes && (
                        <Badge variant="outline" className="text-[10px]">
                          <Repeat className="mr-1 size-2.5" />
                          {repeatLabel(reminder.repeat_minutes)}
                        </Badge>
                      )}
                      {!reminder.is_active && <span>· encerrado</span>}
                    </p>
                  </div>

                  <Switch
                    checked={reminder.is_active}
                    onCheckedChange={(isActive) => toggle.mutate({ id: reminder.id, isActive })}
                    aria-label={reminder.is_active ? 'Desligar lembrete' : 'Religar lembrete'}
                  />

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove.mutate(reminder.id)}
                    aria-label="Excluir lembrete"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
