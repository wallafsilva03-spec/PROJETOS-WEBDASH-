/**
 * DADOS FICTÍCIOS — exclusivos da tela de demonstração.
 *
 * Usados apenas quando o portfólio ainda não tem nenhum projeto cadastrado,
 * para que a diretoria consiga avaliar o formato do relatório antes de haver
 * dados reais. Toda a interface que consome estes valores exibe aviso de que
 * são fictícios; nunca devem ser apresentados sem essa marcação.
 */
import type { ExecutiveData } from '@/hooks/use-analytics';
import type { DashboardKpis } from '@/types/database';

export const DEMO_EXECUTIVE: ExecutiveData = {
  byStatus: [
    { chave: 'backlog', total: 4, progresso_medio: 5 },
    { chave: 'planejamento', total: 6, progresso_medio: 22 },
    { chave: 'em_desenvolvimento', total: 9, progresso_medio: 54 },
    { chave: 'homologacao', total: 3, progresso_medio: 87 },
    { chave: 'concluido', total: 11, progresso_medio: 100 },
  ],
  byDepartment: [
    { chave: 'Tecnologia da Informação', cor: '#1B3F94', total: 9, atrasados: 2, progresso_medio: 58, orcamento: 1250000 },
    { chave: 'Operações', cor: '#0E8F46', total: 7, atrasados: 1, progresso_medio: 63, orcamento: 980000 },
    { chave: 'Comercial', cor: '#8CC63F', total: 6, atrasados: 0, progresso_medio: 71, orcamento: 640000 },
    { chave: 'Financeiro', cor: '#0F4C81', total: 5, atrasados: 1, progresso_medio: 44, orcamento: 520000 },
    { chave: 'Recursos Humanos', cor: '#16A34A', total: 4, atrasados: 0, progresso_medio: 80, orcamento: 310000 },
    { chave: 'Marketing', cor: '#65A30D', total: 2, atrasados: 1, progresso_medio: 35, orcamento: 180000 },
  ],
  byPriority: [
    { chave: 'baixa', total: 5, atrasados: 0 },
    { chave: 'media', total: 12, atrasados: 1 },
    { chave: 'alta', total: 11, atrasados: 2 },
    { chave: 'critica', total: 5, atrasados: 2 },
  ],
  byManager: [
    { chave: 'Ana Moreno', owner_id: null, total: 8, concluidos: 3, atrasados: 1, progresso_medio: 67 },
    { chave: 'Carlos Bertoldo', owner_id: null, total: 7, concluidos: 3, atrasados: 0, progresso_medio: 74 },
    { chave: 'Juliana Prates', owner_id: null, total: 6, concluidos: 2, atrasados: 2, progresso_medio: 49 },
    { chave: 'Rafael Nunes', owner_id: null, total: 5, concluidos: 2, atrasados: 1, progresso_medio: 58 },
    { chave: 'Marina Castro', owner_id: null, total: 4, concluidos: 1, atrasados: 0, progresso_medio: 81 },
  ],
  health: [
    { chave: 'adiantado', total: 3 },
    { chave: 'no_prazo', total: 12 },
    { chave: 'em_risco', total: 4 },
    { chave: 'atrasado', total: 3 },
    { chave: 'critico', total: 1 },
  ],
  flow: {
    lead_time_dias: 18.4,
    cycle_time_dias: 11.2,
    velocidade_semanal: 7.5,
    entregas_12_semanas: 90,
  },
};

export const DEMO_KPIS: Pick<DashboardKpis, 'indicador_geral'> = {
  indicador_geral: 62.5,
};

/** Projetos críticos fictícios, no formato mínimo que a listagem consome. */
export const DEMO_CRITICAL = [
  {
    id: 'demo-1',
    name: 'Integração do ERP com a malha logística',
    code: 'PRJ-014',
    owner_name: 'Juliana Prates',
    health: 'critico' as const,
    days_late: 23,
    progress: 41,
  },
  {
    id: 'demo-2',
    name: 'Migração do datacenter para nuvem',
    code: 'PRJ-009',
    owner_name: 'Ana Moreno',
    health: 'atrasado' as const,
    days_late: 8,
    progress: 66,
  },
  {
    id: 'demo-3',
    name: 'Portal do fornecedor',
    code: 'PRJ-021',
    owner_name: 'Rafael Nunes',
    health: 'atrasado' as const,
    days_late: 4,
    progress: 52,
  },
  {
    id: 'demo-4',
    name: 'Revisão da política de crédito',
    code: 'PRJ-006',
    owner_name: 'Marina Castro',
    health: 'em_risco' as const,
    days_late: 0,
    progress: 28,
  },
];
