import type { PortfolioBaseRecord } from '@/data/portfolio-base';
import type { ProjectOverview } from '@/types/database';

const UNIT_META: Record<PortfolioBaseRecord['unit'], { id: string; color: string }> = {
  CEM: { id: 'unit:cem', color: '#0E8F46' },
  CEMMA: { id: 'unit:cemma', color: '#1B3F94' },
  COPLASA: { id: 'unit:coplasa', color: '#8CC63F' },
  'CLUSTER CEMMA/COPLASA': { id: 'unit:cluster-cemma-coplasa', color: '#5B6ABF' },
  CORPORATIVO: { id: 'unit:corporativo', color: '#64748B' },
};

// Os códigos legados compõem a base de partida. Cadastros feitos a partir
// de 05/11/2026 (Brasília) entram independentemente do formato do código.
const GENERATED_PROJECT_CODE = /^\d{4}-\d{4}-\d{6}(?:-\d+)?$/;
const TRACKING_START = Date.parse('2026-11-05T00:00:00-03:00');

// Projetos com código de data anteriores a 05/11 que constam no relatório-base.
const HISTORICAL_PROJECT_CODES = new Set([
  '2026-0904-080355', // Mapeamento Área de custos e orçamentos
  '2026-0915-155427', // Mapeamento Calda Pronta
  '2026-0923-102825',
  '2026-0821-073641',
  '2026-0811-154737',
  '2026-1023-115524',
  '2026-0914-134616',
  '2026-0820-120913',
]);

// Códigos legados fora da base de partida, mantidos no cadastro.
const OUTSIDE_REPORT_BASE = new Set(['PJC-009', 'PJC-012']);

export function buildPortfolio(
  existing: ProjectOverview[] = [],
  { includeHistoricalProjects = true } = {},
): ProjectOverview[] {
  return existing.filter((project) =>
    !project.is_archived &&
    !OUTSIDE_REPORT_BASE.has(project.code.trim().toUpperCase()) &&
    (!GENERATED_PROJECT_CODE.test(project.code.trim()) ||
      Date.parse(project.created_at) >= TRACKING_START ||
      (includeHistoricalProjects && HISTORICAL_PROJECT_CODES.has(project.code.trim()))),
  );
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
