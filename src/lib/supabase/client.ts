'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { requireSupabaseEnv } from './env';

let client: SupabaseClient | undefined;

/** Cliente Supabase do browser (singleton — mantém a mesma conexão Realtime). */
export function createClient(): SupabaseClient {
  if (client) return client;

  const { url, anonKey } = requireSupabaseEnv();

  client = createBrowserClient(url, anonKey, {
    realtime: { params: { eventsPerSecond: 20 } },
  });

  return client;
}
