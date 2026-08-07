'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useResponsibleMutations, useResponsibles } from '@/hooks/use-catalogs';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';

const MAX = 12;

/**
 * Responsáveis do projeto: áreas, pessoas cadastradas ou qualquer nome
 * escrito à mão. Guardado como lista de texto no projeto — quem responde por
 * um projeto nem sempre tem usuário na plataforma.
 *
 * O nome digitado uma vez entra no catálogo (tabela `responsibles`) e passa a
 * ser oferecido nos próximos projetos. São dois "×" com sentidos diferentes,
 * e por isso os rótulos são explícitos: o da etiqueta tira o responsável
 * deste projeto; o da lista de sugestões apaga a opção para todo mundo — e
 * este último só aparece para administrador e gerente, como nos demais
 * catálogos da plataforma.
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
  const catalog = useResponsibles();
  const { add: saveOption, remove: removeOption } = useResponsibleMutations();
  const { isManager } = useSession();
  const [draft, setDraft] = React.useState('');

  const has = React.useCallback(
    (name: string) => value.some((item) => item.toLowerCase() === name.toLowerCase()),
    [value],
  );

  /** Entra no projeto e, se for nome novo, também no catálogo. */
  function add(name: string, { save = false } = {}) {
    const clean = name.trim();
    if (!clean) return;

    if (has(clean)) {
      setDraft('');
      return;
    }
    if (value.length >= MAX) return;

    onChange([...value, clean.slice(0, 80)]);
    setDraft('');

    const known = (catalog.data ?? []).some((item) => item.name.toLowerCase() === clean.toLowerCase());
    if (save && !known && clean.length >= 2) saveOption.mutate(clean);
  }

  function remove(name: string) {
    onChange(value.filter((item) => item !== name));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      add(draft, { save: true });
      return;
    }
    // Backspace no campo vazio apaga o último — atalho conhecido de campos de chip.
    if (event.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  }

  const full = value.length >= MAX;
  const options = catalog.data ?? [];

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
                  aria-label={`Tirar ${name} deste projeto`}
                  title="Tirar deste projeto"
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
          onClick={() => add(draft, { save: true })}
          disabled={disabled || full || !draft.trim()}
          aria-label="Adicionar responsável"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {options.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5">
          {options.map((option) => {
            const chosen = has(option.name);

            return (
              <li key={option.id} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => add(option.name)}
                  disabled={disabled || full || chosen}
                  className={cn(
                    'border py-1 pl-2.5 text-xs font-medium transition-colors',
                    isManager ? 'rounded-l-full pr-1.5' : 'rounded-full pr-2.5',
                    chosen
                      ? 'cursor-default border-transparent bg-secondary text-muted-foreground'
                      : 'hover:border-primary hover:text-primary',
                    'disabled:cursor-not-allowed',
                  )}
                >
                  {chosen ? option.name : `+ ${option.name}`}
                </button>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => removeOption.mutate(option.id)}
                    disabled={disabled}
                    className={cn(
                      'rounded-r-full border border-l-0 py-1 pl-1 pr-2 text-muted-foreground transition-colors',
                      'hover:bg-destructive/10 hover:text-destructive',
                      chosen && 'border-transparent bg-secondary',
                    )}
                    aria-label={`Apagar ${option.name} do catálogo`}
                    title="Apagar do catálogo, para todos os projetos"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
