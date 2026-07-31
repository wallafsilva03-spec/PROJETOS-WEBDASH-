'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  FolderKanban,
  ListChecks,
  Loader2,
  MessageSquare,
  Paperclip,
  Search,
  Tag as TagIcon,
  User,
} from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useGlobalSearch } from '@/hooks/use-search';
import { cn } from '@/lib/utils';
import type { SearchResult } from '@/types/database';

const ENTITY_META: Record<SearchResult['entity_type'], { label: string; icon: typeof Search }> = {
  project: { label: 'Projetos', icon: FolderKanban },
  task: { label: 'Tarefas', icon: ListChecks },
  comment: { label: 'Comentários', icon: MessageSquare },
  file: { label: 'Arquivos', icon: Paperclip },
  user: { label: 'Pessoas', icon: User },
  client: { label: 'Clientes', icon: FileText },
  tag: { label: 'Tags', icon: TagIcon },
};

function resultHref(result: SearchResult) {
  switch (result.entity_type) {
    case 'project':
      return `/projetos/${result.id}`;
    case 'task':
    case 'comment':
    case 'file':
      return result.project_id ? `/projetos/${result.project_id}` : '/projetos';
    case 'user':
      return '/workload';
    default:
      return '/projetos';
  }
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState('');
  const { data, isFetching } = useGlobalSearch(term);

  // Atalho ⌘K / Ctrl+K
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const grouped = React.useMemo(() => {
    const groups = new Map<SearchResult['entity_type'], SearchResult[]>();
    (data ?? []).forEach((item) => {
      const list = groups.get(item.entity_type) ?? [];
      list.push(item);
      groups.set(item.entity_type, list);
    });
    return Array.from(groups.entries());
  }, [data]);

  function go(result: SearchResult) {
    setOpen(false);
    setTerm('');
    router.push(resultHref(result));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Pesquisar projetos, tarefas, pessoas…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border bg-muted px-1.5 font-mono text-[10px] sm:block">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12%] max-w-2xl translate-y-0 gap-0 p-0" hideClose>
          <DialogTitle className="sr-only">Pesquisa global</DialogTitle>

          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar em todo o sistema…"
              className="h-14 border-0 px-0 shadow-none focus-visible:ring-0"
            />
            {isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
            {term.trim().length < 2 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Digite ao menos 2 caracteres para pesquisar.
              </p>
            ) : grouped.length === 0 && !isFetching ? (
              <EmptyState
                icon={Search}
                title="Nenhum resultado"
                description={`Nada encontrado para "${term}".`}
                className="border-0 bg-transparent"
              />
            ) : (
              grouped.map(([type, items]) => {
                const meta = ENTITY_META[type];
                return (
                  <section key={type} className="mb-2">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {meta.label}
                    </p>
                    <ul>
                      {items.map((item) => (
                        <li key={`${type}-${item.id}`}>
                          <button
                            type="button"
                            onClick={() => go(item)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                              'hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none',
                            )}
                          >
                            <meta.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                            {item.subtitle && (
                              <span className="shrink-0 truncate text-xs text-muted-foreground">
                                {item.subtitle}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
