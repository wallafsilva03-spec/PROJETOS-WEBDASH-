'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query-keys';
import type { SearchResult } from '@/types/database';

/** Adia a atualização do termo para não disparar uma consulta por tecla. */
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** Pesquisa global — projetos, tarefas, comentários, arquivos, pessoas, clientes e tags. */
export function useGlobalSearch(term: string) {
  const debounced = useDebouncedValue(term.trim(), 280);

  return useQuery({
    queryKey: qk.search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 20_000,
    queryFn: async (): Promise<SearchResult[]> => {
      const { data, error } = await createClient().rpc('global_search', {
        p_query: debounced,
        p_limit: 30,
      });
      if (error) throw error;
      return (data ?? []) as SearchResult[];
    },
  });
}
