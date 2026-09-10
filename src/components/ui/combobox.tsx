'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Texto secundário — código do projeto, cargo, o que ajudar a distinguir. */
  hint?: string;
}

/** Ignora acento e caixa: quem digita "producao" acha "Produção". */
function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Seletor com busca por digitação. Um `Select` comum obriga a rolar uma lista
 * inteira de projetos; aqui bastam três letras.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Selecione',
  searchPlaceholder = 'Digite para filtrar…',
  emptyMessage = 'Nada encontrado.',
  className,
  ariaLabel,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  const filtered = React.useMemo(() => {
    const needle = normalize(term.trim());
    if (!needle) return options;
    return options.filter((option) => normalize(`${option.hint ?? ''} ${option.label}`).includes(needle));
  }, [options, term]);

  const selected = options.find((option) => option.value === value);

  // Some a busca antiga ao reabrir e mantém o destaque dentro da lista filtrada.
  React.useEffect(() => {
    if (!open) setTerm('');
  }, [open]);

  React.useEffect(() => {
    setHighlight(0);
  }, [term]);

  function choose(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        const bounded = Math.max(0, Math.min(next, filtered.length - 1));
        listRef.current?.querySelectorAll('[role="option"]')[bounded]?.scrollIntoView({ block: 'nearest' });
        return bounded;
      });
      return;
    }

    if (event.key === 'Enter' && filtered[highlight]) {
      event.preventDefault();
      choose(filtered[highlight]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className,
          )}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? (
              <>
                {selected.hint && <span className="mr-1 text-muted-foreground">{selected.hint}</span>}
                {selected.label}
              </>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(22rem,90vw)] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 border-0 px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto p-1 scrollbar-thin">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          )}

          {filtered.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => choose(option)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                index === highlight && 'bg-secondary',
              )}
            >
              <Check
                className={cn('size-4 shrink-0', option.value === value ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              {option.hint && <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span>}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
