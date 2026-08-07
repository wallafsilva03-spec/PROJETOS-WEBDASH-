'use client';

import * as React from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export interface CatalogOption {
  id: string;
  name: string;
}

interface CatalogFieldProps {
  options: CatalogOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Grava a opção nova e devolve o id, para já deixá-la escolhida. */
  onCreate: (name: string) => Promise<string | null>;
  /** Tira a opção do catálogo — não é o mesmo que desmarcá-la aqui. */
  onDelete: (id: string) => void;
  emptyLabel: string;
  placeholder: string;
  loading?: boolean;
}

/**
 * Campo de catálogo aberto: escolhe uma opção existente, cadastra uma nova
 * escrevendo o nome — que fica salva para os próximos projetos — e remove do
 * catálogo pelo × ao lado do nome.
 *
 * É um Popover, e não um Select: dentro de um `SelectItem` do Radix qualquer
 * clique vira escolha, e o × precisa fazer o contrário disso.
 */
export function CatalogField({
  options,
  value,
  onChange,
  onCreate,
  onDelete,
  emptyLabel,
  placeholder,
  loading,
}: CatalogFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const selected = options.find((option) => option.id === value) ?? null;
  const duplicate = options.some((option) => option.name.toLowerCase() === draft.trim().toLowerCase());

  async function create() {
    const name = draft.trim();
    if (!name || saving) return;

    // Já existe: em vez de recusar, escolhe a que está lá.
    const existing = options.find((option) => option.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      onChange(existing.id);
      setDraft('');
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const id = await onCreate(name);
      if (id) onChange(id);
      setDraft('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="line-clamp-1">{selected?.name ?? emptyLabel}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex gap-1.5 border-b p-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void create();
              }
            }}
            placeholder={placeholder}
            className="h-8"
            maxLength={80}
            aria-label={placeholder}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="size-8 shrink-0"
            onClick={() => void create()}
            disabled={!draft.trim() || saving}
            aria-label="Cadastrar e selecionar"
            title={duplicate ? 'Já existe — será apenas selecionado' : 'Cadastrar e selecionar'}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <ul className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
            >
              <Check className={cn('size-3.5 shrink-0', value ? 'opacity-0' : 'text-primary')} aria-hidden />
              <span className="text-muted-foreground">{emptyLabel}</span>
            </button>
          </li>

          {loading && <li className="px-2 py-1.5 text-xs text-muted-foreground">Carregando…</li>}

          {options.map((option) => (
            <li key={option.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <Check
                  className={cn('size-3.5 shrink-0', option.id === value ? 'text-primary' : 'opacity-0')}
                  aria-hidden
                />
                <span className="truncate">{option.name}</span>
              </button>

              <button
                type="button"
                onClick={() => onDelete(option.id)}
                className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remover ${option.name} do catálogo`}
                title="Remover do catálogo"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}

          {!loading && options.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-muted-foreground">
              Nada cadastrado ainda — escreva acima para criar.
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
