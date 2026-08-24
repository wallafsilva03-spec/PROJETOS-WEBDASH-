/**
 * Compatibilidade com bancos que ainda não receberam a migration
 * `20250201000000_stages_and_viability.sql`.
 *
 * O site é publicado automaticamente, mas o SQL do Supabase é aplicado à mão.
 * Entre um e outro existe uma janela em que a tela é nova e o banco é antigo:
 * a view `v_project_360` e as colunas de retorno financeiro ainda não existem.
 * Em vez de derrubar o portfólio, caímos para `v_project_overview` e
 * preenchemos aqui, no cliente, os campos que o banco ainda não calcula.
 *
 * Assim que o setup.sql for executado, nada disto é usado — o banco volta a
 * ser a única fonte dos números.
 */

import type { ProjectOverview, ViabilityRating } from '@/types/database';

/** Campos que só existem na tabela `projects` depois das migrations 08 e 09. */
export const OPTIONAL_COLUMNS = [
  'expected_return',
  'actual_return',
  'return_period_months',
  'financial_notes',
  'responsibles',
  'prazo_a_definir',
  'area',
  'aprovado_diretoria',
  'lancado_redmine',
  'data_medicao_aderencia',
  'melhoria_continua',
] as const;

/** Remove do payload o que um banco antigo ainda não sabe gravar. */
export function withoutOptionalColumns<T extends Record<string, unknown>>(payload: T): Partial<T> {
  const copy = { ...payload };
  OPTIONAL_COLUMNS.forEach((column) => delete copy[column]);
  return copy;
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Mesmas fórmulas de `project_roi()` e `viability_rating()`, no cliente. */
function viabilityOf(budget: number, expectedReturn: number): ViabilityRating {
  if (expectedReturn <= 0 && budget <= 0) return 'sem_dados';
  if (expectedReturn <= 0) return 'sem_retorno';
  if (budget <= 0) return 'viavel';

  const roi = ((expectedReturn - budget) / budget) * 100;
  if (roi < 0) return 'inviavel';
  if (roi < 15) return 'atencao';
  if (roi < 50) return 'viavel';
  return 'estrategico';
}

/**
 * Governança da Diretoria — as colunas da migration 17. Banco que ainda não
 * a recebeu devolve tudo indefinido, e a tela lê os padrões daqui.
 */
function governanceDefaults(project: ProjectOverview) {
  const medicao = project.data_medicao_aderencia ?? null;

  return {
    area: project.area ?? null,
    aprovado_diretoria: project.aprovado_diretoria ?? 'em_aprovacao',
    lancado_redmine: project.lancado_redmine ?? false,
    data_medicao_aderencia: medicao,
    melhoria_continua: project.melhoria_continua ?? 'em_avaliacao',
    // A view calcula o mesmo número; aqui ele é derivado para o banco antigo.
    dias_para_medicao:
      project.dias_para_medicao ?? (medicao ? daysBetween(today(), medicao) : null),
  } satisfies Partial<ProjectOverview>;
}

/**
 * Completa uma linha de `v_project_overview` com os campos de
 * `v_project_360`, para a tela funcionar igual em banco antigo.
 */
export function fillProjectDefaults(row: Record<string, unknown>): ProjectOverview {
  const project = row as unknown as ProjectOverview;

  // A view nova já traz tudo, menos os responsáveis quando o banco parou na
  // migration 08 — daí o campo ser normalizado nos dois caminhos.
  if ('viability' in row) {
    return {
      ...project,
      responsibles: project.responsibles ?? [],
      // Banco que parou antes da migration 15 ainda não calcula a duração.
      realizacao_dias: project.realizacao_dias ?? null,
      prazo_a_definir: project.prazo_a_definir ?? false,
      ...governanceDefaults(project),
    };
  }

  const budget = Number(project.budget) || 0;
  const elapsed = daysBetween(project.start_date, today()) + 1;
  const total = daysBetween(project.start_date, project.due_date) + 1;

  return {
    ...project,
    responsibles: project.responsibles ?? [],
    expected_return: 0,
    actual_return: 0,
    return_period_months: 12,
    financial_notes: null,
    net_benefit: -budget,
    net_benefit_real: -(Number(project.cost) || 0),
    roi_percent: budget > 0 ? -100 : null,
    roi_real_percent: null,
    payback_months: null,
    viability: viabilityOf(budget, 0),
    time_elapsed_percent: total > 0 ? Math.max((elapsed / total) * 100, 0) : 0,
    schedule_index:
      project.expected_progress > 0 ? Number((project.progress / project.expected_progress).toFixed(2)) : null,
    forecast_end_date: null,
    forecast_delay_days: null,
    stages_total: 0,
    stages_done: 0,
    stages_running: 0,
    stages_late: 0,
    stages_progress: null,
    realizacao_dias: null,
    prazo_a_definir: false,
    ...governanceDefaults(project),
  };
}
