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

export function buildPortfolio(existing: ProjectOverview[] = []): ProjectOverview[] {
  return existing.filter((project) =>
    !project.is_archived &&
    (!GENERATED_PROJECT_CODE.test(project.code.trim()) ||
      Date.parse(project.created_at) >= TRACKING_START),
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
