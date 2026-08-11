/**
 * Consolidação do portfólio por responsável — a base da tela de gestão por
 * analista.
 *
 * Um projeto entra na conta de **todo mundo que responde por ele**: o dono no
 * sistema (`owner_id`, quem tem a permissão) e cada nome da lista de
 * responsáveis (`responsibles`, que aceita áreas e pessoas sem login). Por
 * isso a soma dos projetos de todos os analistas pode ser maior que o total do
 * portfólio — é de propósito: um projeto com três responsáveis aparece na
 * cobrança dos três.
 *
 * Quem tem login e nenhum projeto continua aparecendo, com zeros. Numa tela de
 * acompanhamento, saber quem está sem carga é tão útil quanto saber quem está
 * sobrecarregado.
 */

import { normalizeRole } from '@/lib/constants';
import { isClosed, isLate } from '@/lib/project-filters';
import type { DirectoryProfile } from '@/hooks/use-catalogs';
import type { AppRole, ProjectOverview } from '@/types/database';

export interface AnalystSummary {
  /** Nome em minúsculas — a chave de agrupamento. */
  key: string;
  name: string;
  profileId: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  role: AppRole | null;
  email: string | null;
  projects: ProjectOverview[];

  total: number;
  ativos: number;
  encerrados: number;
  atrasados: number;
  emRisco: number;
  noPrazo: number;
  byStatus: Record<string, number>;

  progressoMedio: number;
  desvioMedio: number;
  /** Soma dos dias de atraso dos projetos vencidos. */
  diasAtrasoTotal: number;
  maiorAtraso: number;
  horasPlanejadas: number;
  horasRealizadas: number;
  /** Prazo mais próximo entre os projetos ainda em aberto. */
  proximoPrazo: string | null;
}

/** Nome sem espaços sobrando, em minúsculas, para casar pessoas e áreas. */
function keyOf(name: string) {
  return name.trim().toLowerCase();
}

const EMPTY = {
  total: 0,
  ativos: 0,
  encerrados: 0,
  atrasados: 0,
  emRisco: 0,
  noPrazo: 0,
  progressoMedio: 0,
  desvioMedio: 0,
  diasAtrasoTotal: 0,
  maiorAtraso: 0,
  horasPlanejadas: 0,
  horasRealizadas: 0,
  proximoPrazo: null,
};

/** Rótulo usado quando um projeto não tem dono nem responsável cadastrado. */
export const UNASSIGNED = 'Sem responsável';

export function buildAnalystSummaries(
  projects: ProjectOverview[],
  profiles: DirectoryProfile[] = [],
): AnalystSummary[] {
  const groups = new Map<string, AnalystSummary>();

  const ensure = (name: string, profile?: DirectoryProfile): AnalystSummary => {
    const key = keyOf(name);
    const existing = groups.get(key);
    if (existing) {
      // O nome digitado no projeto pode bater com alguém que tem login.
      if (profile && !existing.profileId) {
        existing.profileId = profile.id;
        existing.avatarUrl = profile.avatar_url;
        existing.jobTitle = profile.job_title;
        existing.role = normalizeRole(profile.role) ?? null;
        existing.email = profile.email;
      }
      return existing;
    }

    const created: AnalystSummary = {
      key,
      name: profile?.full_name ?? name.trim(),
      profileId: profile?.id ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      jobTitle: profile?.job_title ?? null,
      role: profile ? (normalizeRole(profile.role) ?? null) : null,
      email: profile?.email ?? null,
      projects: [],
      byStatus: {},
      ...EMPTY,
    };
    groups.set(key, created);
    return created;
  };

  // Todo mundo com login aparece, mesmo sem projeto nenhum.
  profiles.forEach((profile) => {
    if (profile.full_name?.trim()) ensure(profile.full_name, profile);
  });

  projects.forEach((project) => {
    const names = new Set<string>();
    if (project.owner_name?.trim()) names.add(project.owner_name.trim());
    (project.responsibles ?? []).forEach((name) => {
      if (name?.trim()) names.add(name.trim());
    });
    if (names.size === 0) names.add(UNASSIGNED);

    names.forEach((name) => {
      const profile = profiles.find((item) => keyOf(item.full_name ?? '') === keyOf(name));
      const group = ensure(name, profile);

      // Um responsável repetido no mesmo projeto não conta duas vezes.
      if (group.projects.some((item) => item.id === project.id)) return;
      group.projects.push(project);
    });
  });

  const summaries = [...groups.values()].map((group) => {
    const { projects: list } = group;
    const abertos = list.filter((project) => !isClosed(project));

    list.forEach((project) => {
      group.byStatus[project.status] = (group.byStatus[project.status] ?? 0) + 1;
    });

    const prazos = abertos
      .map((project) => project.due_date)
      .filter(Boolean)
      .sort();

    return Object.assign(group, {
      total: list.length,
      ativos: abertos.length,
      encerrados: list.length - abertos.length,
      atrasados: list.filter(isLate).length,
      emRisco: list.filter((project) => project.health === 'em_risco').length,
      noPrazo: list.filter(
        (project) => project.health === 'no_prazo' || project.health === 'adiantado',
      ).length,
      progressoMedio: list.length
        ? list.reduce((sum, project) => sum + Number(project.progress), 0) / list.length
        : 0,
      desvioMedio: list.length
        ? list.reduce((sum, project) => sum + Number(project.progress_delta ?? 0), 0) / list.length
        : 0,
      diasAtrasoTotal: list.reduce((sum, project) => sum + Number(project.days_late ?? 0), 0),
      maiorAtraso: list.reduce((max, project) => Math.max(max, Number(project.days_late ?? 0)), 0),
      horasPlanejadas: list.reduce(
        (sum, project) => sum + Number(project.tasks_estimated_hours ?? 0),
        0,
      ),
      horasRealizadas: list.reduce((sum, project) => sum + Number(project.actual_hours ?? 0), 0),
      proximoPrazo: prazos[0] ?? null,
    });
  });

  // Quem tem mais atraso primeiro: é a fila de conversa do gestor.
  return summaries.sort(
    (a, b) => b.atrasados - a.atrasados || b.diasAtrasoTotal - a.diasAtrasoTotal || b.total - a.total,
  );
}
