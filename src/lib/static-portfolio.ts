import { PORTFOLIO_BASE, baseProjectStatus, type PortfolioBaseRecord } from '@/data/portfolio-base';
import type { ProjectOverview } from '@/types/database';

const UNIT_META: Record<PortfolioBaseRecord['unit'], { id: string; color: string }> = {
  CEM: { id: 'unit:cem', color: '#0E8F46' },
  CEMMA: { id: 'unit:cemma', color: '#1B3F94' },
  COPLASA: { id: 'unit:coplasa', color: '#8CC63F' },
  'CLUSTER CEMMA/COPLASA': { id: 'unit:cluster-cemma-coplasa', color: '#5B6ABF' },
  CORPORATIVO: { id: 'unit:corporativo', color: '#64748B' },
};

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stableId(record: PortfolioBaseRecord, index: number) {
  return `base:${slug(record.unit)}:${slug(record.code || record.name)}:${index + 1}`;
}

function emptyMetrics(): Pick<
  ProjectOverview,
  | 'team_count'
  | 'total_tasks'
  | 'done_tasks'
  | 'late_tasks'
  | 'tasks_estimated_hours'
  | 'actual_hours'
  | 'checklist_total'
  | 'checklist_done'
  | 'open_risks'
  | 'max_risk_severity'
  | 'milestones_total'
  | 'milestones_done'
  | 'expected_progress'
  | 'progress_delta'
  | 'days_remaining'
  | 'days_late'
  | 'business_days_remaining'
  | 'business_days_total'
  | 'net_benefit'
  | 'net_benefit_real'
  | 'time_elapsed_percent'
  | 'stages_total'
  | 'stages_done'
  | 'stages_running'
  | 'stages_late'
> {
  return {
    team_count: 0,
    total_tasks: 0,
    done_tasks: 0,
    late_tasks: 0,
    tasks_estimated_hours: 0,
    actual_hours: 0,
    checklist_total: 0,
    checklist_done: 0,
    open_risks: 0,
    max_risk_severity: 0,
    milestones_total: 0,
    milestones_done: 0,
    expected_progress: 0,
    progress_delta: 0,
    days_remaining: 0,
    days_late: 0,
    business_days_remaining: 0,
    business_days_total: 0,
    net_benefit: 0,
    net_benefit_real: 0,
    time_elapsed_percent: 0,
    stages_total: 0,
    stages_done: 0,
    stages_running: 0,
    stages_late: 0,
  };
}

function freshProject(record: PortfolioBaseRecord, index: number): ProjectOverview {
  const status = baseProjectStatus(record.status);
  const concluded = status === 'concluido';
  const unit = UNIT_META[record.unit];
  const date = '2026-09-23';

  return {
    id: stableId(record, index),
    code: record.code || `BASE-${String(index + 1).padStart(3, '0')}`,
    name: record.name,
    description: [
      `Evidência: ${record.evidence}`,
      `Impacto operacional: ${record.impact}`,
      `Atuação de Projetos: ${record.projectAction}`,
      `Ação da operação: ${record.operationAction}`,
    ].join('\n\n'),
    department_id: unit.id,
    department_name: record.unit,
    department_color: unit.color,
    client_id: null,
    client_name: null,
    owner_id: null,
    owner_name: null,
    owner_avatar: null,
    responsibles: [],
    status,
    priority: 'media',
    complexity: 'media',
    category: 'Base oficial 23/09/2026',
    health: 'no_prazo',
    start_date: date,
    due_date: date,
    prazo_a_definir: !concluded,
    area: null,
    diretoria_aprovacao: 'em_aprovacao',
    redmine_lancado: false,
    aderencia_prazo: null,
    melhoria_continua: record.continuousImprovement ? 'sim' : 'nao',
    actual_start_date: null,
    actual_end_date: concluded ? date : null,
    budget: 0,
    cost: 0,
    expected_return: 0,
    actual_return: 0,
    return_period_months: 12,
    financial_notes: null,
    planned_hours: 0,
    progress: concluded ? 100 : 0,
    is_archived: false,
    created_at: `${date}T00:00:00.000Z`,
    updated_at: `${date}T00:00:00.000Z`,
    efficiency: null,
    roi_percent: null,
    roi_real_percent: null,
    payback_months: null,
    viability: 'sem_dados',
    schedule_index: null,
    forecast_end_date: null,
    forecast_delay_days: null,
    stages_progress: null,
    realizacao_dias: null,
    ...emptyMetrics(),
  };
}

function normalize(value: string | null | undefined) {
  return slug(value ?? '');
}

function matchesBase(record: PortfolioBaseRecord, project: ProjectOverview) {
  const codeMatch = record.code && normalize(record.code) === normalize(project.code);
  return Boolean(codeMatch || normalize(record.name) === normalize(project.name));
}

/**
 * A base de 23/09/2026 define quais projetos existem, a unidade, o status e a
 * Melhoria Contínua. Quando o Supabase estiver disponível, os demais campos
 * já cadastrados (datas, responsáveis, horas e valores) são preservados.
 */
export function buildPortfolio(existing: ProjectOverview[] = []): ProjectOverview[] {
  return PORTFOLIO_BASE.map((record, index) => {
    const fallback = freshProject(record, index);
    const saved = existing.find((project) => matchesBase(record, project));

    if (!saved) return fallback;

    return {
      ...fallback,
      ...saved,
      id: saved.id,
      code: record.code || saved.code || fallback.code,
      name: record.name,
      description: saved.description || fallback.description,
      department_id: fallback.department_id,
      department_name: fallback.department_name,
      department_color: fallback.department_color,
      status: fallback.status,
      melhoria_continua: fallback.melhoria_continua,
      is_archived: false,
      updated_at: fallback.updated_at,
    };
  });
}

export const PORTFOLIO_UNITS = Object.entries(UNIT_META).map(([name, meta]) => ({
  id: meta.id,
  name,
  code: meta.id.replace('unit:', '').toUpperCase(),
  color: meta.color,
  is_active: true,
  created_by: null,
  created_at: '2026-09-23T00:00:00.000Z',
  updated_at: '2026-09-23T00:00:00.000Z',
}));
