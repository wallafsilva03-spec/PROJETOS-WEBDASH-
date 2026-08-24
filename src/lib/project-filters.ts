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
  AREA_META,
  CLOSED_PROJECT_STATUSES,
  HEALTH_META,
  LATE_HEALTH,
  MEDICAO_PROXIMA_DIAS,
  ON_TRACK_HEALTH,
  PROJECT_STATUS_META,
  STATUS_GERENCIAL_META,
  STATUS_GERENCIAL_STATUSES,
  statusGerencial,
} from '@/lib/constants';
import type {
  ApprovalStatus,
  HealthStatus,
  ImprovementStatus,
  ProjectArea,
  ProjectOverview,
  ProjectStatus,
  StatusGerencial,
} from '@/types/database';

export const ALL = '__all__';

/** Agrupamentos de status oferecidos além dos valores do enum. */
export type StatusFilter =
  | typeof ALL
  | 'ativos'
  | 'encerrados'
  /* Agrupamentos da visão gerencial — ver GERENCIAL_FILTER. */
  | 'em_andamento'
  | 'paralisado'
  | 'nao_iniciados'
  | ProjectStatus;

/** `em_atraso` reúne atrasado + crítico, como o KPI do dashboard. */
export type HealthFilter = typeof ALL | 'em_atraso' | 'atencao' | 'no_previsto' | HealthStatus;

/** Filtros de governança: `__all__` ou o valor gravado no projeto. */
export type AreaFilter = typeof ALL | ProjectArea | 'nao_definida';
export type AprovacaoFilter = typeof ALL | ApprovalStatus;
export type RedmineFilter = typeof ALL | 'sim' | 'nao';
export type MelhoriaFilter = typeof ALL | ImprovementStatus;

export interface PortfolioQuery {
  busca?: string;
  status?: StatusFilter;
  saude?: HealthFilter;
  depto?: string;
  responsavel?: string;
  /** Somente projetos que vencem nos próximos N dias. */
  prazo?: number;
  ordenar?: string;
  area?: AreaFilter;
  aprovacao?: AprovacaoFilter;
  redmine?: RedmineFilter;
  melhoria?: MelhoriaFilter;
}

/** Recorte de governança aplicado no cliente, igual em todas as telas. */
export interface GovernanceQuery {
  area?: AreaFilter;
  aprovacao?: AprovacaoFilter;
  redmine?: RedmineFilter;
  melhoria?: MelhoriaFilter;
}

/**
 * Nome de cada status gerencial dentro do vocabulário de filtros.
 *
 * Concluído e cancelado são um status operacional só, e usam a própria chave.
 * Os outros três agrupam mais de um status e ganham chave própria — em
 * especial `nao_iniciados`, no plural, para não colidir com o status
 * `nao_iniciado`, que continua filtrando exatamente o que sempre filtrou.
 */
export const GERENCIAL_FILTER: Record<StatusGerencial, StatusFilter> = {
  concluido: 'concluido',
  em_andamento: 'em_andamento',
  paralisado: 'paralisado',
  nao_iniciado: 'nao_iniciados',
  cancelado: 'cancelado',
};

const STATUS_GROUPS: Record<string, ProjectStatus[]> = {
  ativos: ACTIVE_PROJECT_STATUSES,
  encerrados: CLOSED_PROJECT_STATUSES,
  // Os status da visão gerencial também valem como filtro: clicar em
  // "Paralisado" no painel da Diretoria leva à mesma lista no portfólio.
  em_andamento: STATUS_GERENCIAL_STATUSES.em_andamento,
  paralisado: STATUS_GERENCIAL_STATUSES.paralisado,
  nao_iniciados: STATUS_GERENCIAL_STATUSES.nao_iniciado,
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
  ativos: 'Em execução',
  encerrados: 'Encerrados',
  em_andamento: STATUS_GERENCIAL_META.em_andamento.label,
  paralisado: STATUS_GERENCIAL_META.paralisado.label,
  nao_iniciados: STATUS_GERENCIAL_META.nao_iniciado.label,
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
  if (query.area && query.area !== ALL) params.set('area', query.area);
  if (query.aprovacao && query.aprovacao !== ALL) params.set('aprovacao', query.aprovacao);
  if (query.redmine && query.redmine !== ALL) params.set('redmine', query.redmine);
  if (query.melhoria && query.melhoria !== ALL) params.set('melhoria', query.melhoria);

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

/* -------------------------------------------- Governança da Diretoria */

export function isAreaFilter(value: string): value is AreaFilter {
  return value === ALL || value === 'nao_definida' || value in AREA_META;
}

/** Área do projeto como chave de agrupamento — o nulo vira `nao_definida`. */
export function areaKey(project: Pick<ProjectOverview, 'area'>): ProjectArea | 'nao_definida' {
  return project.area ?? 'nao_definida';
}

/** Status gerencial do projeto — os oito operacionais reduzidos a cinco. */
export function gerencialOf(project: Pick<ProjectOverview, 'status'>): StatusGerencial {
  return statusGerencial(project.status);
}

export function gerencialLabel(value: StatusGerencial) {
  return STATUS_GERENCIAL_META[value].label;
}

/**
 * Medição de aderência marcada para os próximos `days` dias — ou já vencida
 * sem que o projeto tenha sido encerrado.
 */
export function isMedicaoProxima(
  project: Pick<ProjectOverview, 'data_medicao_aderencia' | 'dias_para_medicao'>,
  days = MEDICAO_PROXIMA_DIAS,
) {
  if (!project.data_medicao_aderencia) return false;
  const remaining = project.dias_para_medicao;
  return remaining !== null && remaining !== undefined && remaining <= days;
}

/**
 * Recorte de governança no cliente. Fica fora da consulta de propósito: as
 * colunas são da migration 17, e um banco que ainda não a recebeu devolveria
 * erro no filtro do Supabase em vez de simplesmente não filtrar.
 */
export function matchesGovernance(project: ProjectOverview, query: GovernanceQuery) {
  if (query.area && query.area !== ALL && areaKey(project) !== query.area) return false;
  if (query.aprovacao && query.aprovacao !== ALL && project.aprovado_diretoria !== query.aprovacao) {
    return false;
  }
  if (query.redmine && query.redmine !== ALL) {
    if (project.lancado_redmine !== (query.redmine === 'sim')) return false;
  }
  if (query.melhoria && query.melhoria !== ALL && project.melhoria_continua !== query.melhoria) {
    return false;
  }
  return true;
}

export function hasGovernanceFilters(query: GovernanceQuery) {
  return [query.area, query.aprovacao, query.redmine, query.melhoria].some(
    (value) => value && value !== ALL,
  );
}
