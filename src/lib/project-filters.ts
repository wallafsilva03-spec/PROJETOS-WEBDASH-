/**
 * Vocabulário de filtros do portfólio, compartilhado entre quem *aponta* para
 * a tela de projetos (indicadores do dashboard, gestão por analista) e a
 * própria tela, que lê tudo da URL.
 *
 * Manter isso em um lugar só é o que garante que o número do indicador e a
 * lista que aparece depois do clique falem do mesmo conjunto de projetos.
 */

import {
  ACTIVE_PROJECT_STATUSES,
  CLOSED_PROJECT_STATUSES,
  HEALTH_META,
  LATE_HEALTH,
  ON_TRACK_HEALTH,
  PROJECT_STATUS_META,
} from '@/lib/constants';
import type { HealthStatus, ProjectOverview, ProjectStatus } from '@/types/database';

export const ALL = '__all__';

/** Agrupamentos de status oferecidos além dos valores do enum. */
export type StatusFilter = typeof ALL | 'ativos' | 'encerrados' | ProjectStatus;

/** `em_atraso` reúne atrasado + crítico, como o KPI do dashboard. */
export type HealthFilter = typeof ALL | 'em_atraso' | 'atencao' | 'no_previsto' | HealthStatus;

export interface PortfolioQuery {
  busca?: string;
  status?: StatusFilter;
  saude?: HealthFilter;
  depto?: string;
  responsavel?: string;
  /** Somente projetos que vencem nos próximos N dias. */
  prazo?: number;
  ordenar?: string;
}

const STATUS_GROUPS: Record<string, ProjectStatus[]> = {
  ativos: ACTIVE_PROJECT_STATUSES,
  encerrados: CLOSED_PROJECT_STATUSES,
};

const HEALTH_GROUPS: Record<string, HealthStatus[]> = {
  em_atraso: LATE_HEALTH,
  atencao: ['em_risco', ...LATE_HEALTH],
  no_previsto: ON_TRACK_HEALTH,
};

export function isStatusFilter(value: string): value is StatusFilter {
  return value === ALL || value in STATUS_GROUPS || value in PROJECT_STATUS_META;
}

export function isHealthFilter(value: string): value is HealthFilter {
  return value === ALL || value in HEALTH_GROUPS || value in HEALTH_META;
}

/** Status escolhido → lista para o `in` do Supabase. `undefined` = sem filtro. */
export function statusList(value: StatusFilter): ProjectStatus[] | undefined {
  if (value === ALL) return undefined;
  return STATUS_GROUPS[value] ?? [value as ProjectStatus];
}

export function healthList(value: HealthFilter): HealthStatus[] | undefined {
  if (value === ALL) return undefined;
  return HEALTH_GROUPS[value] ?? [value as HealthStatus];
}

export const STATUS_FILTER_LABEL: Record<string, string> = {
  ativos: 'Em andamento',
  encerrados: 'Encerrados',
};

export const HEALTH_FILTER_LABEL: Record<string, string> = {
  em_atraso: 'Em atraso',
  atencao: 'Exigem atenção',
  no_previsto: 'Dentro do previsto',
};

export function statusFilterLabel(value: StatusFilter) {
  if (value === ALL) return 'Todos os status';
  return STATUS_FILTER_LABEL[value] ?? PROJECT_STATUS_META[value as ProjectStatus].label;
}

export function healthFilterLabel(value: HealthFilter) {
  if (value === ALL) return 'Toda saúde';
  return HEALTH_FILTER_LABEL[value] ?? HEALTH_META[value as HealthStatus].label;
}

/** Link para o portfólio já filtrado. */
export function portfolioHref(query: PortfolioQuery = {}) {
  const params = new URLSearchParams();

  if (query.busca) params.set('busca', query.busca);
  if (query.status && query.status !== ALL) params.set('status', query.status);
  if (query.saude && query.saude !== ALL) params.set('saude', query.saude);
  if (query.depto && query.depto !== ALL) params.set('depto', query.depto);
  if (query.responsavel) params.set('responsavel', query.responsavel);
  if (query.prazo) params.set('prazo', String(query.prazo));
  if (query.ordenar) params.set('ordenar', query.ordenar);

  const search = params.toString();
  return search ? `/projetos?${search}` : '/projetos';
}

/* ------------------------------------------------- Regras de leitura */

export function isClosed(project: Pick<ProjectOverview, 'status'>) {
  return CLOSED_PROJECT_STATUSES.includes(project.status);
}

/** Em atraso pela saúde calculada no banco — mesma regra do KPI. */
export function isLate(project: Pick<ProjectOverview, 'health'>) {
  return LATE_HEALTH.includes(project.health);
}

/** Vence nos próximos `days` dias e ainda não foi encerrado. */
export function isDueWithin(
  project: Pick<ProjectOverview, 'status' | 'days_remaining'>,
  days: number,
) {
  return !isClosed(project) && project.days_remaining >= 0 && project.days_remaining <= days;
}
