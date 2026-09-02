/**
 * Tipagem do banco Supabase.
 * Pode ser regenerada com:
 *   supabase gen types typescript --project-id <id> --schema public > src/types/database.ts
 */

export type AppRole = 'administrador' | 'analista' | 'lider' | 'colaborador';

/**
 * O que pode vir gravado na coluna `profiles.role`. Bancos que ainda não
 * receberam a migration 11 devolvem `gerente`, lido como analista pela
 * `normalizeRole()` — o rótulo mudou, as permissões não.
 */
export type StoredAppRole = AppRole | 'gerente';

export type ProjectStatus =
  | 'nao_iniciado'
  | 'backlog'
  | 'planejamento'
  | 'em_desenvolvimento'
  | 'homologacao'
  | 'pausado'
  | 'concluido'
  | 'cancelado';

export type TaskStatus = 'backlog' | 'planejamento' | 'em_desenvolvimento' | 'homologacao' | 'concluido';

export type PriorityLevel = 'baixa' | 'media' | 'alta' | 'critica';
export type ComplexityLevel = 'baixa' | 'media' | 'alta' | 'muito_alta';
export type HealthStatus = 'adiantado' | 'no_prazo' | 'em_risco' | 'atrasado' | 'critico';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type RiskStatus = 'identificado' | 'em_mitigacao' | 'mitigado' | 'aceito' | 'materializado';
export type MilestoneStatus = 'pendente' | 'em_andamento' | 'concluido' | 'atrasado';
export type StageStatus = 'nao_iniciada' | 'em_andamento' | 'pausada' | 'concluida' | 'cancelada';

/** Classificação de viabilidade devolvida por `public.viability_rating()`. */
export type ViabilityRating =
  | 'sem_dados'
  | 'sem_retorno'
  | 'inviavel'
  | 'atencao'
  | 'viavel'
  | 'estrategico';

/** Área da Diretoria a que o projeto pertence. */
export type ProjectArea = 'agricola' | 'administrativo' | 'industrial';

/** Aprovação da Diretoria. */
export type ApprovalStatus = 'sim' | 'nao' | 'em_aprovacao';

/** Entrada na Melhoria Contínua. */
export type ImprovementStatus = 'sim' | 'nao' | 'em_avaliacao';

export type NotificationType =
  | 'comentario'
  | 'mencao'
  | 'tarefa_atribuida'
  | 'tarefa_status'
  | 'prazo_hoje'
  | 'prazo_amanha'
  | 'projeto_atrasado'
  | 'projeto_risco'
  | 'checklist'
  | 'arquivo'
  | 'sistema';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
  phone: string | null;
  role: StoredAppRole;
  department_id: string | null;
  weekly_capacity_hours: number;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Opção do catálogo de responsáveis (áreas e pessoas). */
export interface Responsible {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  color: string;
  is_active: boolean;
  /** Quem criou pelo formulário — pode remover depois. Null nos que vieram do seed. */
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  department_id: string | null;
  client_id: string | null;
  owner_id: string | null;
  /** Áreas e pessoas que respondem pelo projeto. Quem manda na permissão é o owner_id. */
  responsibles: string[];
  status: ProjectStatus;
  priority: PriorityLevel;
  complexity: ComplexityLevel;
  category: string | null;
  health: HealthStatus;
  start_date: string;
  due_date: string;
  /**
   * Prazo herdado, ainda não repactuado. `due_date` continua guardado; com
   * isto ligado a tela mostra "A definir" e o projeto sai dos atrasados.
   */
  prazo_a_definir: boolean;

  /* ------------------------------------------------------ Governança */
  /** Área da Diretoria. Nula enquanto o projeto não foi classificado. */
  area: ProjectArea | null;
  diretoria_aprovacao: ApprovalStatus;
  /** Se a ação já foi lançada no Redmine. */
  redmine_lancado: boolean;
  /** Data prevista para medir a aderência depois da implantação. */
  aderencia_prazo: string | null;
  melhoria_continua: ImprovementStatus;

  actual_start_date: string | null;
  actual_end_date: string | null;
  budget: number;
  cost: number;
  /** Retorno financeiro esperado no horizonte de `return_period_months`. */
  expected_return: number;
  /** Retorno financeiro já realizado. */
  actual_return: number;
  return_period_months: number;
  /** Premissas do cálculo de viabilidade econômica. */
  financial_notes: string | null;
  planned_hours: number;
  progress: number;
  position: number;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Linha da view `v_project_360` — projeto + métricas calculadas. */
export interface ProjectOverview extends Omit<Project, 'position' | 'created_by'> {
  department_name: string | null;
  department_color: string | null;
  client_name: string | null;
  owner_name: string | null;
  owner_avatar: string | null;
  team_count: number;
  total_tasks: number;
  done_tasks: number;
  late_tasks: number;
  tasks_estimated_hours: number;
  actual_hours: number;
  checklist_total: number;
  checklist_done: number;
  open_risks: number;
  max_risk_severity: number;
  milestones_total: number;
  milestones_done: number;
  expected_progress: number;
  progress_delta: number;
  days_remaining: number;
  days_late: number;
  business_days_remaining: number;
  business_days_total: number;
  efficiency: number | null;

  /* --------------------------------------------- Viabilidade econômica */
  /** Retorno esperado menos orçamento. */
  net_benefit: number;
  /** Retorno realizado menos custo já incorrido. */
  net_benefit_real: number;
  /** ROI planejado: (retorno esperado − orçamento) ÷ orçamento. */
  roi_percent: number | null;
  /** ROI realizado: (retorno realizado − custo) ÷ custo. */
  roi_real_percent: number | null;
  /** Meses para o retorno pagar o investimento. */
  payback_months: number | null;
  viability: ViabilityRating;

  /* ----------------------------------------------- Conclusão por tempo */
  /** Percentual do prazo já consumido — passa de 100% após a data de entrega. */
  time_elapsed_percent: number;
  /** Executado ÷ previsto. 1 = exatamente no ritmo do cronograma. */
  schedule_index: number | null;
  /** Data de conclusão projetada mantendo o ritmo atual. */
  forecast_end_date: string | null;
  /** Dias de antecipação (negativo) ou atraso (positivo) na projeção. */
  forecast_delay_days: number | null;

  /* ------------------------------------------------------------ Etapas */
  stages_total: number;
  stages_done: number;
  stages_running: number;
  stages_late: number;
  /** Avanço das etapas ponderado pelo peso de cada uma. */
  stages_progress: number | null;

  /**
   * Dias que o projeto levou, do começo real à entrega. Só vem preenchido
   * depois de encerrado — não há duração de algo em curso.
   */
  realizacao_dias: number | null;
}

export interface ProjectStage {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  /** Andamento escrito pelo responsável da etapa. */
  progress_notes: string | null;
  status: StageStatus;
  owner_id: string | null;
  start_date: string;
  end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  progress: number;
  weight: number;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Linha da view `v_project_stages` — etapa + métricas de prazo. */
export interface ProjectStageView extends Omit<ProjectStage, 'created_by'> {
  /** Quem cadastrou a etapa. Ausente em bancos anteriores à migration 11. */
  created_by?: string | null;
  project_code: string;
  project_name: string;
  owner_name: string | null;
  owner_avatar: string | null;
  duracao_dias: number;
  duracao_dias_uteis: number;
  expected_progress: number;
  progress_delta: number;
  time_elapsed_percent: number;
  dias_restantes: number;
  dias_atraso: number;
  atrasada: boolean;
}

export interface Task {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  code: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: PriorityLevel;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  estimated_hours: number;
  progress: number;
  position: number;
  is_milestone: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithRelations extends Task {
  assignee: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
}

export interface GanttTask {
  id: string;
  project_id: string;
  project_name: string;
  project_code: string;
  parent_task_id: string | null;
  title: string;
  status: TaskStatus;
  priority: PriorityLevel;
  is_milestone: boolean;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  estimated_hours: number;
  duracao_dias: number;
  duracao_dias_uteis: number;
  dias_restantes: number | null;
  dias_atraso: number;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  predecessores: string[];
  caminho_critico: boolean;
}

export interface TaskDependency {
  id: string;
  predecessor_id: string;
  successor_id: string;
  type: DependencyType;
  lag_days: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  project_id: string;
  task_id: string | null;
  title: string;
  is_done: boolean;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  done_at: string | null;
  done_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  due_date: string;
  status: MilestoneStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Risk {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  probability: number;
  impact: number;
  severity: number;
  status: RiskStatus;
  mitigation: string | null;
  owner_id: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  project_id: string;
  task_id: string | null;
  parent_id: string | null;
  author_id: string;
  body: string;
  edited_at: string | null;
  created_at: string;
}

export interface CommentWithAuthor extends Comment {
  author: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'job_title'> | null;
}

export interface Attachment {
  id: string;
  project_id: string;
  task_id: string | null;
  comment_id: string | null;
  uploader_id: string | null;
  bucket_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  project_id: string;
  task_id: string | null;
  user_id: string;
  work_date: string;
  hours: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role_in_project: string;
  allocation_percent: number;
  added_at: string;
}

export interface ProjectMemberWithProfile extends ProjectMember {
  profile: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'job_title' | 'role'> | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  project_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  actor_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

/**
 * Lembrete que a própria pessoa programa — hora marcada, com ou sem
 * repetição. Diferente das notificações, que nascem de regra no banco.
 */
export interface Reminder {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  body: string | null;
  /** Quando avisar da próxima vez. */
  next_at: string;
  /** Minutos entre um aviso e o seguinte. Nulo = avisa uma vez só. */
  repeat_minutes: number | null;
  is_active: boolean;
  last_fired_at: string | null;
  created_at: string;
  project?: { id: string; name: string; code: string } | null;
}

export type ReminderInput = Pick<Reminder, 'title' | 'body' | 'next_at' | 'repeat_minutes'> & {
  project_id?: string | null;
  is_active?: boolean;
};

export interface ActivityFeedItem {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  project_id: string | null;
  project_name: string | null;
  project_code: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
}

export interface AuditLogEntry {
  id: number;
  table_name: string;
  record_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  actor_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  created_at: string;
}

export interface DashboardKpis {
  projetos_ativos: number;
  projetos_concluidos: number;
  projetos_atrasados: number;
  projetos_em_risco: number;
  projetos_proximo_vencimento: number;
  total_tarefas: number;
  tarefas_concluidas: number;
  horas_planejadas: number;
  horas_realizadas: number;
  eficiencia_geral: number | null;
  indicador_geral: number;
  tarefas_concluidas_hoje: number;
  usuarios_online: number;
}

export interface WorkloadRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
  role: StoredAppRole;
  department_id: string | null;
  department_name: string | null;
  capacidade_semanal: number;
  horas_planejadas: number;
  horas_realizadas: number;
  tarefas_abertas: number;
  tarefas_atrasadas: number;
  projetos_ativos: number;
  projetos_atrasados: number;
  ocupacao_percentual: number | null;
  disponibilidade_horas: number;
}

export interface GroupCount {
  chave: string;
  total: number;
  progresso_medio?: number | null;
  atrasados?: number | null;
  cor?: string | null;
  orcamento?: number | null;
  owner_id?: string | null;
  concluidos?: number | null;
}

/** Linha da view `v_exec_financials` — retorno consolidado por departamento. */
export interface ExecFinancialRow {
  chave: string;
  cor: string;
  total: number;
  orcamento: number;
  custo: number;
  retorno_esperado: number;
  retorno_realizado: number;
  beneficio_liquido: number;
  roi_percent: number | null;
}

export interface FlowMetrics {
  lead_time_dias: number | null;
  cycle_time_dias: number | null;
  velocidade_semanal: number | null;
  entregas_12_semanas: number;
}

export interface RiskHeatCell {
  probability: number;
  impact: number;
  total: number;
  titulos: string[];
  severidade_maxima: number;
}

export interface BurnPoint {
  dia: string;
  planejado: number;
  concluido: number;
  restante: number;
}

export interface SearchResult {
  entity_type: 'project' | 'task' | 'comment' | 'file' | 'user' | 'client' | 'tag';
  id: string;
  project_id: string | null;
  title: string;
  subtitle: string | null;
  rank: number | null;
}

export interface RoadmapRow {
  project_id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  health: HealthStatus;
  progress: number;
  start_date: string;
  due_date: string;
  department_name: string | null;
  owner_name: string | null;
  milestone_id: string | null;
  milestone_name: string | null;
  milestone_date: string | null;
  milestone_status: MilestoneStatus | null;
}
