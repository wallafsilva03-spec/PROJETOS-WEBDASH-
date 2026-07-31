import type { ExportColumn } from '@/lib/export';
import { formatDate, formatHours, formatPercent } from '@/lib/format';
import { HEALTH_META, PRIORITY_META, PROJECT_STATUS_META, TASK_STATUS_META } from '@/lib/constants';
import type { GanttTask, ProjectOverview, WorkloadRow } from '@/types/database';

/** Colunas padronizadas do relatório de portfólio. */
export const PROJECT_COLUMNS: ExportColumn<ProjectOverview>[] = [
  { header: 'Código', accessor: (p) => p.code },
  { header: 'Projeto', accessor: (p) => p.name, width: 4 },
  { header: 'Departamento', accessor: (p) => p.department_name ?? '—' },
  { header: 'Cliente', accessor: (p) => p.client_name ?? '—' },
  { header: 'Responsável', accessor: (p) => p.owner_name ?? '—' },
  { header: 'Status', accessor: (p) => PROJECT_STATUS_META[p.status].label },
  { header: 'Prioridade', accessor: (p) => PRIORITY_META[p.priority].label },
  { header: 'Saúde', accessor: (p) => HEALTH_META[p.health].label },
  { header: 'Início', accessor: (p) => formatDate(p.start_date) },
  { header: 'Prazo', accessor: (p) => formatDate(p.due_date) },
  { header: 'Executado', accessor: (p) => formatPercent(p.progress) },
  { header: 'Previsto', accessor: (p) => formatPercent(p.expected_progress) },
  { header: 'Desvio', accessor: (p) => formatPercent(p.progress_delta) },
  { header: 'Tarefas', accessor: (p) => `${p.done_tasks}/${p.total_tasks}` },
  { header: 'Horas estimadas', accessor: (p) => formatHours(p.tasks_estimated_hours) },
  { header: 'Horas realizadas', accessor: (p) => formatHours(p.actual_hours) },
  { header: 'Orçamento', accessor: (p) => Number(p.budget).toFixed(2) },
  { header: 'Riscos abertos', accessor: (p) => p.open_risks },
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
