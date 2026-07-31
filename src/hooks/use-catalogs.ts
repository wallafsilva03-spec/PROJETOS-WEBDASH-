'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query-keys';
import type { Client, Department, Profile, Tag } from '@/types/database';

const HOUR = 60 * 60_000;

export function useDepartments() {
  return useQuery({
    queryKey: qk.departments,
    staleTime: HOUR,
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await createClient()
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Department[];
    },
  });
}

export function useClients() {
  return useQuery({
    queryKey: qk.clients,
    staleTime: HOUR,
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await createClient()
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useTags() {
  return useQuery({
    queryKey: qk.tags,
    staleTime: HOUR,
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await createClient().from('tags').select('*').order('name');
      if (error) throw error;
      return data as Tag[];
    },
  });
}

export type DirectoryProfile = Pick<
  Profile,
  'id' | 'full_name' | 'avatar_url' | 'email' | 'job_title' | 'role' | 'department_id'
>;

/** Diretório de pessoas — usado em responsáveis, equipe e menções. */
export function useProfiles() {
  return useQuery({
    queryKey: qk.profiles,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<DirectoryProfile[]> => {
      const { data, error } = await createClient()
        .from('profiles')
        .select('id, full_name, avatar_url, email, job_title, role, department_id')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data as DirectoryProfile[];
    },
  });
}
