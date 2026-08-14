'use client';

import * as React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/misc';
import { UserAvatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { DirectoryProfile } from '@/hooks/use-catalogs';

const MAX = 8;

/**
 * Analistas responsáveis pelo projeto — pessoas com login, várias.
 *
 * Só entra gente cadastrada, e não texto livre: destes nomes sai quem pode
 * editar o projeto, então precisa ser alguém que o banco reconheça. Para
 * área ou pessoa sem login existe o campo "Responsáveis", logo abaixo.
 *
 * A ordem importa: o primeiro da lista é gravado em `projects.owner_id`, de
 * onde as telas e os relatórios tiram o responsável principal.
 */
export function AnalystsField({
  people,
  value,
  onChange,
  loading,
}: {
  people: DirectoryProfile[];
  value: string[];
  onChange: (next: string[]) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState('');

  const chosen = React.useMemo(
    () => value.map((id) => people.find((person) => person.id === id)).filter(Boolean) as DirectoryProfile[],
    [value, people],
  );

  const matches = React.useMemo(() => {
    const clean = term.trim().toLowerCase();
    if (!clean) return people;
    return people.filter(
      (person) =>
        person.full_name.toLowerCase().includes(clean) ||
        (person.job_title ?? '').toLowerCase().includes(clean),
    );
  }, [people, term]);

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
      return;
    }
    if (value.length >= MAX) return;
    onChange([...value, id]);
  }

  const full = value.length >= MAX;

  return (
    <div className="space-y-2">
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((person, index) => (
            <li
              key={person.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand-soft py-1 pl-1.5 pr-1 text-xs font-medium"
            >
              <UserAvatar userId={person.id} name={person.full_name} src={person.avatar_url} className="size-5" />
              {person.full_name}
              {index === 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">principal</span>
              )}
              <button
                type="button"
                onClick={() => toggle(person.id)}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Tirar ${person.full_name} do projeto`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
              !chosen.length && 'text-muted-foreground',
            )}
          >
            <span className="line-clamp-1">
              {chosen.length ? `${chosen.length} analista(s)` : 'Escolher analistas'}
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-80 p-0">
          <div className="relative border-b p-2">
            <Search className="absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar por nome ou cargo…"
              className="h-8 pl-7"
              aria-label="Buscar analista"
            />
          </div>

          <ul className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
            {loading && <li className="px-2 py-1.5 text-xs text-muted-foreground">Carregando…</li>}

            {matches.map((person) => {
              const active = value.includes(person.id);

              return (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => toggle(person.id)}
                    disabled={!active && full}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                    )}
                  >
                    <Check className={cn('size-3.5 shrink-0', active ? 'text-primary' : 'opacity-0')} aria-hidden />
                    <UserAvatar
                      userId={person.id}
                      name={person.full_name}
                      src={person.avatar_url}
                      className="size-6"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{person.full_name}</span>
                      {person.job_title && (
                        <span className="block truncate text-[11px] text-muted-foreground">{person.job_title}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}

            {!loading && !matches.length && (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">Ninguém encontrado.</li>
            )}
          </ul>

          {full && (
            <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
              Limite de {MAX} analistas por projeto.
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
