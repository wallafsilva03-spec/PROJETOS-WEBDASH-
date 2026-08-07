import type {
  AppRole,
  ComplexityLevel,
  HealthStatus,
  PriorityLevel,
  ProjectStatus,
  RiskStatus,
  StageStatus,
  TaskStatus,
  ViabilityRating,
} from '@/types/database';

/** Cores institucionais Grupo Moreno — FORTALECER · CONECTAR · CRESCER. */
export const BRAND = {
  green: '#0E8F46',
  lime: '#8CC63F',
  blue: '#1B3F94',
} as const;

/** Sequência de cores para gráficos (mesma ordem das variáveis --chart-*). */
export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
];

type Meta = { label: string; className: string; dot: string };

export const KANBAN_COLUMNS: { id: TaskStatus; label: string; accent: string }[] = [
  { id: 'backlog', label: 'Backlog', accent: 'bg-slate-400' },
  { id: 'planejamento', label: 'Planejamento', accent: 'bg-moreno-blue-400' },
  { id: 'em_desenvolvimento', label: 'Em Desenvolvimento', accent: 'bg-moreno-lime-500' },
  { id: 'homologacao', label: 'Homologação', accent: 'bg-amber-500' },
  { id: 'concluido', label: 'Concluído', accent: 'bg-moreno-green-500' },
];

export const PROJECT_STATUS_META: Record<ProjectStatus, Meta> = {
  nao_iniciado: {
    label: 'Não iniciado',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-300',
  },
  backlog: {
    label: 'Backlog',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    dot: 'bg-slate-400',
  },
  planejamento: {
    label: 'Planejamento',
    className: 'bg-moreno-blue-50 text-moreno-blue-700 dark:bg-moreno-blue-900/50 dark:text-moreno-blue-200',
    dot: 'bg-moreno-blue-400',
  },
  em_desenvolvimento: {
    label: 'Em Desenvolvimento',
    className: 'bg-moreno-lime-50 text-moreno-lime-800 dark:bg-moreno-lime-900/40 dark:text-moreno-lime-200',
    dot: 'bg-moreno-lime-500',
  },
  homologacao: {
    label: 'Homologação',
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  pausado: {
    label: 'Pausado',
    className: 'bg-orange-50 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200',
    dot: 'bg-orange-400',
  },
  concluido: {
    label: 'Concluído',
    className: 'bg-moreno-green-50 text-moreno-green-700 dark:bg-moreno-green-900/50 dark:text-moreno-green-200',
    dot: 'bg-moreno-green-500',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
    dot: 'bg-rose-500',
  },
};

export const TASK_STATUS_META: Record<TaskStatus, Meta> = {
  backlog: PROJECT_STATUS_META.backlog,
  planejamento: PROJECT_STATUS_META.planejamento,
  em_desenvolvimento: PROJECT_STATUS_META.em_desenvolvimento,
  homologacao: PROJECT_STATUS_META.homologacao,
  concluido: PROJECT_STATUS_META.concluido,
};

export const PRIORITY_META: Record<PriorityLevel, Meta> = {
  baixa: {
    label: 'Baixa',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  media: {
    label: 'Média',
    className: 'bg-moreno-blue-50 text-moreno-blue-700 dark:bg-moreno-blue-900/50 dark:text-moreno-blue-200',
    dot: 'bg-moreno-blue-400',
  },
  alta: {
    label: 'Alta',
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  critica: {
    label: 'Crítica',
    className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
    dot: 'bg-rose-500',
  },
};

export const COMPLEXITY_META: Record<ComplexityLevel, { label: string }> = {
  baixa: { label: 'Baixa' },
  media: { label: 'Média' },
  alta: { label: 'Alta' },
  muito_alta: { label: 'Muito alta' },
};

export const HEALTH_META: Record<HealthStatus, Meta & { description: string }> = {
  adiantado: {
    label: 'Adiantado',
    className: 'bg-moreno-lime-50 text-moreno-lime-800 dark:bg-moreno-lime-900/40 dark:text-moreno-lime-200',
    dot: 'bg-moreno-lime-500',
    description: 'Execução acima do previsto para a data de hoje.',
  },
  no_prazo: {
    label: 'No prazo',
    className: 'bg-moreno-green-50 text-moreno-green-700 dark:bg-moreno-green-900/50 dark:text-moreno-green-200',
    dot: 'bg-moreno-green-500',
    description: 'Execução alinhada ao cronograma.',
  },
  em_risco: {
    label: 'Em risco',
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    dot: 'bg-amber-500',
    description: 'Execução entre 10% e 25% abaixo do previsto.',
  },
  atrasado: {
    label: 'Atrasado',
    className: 'bg-orange-50 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200',
    dot: 'bg-orange-500',
    description: 'Prazo final já ultrapassado.',
  },
  critico: {
    label: 'Crítico',
    className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
    dot: 'bg-rose-500',
    description: 'Atraso relevante ou desvio superior a 25%.',
  },
};

/** Etapas do projeto — organograma de execução. */
export const STAGE_STATUS_META: Record<
  StageStatus,
  Meta & { description: string; bar: string }
> = {
  nao_iniciada: {
    label: 'Não iniciada',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    dot: 'bg-slate-400',
    bar: 'bg-slate-400',
    description: 'Etapa planejada, ainda sem execução registrada.',
  },
  em_andamento: {
    label: 'Em andamento',
    className: 'bg-moreno-lime-50 text-moreno-lime-800 dark:bg-moreno-lime-900/40 dark:text-moreno-lime-200',
    dot: 'bg-moreno-lime-500',
    bar: 'bg-moreno-lime-500',
    description: 'Etapa iniciada e em execução.',
  },
  pausada: {
    label: 'Pausada',
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    description: 'Execução interrompida temporariamente.',
  },
  concluida: {
    label: 'Concluída',
    className: 'bg-moreno-green-50 text-moreno-green-700 dark:bg-moreno-green-900/50 dark:text-moreno-green-200',
    dot: 'bg-moreno-green-500',
    bar: 'bg-moreno-green-500',
    description: 'Entrega da etapa finalizada.',
  },
  cancelada: {
    label: 'Cancelada',
    className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
    dot: 'bg-rose-500',
    bar: 'bg-rose-400',
    description: 'Etapa retirada do escopo — não entra no avanço consolidado.',
  },
};

export const STAGE_STATUS_OPTIONS = Object.entries(STAGE_STATUS_META).map(([value, meta]) => ({
  value: value as StageStatus,
  label: meta.label,
}));

/** Viabilidade econômica calculada a partir do ROI (function `viability_rating`). */
export const VIABILITY_META: Record<
  ViabilityRating,
  { label: string; className: string; description: string }
> = {
  sem_dados: {
    label: 'Sem dados',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    description: 'Informe orçamento e retorno esperado para avaliar a viabilidade.',
  },
  sem_retorno: {
    label: 'Sem retorno informado',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    description: 'O projeto tem investimento, mas nenhum retorno financeiro declarado.',
  },
  inviavel: {
    label: 'Inviável',
    className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
    description: 'O retorno esperado é menor que o investimento (ROI negativo).',
  },
  atencao: {
    label: 'Atenção',
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    description: 'ROI abaixo de 15% — margem estreita para imprevistos.',
  },
  viavel: {
    label: 'Viável',
    className: 'bg-moreno-green-50 text-moreno-green-700 dark:bg-moreno-green-900/50 dark:text-moreno-green-200',
    description: 'ROI entre 15% e 50% — retorno consistente.',
  },
  estrategico: {
    label: 'Alto retorno',
    className: 'bg-moreno-lime-50 text-moreno-lime-800 dark:bg-moreno-lime-900/40 dark:text-moreno-lime-200',
    description: 'ROI acima de 50% — prioridade natural no portfólio.',
  },
};

/**
 * Áreas que costumam responder por um projeto. São sugestões: o campo aceita
 * qualquer nome digitado, inclusive de pessoas que não usam a plataforma.
 */
export const RESPONSIBLE_PRESETS = ['COA', 'Projetos', 'Actius', 'MAC'] as const;

export const RISK_STATUS_META: Record<RiskStatus, { label: string; className: string }> = {
  identificado: { label: 'Identificado', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  em_mitigacao: { label: 'Em mitigação', className: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  mitigado: {
    label: 'Mitigado',
    className: 'bg-moreno-green-50 text-moreno-green-700 dark:bg-moreno-green-900/50 dark:text-moreno-green-200',
  },
  aceito: { label: 'Aceito', className: 'bg-moreno-blue-50 text-moreno-blue-700 dark:bg-moreno-blue-900/50 dark:text-moreno-blue-200' },
  materializado: { label: 'Materializado', className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200' },
};

export const ROLE_META: Record<AppRole, { label: string; description: string; rank: number }> = {
  administrador: { label: 'Administrador', description: 'Acesso total à plataforma.', rank: 4 },
  gerente: { label: 'Gerente', description: 'Enxerga e gerencia todo o portfólio.', rank: 3 },
  lider: { label: 'Líder', description: 'Gerencia os projetos em que participa.', rank: 2 },
  colaborador: { label: 'Colaborador', description: 'Executa as tarefas dos seus projetos.', rank: 1 },
};

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS_META).map(([value, meta]) => ({
  value: value as ProjectStatus,
  label: meta.label,
}));

export const TASK_STATUS_OPTIONS = KANBAN_COLUMNS.map(({ id, label }) => ({ value: id, label }));

export const PRIORITY_OPTIONS = Object.entries(PRIORITY_META).map(([value, meta]) => ({
  value: value as PriorityLevel,
  label: meta.label,
}));

export const COMPLEXITY_OPTIONS = Object.entries(COMPLEXITY_META).map(([value, meta]) => ({
  value: value as ComplexityLevel,
  label: meta.label,
}));

export const ROLE_OPTIONS = Object.entries(ROLE_META).map(([value, meta]) => ({
  value: value as AppRole,
  label: meta.label,
}));

/** Severidade do heatmap de riscos (probabilidade × impacto). */
export function riskSeverityMeta(severity: number) {
  if (severity >= 20) return { label: 'Extremo', className: 'bg-rose-600 text-white' };
  if (severity >= 12) return { label: 'Alto', className: 'bg-orange-500 text-white' };
  if (severity >= 6) return { label: 'Moderado', className: 'bg-amber-400 text-amber-950' };
  return { label: 'Baixo', className: 'bg-moreno-green-500 text-white' };
}
