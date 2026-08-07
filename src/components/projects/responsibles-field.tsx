'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RESPONSIBLE_PRESETS } from '@/lib/constants';
import { useProfiles } from '@/hooks/use-catalogs';
import { cn } from '@/lib/utils';

const MAX = 12;

/**
 * Responsáveis do projeto: áreas, pessoas cadastradas ou qualquer nome
 * escrito à mão. Guardado como lista de texto — quem responde por um projeto
 * nem sempre tem usuário na plataforma.
 */
export function ResponsiblesField({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const people = useProfiles();
  const [draft, setDraft] = React.useState('');

  const has = React.useCallback(
    (name: string) => value.some((item) => item.toLowerCase() === name.toLowerCase()),
    [value],
  );

  function add(name: string) {
    const clean = name.trim();
    if (!clean) return;

    // Já está na lista: limpa o campo em vez de deixar o texto parado ali,
    // parecendo que o botão não funcionou.
    if (has(clean)) {
      setDraft('');
      return;
    }
    if (value.length >= MAX) return;

    onChange([...value, clean.slice(0, 80)]);
    setDraft('');
  }

  function remove(name: string) {
    onChange(value.filter((item) => item !== name));
  }

  /** Enter adiciona sem enviar o formulário inteiro. */
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      add(draft);
      return;
    }
    // Backspace no campo vazio apaga o último — atalho conhecido de campos de chip.
    if (event.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  }

  const availablePeople = (people.data ?? []).filter((person) => !has(person.full_name));
  const full = value.length >= MAX;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-gradient-brand-soft py-1 pl-3 pr-1 text-xs font-medium"
            >
              {name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(name)}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remover ${name}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || full}
          placeholder={full ? `Limite de ${MAX} responsáveis` : 'Área, equipe ou nome da pessoa'}
          maxLength={80}
          aria-label="Novo responsável"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => add(draft)}
          disabled={disabled || full || !draft.trim()}
          aria-label="Adicionar responsável"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {RESPONSIBLE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => add(preset)}
            disabled={disabled || full || has(preset)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              has(preset)
                ? 'cursor-default border-transparent bg-secondary text-muted-foreground'
                : 'hover:border-primary hover:text-primary',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {has(preset) ? preset : `+ ${preset}`}
          </button>
        ))}

        {availablePeople.length > 0 && (
          <Select value="" onValueChange={add} disabled={disabled || full}>
            <SelectTrigger className="h-7 w-auto gap-1 rounded-full border-dashed px-2.5 text-xs">
              <SelectValue placeholder="+ Da equipe" />
            </SelectTrigger>
            <SelectContent>
              {availablePeople.map((person) => (
                <SelectItem key={person.id} value={person.full_name}>
                  {person.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
