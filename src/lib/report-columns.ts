import type { ExportColumn } from '@/lib/export';
import { formatDate, formatHours, formatPercent } from '@/lib/format';
import {
  HEALTH_META,
  PRIORITY_META,
  PROJECT_STATUS_META,
  PROJECT_STATUS_OPTIONS,
  ROLE_META,
  STAGE_STATUS_META,
  TASK_STATUS_META,
  VIABILITY_META,
} from '@/lib/constants';
import type { AnalystSummary } from '@/lib/analyst-overview';
import type { GanttTask, ProjectOverview, ProjectStageView, WorkloadRow } from '@/types/database';

/** Colunas padronizadas do relatório de portfólio. */
const AREA_LABEL: Record<string, string> = {
  agricola: 'Agrícola',
  administrativo: 'Administrativo',
  industrial: 'Industrial',
};

const APPROVAL_LABEL: Record<string, string> = {
  sim: 'Sim',
  nao: 'Não',
  em_aprovacao: 'Em aprovação',
};

const IMPROVEMENT_LABEL: Record<string, string> = {
  sim: 'Sim',
  nao: 'Não',
  em_avaliacao: 'Em avaliação',
};

export const PROJECT_COLUMNS: ExportColumn<ProjectOverview>[] = [
  { header: 'Código', accessor: (p) => p.code },
  { header: 'Projeto', accessor: (p) => p.name, width: 4 },
  { header: 'Departamento', accessor: (p) => p.department_name ?? '—' },
  { header: 'Cliente', accessor: (p) => p.client_name ?? '—' },
  { header: 'Analista responsável', accessor: (p) => p.owner_name ?? '—' },
  { header: 'Área', accessor: (p) => AREA_LABEL[p.area ?? ''] ?? '—' },
  { header: 'Aprovado pela Diretoria', accessor: (p) => APPROVAL_LABEL[p.diretoria_aprovacao] ?? '—' },
  { header: 'Redmine', accessor: (p) => (p.redmine_lancado ? 'Sim' : 'Não') },
  { header: 'Prazo de aderência', accessor: (p) => (p.aderencia_prazo ? formatDate(p.aderencia_prazo) : '—') },
  { header: 'Melhoria Contínua', accessor: (p) => IMPROVEMENT_LABEL[p.melhoria_continua] ?? '—' },
  { header: 'Responsáveis', accessor: (p) => p.responsibles?.join(', ') || '—', width: 2 },
  { header: 'Status', accessor: (p) => PROJECT_STATUS_META[p.status].label },
  { header: 'Prioridade', accessor: (p) => PRIORITY_META[p.priority].label },
  { header: 'Saúde', accessor: (p) => HEALTH_META[p.health].label },
  { header: 'Início', accessor: (p) => formatDate(p.start_date) },
  { header: 'Prazo', accessor: (p) => (p.prazo_a_definir ? 'A definir' : formatDate(p.due_date)) },
  { header: 'Executado', accessor: (p) => formatPercent(p.progress) },
  { header: 'Previsto', accessor: (p) => formatPercent(p.expected_progress) },
  { header: 'Desvio', accessor: (p) => formatPercent(p.progress_delta) },
  { header: 'Tarefas', accessor: (p) => `${p.done_tasks}/${p.total_tasks}` },
  { header: 'Horas estimadas', accessor: (p) => formatHours(p.tasks_estimated_hours) },
  { header: 'Horas realizadas', accessor: (p) => formatHours(p.actual_hours) },
  { header: 'Orçamento', accessor: (p) => Number(p.budget).toFixed(2) },
  { header: 'Retorno esperado', accessor: (p) => Number(p.expected_return).toFixed(2) },
  { header: 'Retorno realizado', accessor: (p) => Number(p.actual_return).toFixed(2) },
  { header: 'Benefício líquido', accessor: (p) => Number(p.net_benefit).toFixed(2) },
  { header: 'ROI', accessor: (p) => formatPercent(p.roi_percent, 1) },
  { header: 'Payback (meses)', accessor: (p) => p.payback_months ?? '—' },
  {
    header: 'Viabilidade',
    accessor: (p) => (VIABILITY_META[p.viability] ?? VIABILITY_META.sem_dados).label,
  },
  { header: 'Prazo consumido', accessor: (p) => formatPercent(p.time_elapsed_percent) },
  { header: 'Conclusão projetada', accessor: (p) => formatDate(p.forecast_end_date) },
  { header: 'Desvio da projeção (dias)', accessor: (p) => p.forecast_delay_days ?? '—' },
  { header: 'Etapas', accessor: (p) => `${p.stages_done}/${p.stages_total}` },
  { header: 'Riscos abertos', accessor: (p) => p.open_risks },
];

export const STAGE_COLUMNS: ExportColumn<ProjectStageView>[] = [
  { header: 'Projeto', accessor: (s) => s.project_code },
  { header: 'Ordem', accessor: (s) => s.position },
  { header: 'Etapa', accessor: (s) => s.name, width: 3 },
  { header: 'Situação', accessor: (s) => STAGE_STATUS_META[s.status].label },
  { header: 'Responsável', accessor: (s) => s.owner_name ?? '—' },
  { header: 'Início previsto', accessor: (s) => formatDate(s.start_date) },
  { header: 'Início real', accessor: (s) => formatDate(s.actual_start_date) },
  { header: 'Término previsto', accessor: (s) => formatDate(s.end_date) },
  { header: 'Término real', accessor: (s) => formatDate(s.actual_end_date) },
  { header: 'Andamento', accessor: (s) => formatPercent(s.progress) },
  { header: 'Previsto', accessor: (s) => formatPercent(s.expected_progress) },
  { header: 'Dias de atraso', accessor: (s) => s.dias_atraso },
  { header: 'Observações', accessor: (s) => s.progress_notes ?? '—', width: 4 },
];

export const TASK_COLUMNS: ExportColumn<GanttTask>[] = [
  { header: 'Projeto', accessor: (t) => t.project_code },
  { header: 'Tarefa', accessor: (t) => t.title, width: 4 },
  { header: 'Status', accessor: (t) => TASK_STATUS_META[t.status].label },
  { header: 'Responsável', accessor: (t) => t.assignee_name ?? '—' },
  { header: 'Início', accessor: (t) => formatDate(t.start_date) },
  { header: 'Fim', accessor: (t) => formatDate(t.due_date) },
  { header: 'Duração (dias úteis)', accessor: (t) => t.duracao_dias_uteis },
  { header: 'Concluído', accessor: (t) => formatPercent(t.progress) },
  { header: 'Dias restantes', accessor: (t) => t.dias_restantes ?? '—' },
  { header: 'Dias de atraso', accessor: (t) => t.dias_atraso },
  { header: 'Caminho crítico', accessor: (t) => (t.caminho_critico ? 'Sim' : 'Não') },
];

export const WORKLOAD_COLUMNS: ExportColumn<WorkloadRow>[] = [
  { header: 'Colaborador', accessor: (w) => w.full_name, width: 3 },
  { header: 'Cargo', accessor: (w) => w.job_title ?? '—' },
  { header: 'Departamento', accessor: (w) => w.department_name ?? '—' },
  { header: 'Capacidade semanal', accessor: (w) => formatHours(w.capacidade_semanal) },
  { header: 'Horas planejadas', accessor: (w) => formatHours(w.horas_planejadas) },
  { header: 'Horas realizadas', accessor: (w) => formatHours(w.horas_realizadas) },
  { header: 'Ocupação', accessor: (w) => formatPercent(w.ocupacao_percentual) },
  { header: 'Disponibilidade', accessor: (w) => formatHours(w.disponibilidade_horas) },
  { header: 'Tarefas abertas', accessor: (w) => w.tarefas_abertas },
  { header: 'Tarefas atrasadas', accessor: (w) => w.tarefas_atrasadas },
  { header: 'Projetos ativos', accessor: (w) => w.projetos_ativos },
];

/** Gestão por analista — uma linha por responsável, com todos os status. */
export const ANALYST_COLUMNS: ExportColumn<AnalystSummary>[] = [
  { header: 'Responsável', accessor: (a) => a.name, width: 3 },
  { header: 'Cargo', accessor: (a) => a.jobTitle ?? '—' },
  { header: 'Perfil', accessor: (a) => (a.role ? ROLE_META[a.role].label : 'Sem login') },
  { header: 'Projetos', accessor: (a) => a.total },
  { header: 'Em aberto', accessor: (a) => a.ativos },
  { header: 'Encerrados', accessor: (a) => a.encerrados },
  { header: 'Em atraso', accessor: (a) => a.atrasados },
  { header: 'Em risco', accessor: (a) => a.emRisco },
  { header: 'Dentro do previsto', accessor: (a) => a.noPrazo },
  ...PROJECT_STATUS_OPTIONS.map((option) => ({
    header: option.label,
    accessor: (a: AnalystSummary) => a.byStatus[option.value] ?? 0,
  })),
  { header: 'Execução média', accessor: (a) => formatPercent(a.progressoMedio) },
  { header: 'Desvio médio (p.p.)', accessor: (a) => a.desvioMedio.toFixed(1) },
  { header: 'Dias de atraso (soma)', accessor: (a) => a.diasAtrasoTotal },
  { header: 'Maior atraso (dias)', accessor: (a) => a.maiorAtraso },
  { header: 'Horas estimadas', accessor: (a) => formatHours(a.horasPlanejadas) },
  { header: 'Horas realizadas', accessor: (a) => formatHours(a.horasRealizadas) },
  { header: 'Próximo prazo', accessor: (a) => formatDate(a.proximoPrazo) },
];
