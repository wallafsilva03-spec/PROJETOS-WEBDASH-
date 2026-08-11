'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { describeDbError, isSchemaOutdated, SETUP_HINT } from '@/lib/supabase/errors';
import { RESPONSIBLE_PRESETS } from '@/lib/constants';
import { qk } from '@/lib/query-keys';
import type { Client, Department, Profile, Responsible, Tag } from '@/types/database';

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

/** Código curto derivado do nome — `Engenharia de Dados` vira `ENGENHARIADEDA`. */
function departmentCode(name: string) {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 12);
  return slug || 'DEPTO';
}

/**
 * Criar e apagar departamentos direto do formulário de projeto.
 *
 * Continua valendo a regra de sempre: só administrador e analista escrevem no
 * catálogo de departamentos. A tela esconde os botões de quem não pode.
 */
export function useDepartmentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.departments });

  const add = useMutation({
    mutationFn: async (name: string): Promise<Department> => {
      const supabase = createClient();
      const base = departmentCode(name);

      // `code` é único. Se já existe um departamento com o mesmo código
      // abreviado, tenta os sufixos antes de desistir.
      for (const suffix of ['', '2', '3', '4']) {
        const { data, error } = await supabase
          .from('departments')
          .insert({ name: name.trim(), code: `${base}${suffix}` })
          .select()
          .single();

        if (!error) return data as Department;
        if (error.code !== '23505') throw error;
        // 23505 no nome (e não no código) significa que já existe: nada a fazer.
        if (error.message.includes('departments_name_key')) throw error;
      }

      throw new Error('Já existem departamentos demais com esse nome abreviado.');
    },
    onSuccess: (department) => {
      invalidate();
      toast.success(`Departamento ${department.name} criado.`);
    },
    onError: (error: Error) => toast.error(`Não foi possível criar: ${describeDbError(error)}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await createClient().from('departments').delete().eq('id', id).select('id');
      if (error) throw error;
      // Sem linhas devolvidas a RLS barrou a exclusão — e o PostgREST responde
      // sucesso mesmo assim.
      if (!data?.length) throw new Error('Só administrador e analista podem remover departamentos.');
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Departamento removido.');
    },
    onError: (error: Error) => toast.error(describeDbError(error)),
  });

  return { add, remove };
}

/** Marca as opções que não vieram do banco — não dá para apagá-las. */
const PRESET_PREFIX = 'preset:';

/** Catálogo de responsáveis: áreas fixas + o que o time foi cadastrando. */
export function useResponsibles() {
  return useQuery({
    queryKey: qk.responsibles,
    staleTime: HOUR,
    queryFn: async (): Promise<Responsible[]> => {
      const { data, error } = await createClient().from('responsibles').select('*').order('name');

      // Banco ainda sem a migration 10: as áreas fixas continuam à mão, e o
      // que for digitado vale para o projeto mesmo sem entrar no catálogo.
      if (error) {
        if (!isSchemaOutdated(error)) throw error;
        return RESPONSIBLE_PRESETS.map((name) => ({
          id: `${PRESET_PREFIX}${name}`,
          name,
          created_by: null,
          created_at: '',
        }));
      }

      return data as Responsible[];
    },
  });
}

export function useResponsibleMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.responsibles });

  const add = useMutation({
    mutationFn: async (name: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('responsibles')
        .insert({ name: name.trim(), created_by: user?.id });

      // Já estar no catálogo não é erro: o nome continua válido para o projeto.
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(`Responsável não salvo no catálogo: ${describeDbError(error)}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith(PRESET_PREFIX)) {
        throw new Error(`Esta área ainda não está no banco, então não há o que apagar. ${SETUP_HINT}`);
      }

      const { data, error } = await createClient().from('responsibles').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Só administrador e analista podem remover opções do catálogo.');
    },
    onSuccess: () => {
      invalidate();
      toast.success('Opção removida do catálogo.');
    },
    onError: (error: Error) => toast.error(describeDbError(error)),
  });

  return { add, remove };
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
