/**
 * Leitura gerencial do portfólio — o que a Diretoria pergunta, calculado a
 * partir da mesma lista de projetos que o resto da plataforma usa.
 *
 * Fica aqui, e não dentro da tela, porque o painel gerencial, os indicadores
 * do dashboard e qualquer relatório futuro precisam contar do mesmo jeito:
 * um projeto pertence a um único status gerencial e a uma única área, e o
 * denominador do percentual é sempre o total já filtrado.
 */

import {
  AREA_ORDER,
  areaLabel,
  MEDICAO_PROXIMA_DIAS,
  STATUS_GERENCIAL_META,
  STATUS_GERENCIAL_ORDER,
  statusGerencial,
} from '@/lib/constants';
import { isMedicaoProxima } from '@/lib/project-filters';
import type { ProjectArea, ProjectOverview, StatusGerencial } from '@/types/database';

export type AreaKey = ProjectArea | 'nao_definida';

export interface StatusSlice {
  status: StatusGerencial;
  label: string;
  color: string;
  total: number;
  /** Percentual sobre o total de projetos considerados. */
  percent: number;
}

export interface AreaRow {
  key: AreaKey;
  label: string;
  total: number;
  porStatus: Record<StatusGerencial, number>;
  /** Percentual de cada status dentro da própria área. */
  percentPorStatus: Record<StatusGerencial, number>;
}

export interface GovernanceSummary {
  aprovados: number;
  emAprovacao: number;
  naoAprovados: number;
  redmineLancados: number;
  redminePendentes: number;
  melhoriaSim: number;
  melhoriaAvaliacao: number;
  melhoriaNao: number;
  /** Projetos com data de medição de aderência programada. */
  comMedicao: number;
  /** Medições previstas para os próximos dias (ou já vencidas). */
  medicaoProxima: number;
  /** Medições cuja data já passou. */
  medicaoVencida: number;
}

export interface PortfolioGerencial {
  total: number;
  concluidos: number;
  /** Indicador principal do painel: concluídos ÷ total. */
  percentConcluido: number;
  porStatus: StatusSlice[];
  /** Percentual por status, acessível pela chave — usado nos KPIs da linha 1. */
  percent: Record<StatusGerencial, number>;
  contagem: Record<StatusGerencial, number>;
  porArea: AreaRow[];
  governanca: GovernanceSummary;
}

function zeros(): Record<StatusGerencial, number> {
  return { concluido: 0, em_andamento: 0, paralisado: 0, nao_iniciado: 0, cancelado: 0 };
}

function share(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

/** Áreas na ordem de leitura; "Não definida" só aparece quando existe. */
function areaKeys(projects: ProjectOverview[]): AreaKey[] {
  const semArea = projects.some((project) => !project.area);
  return semArea ? [...AREA_ORDER, 'nao_definida'] : [...AREA_ORDER];
}

export function portfolioGerencial(projects: ProjectOverview[]): PortfolioGerencial {
  const total = projects.length;
  const contagem = zeros();
  const porAreaMap = new Map<AreaKey, Record<StatusGerencial, number>>();

  const governanca: GovernanceSummary = {
    aprovados: 0,
    emAprovacao: 0,
    naoAprovados: 0,
    redmineLancados: 0,
    redminePendentes: 0,
    melhoriaSim: 0,
    melhoriaAvaliacao: 0,
    melhoriaNao: 0,
    comMedicao: 0,
    medicaoProxima: 0,
    medicaoVencida: 0,
  };

  projects.forEach((project) => {
    const status = statusGerencial(project.status);
    contagem[status] += 1;

    const area: AreaKey = project.area ?? 'nao_definida';
    const row = porAreaMap.get(area) ?? zeros();
    row[status] += 1;
    porAreaMap.set(area, row);

    if (project.aprovado_diretoria === 'sim') governanca.aprovados += 1;
    else if (project.aprovado_diretoria === 'em_aprovacao') governanca.emAprovacao += 1;
    else governanca.naoAprovados += 1;

    if (project.lancado_redmine) governanca.redmineLancados += 1;
    else governanca.redminePendentes += 1;

    if (project.melhoria_continua === 'sim') governanca.melhoriaSim += 1;
    else if (project.melhoria_continua === 'em_avaliacao') governanca.melhoriaAvaliacao += 1;
    else governanca.melhoriaNao += 1;

    if (project.data_medicao_aderencia) {
      governanca.comMedicao += 1;
      if (isMedicaoProxima(project)) governanca.medicaoProxima += 1;
      if ((project.dias_para_medicao ?? 0) < 0) governanca.medicaoVencida += 1;
    }
  });

  const porStatus: StatusSlice[] = STATUS_GERENCIAL_ORDER.map((status) => ({
    status,
    label: STATUS_GERENCIAL_META[status].label,
    color: STATUS_GERENCIAL_META[status].chart,
    total: contagem[status],
    percent: share(contagem[status], total),
  }));

  const percent = zeros();
  STATUS_GERENCIAL_ORDER.forEach((status) => {
    percent[status] = share(contagem[status], total);
  });

  const porArea: AreaRow[] = areaKeys(projects).map((key) => {
    const porStatusArea = porAreaMap.get(key) ?? zeros();
    const totalArea = STATUS_GERENCIAL_ORDER.reduce((sum, status) => sum + porStatusArea[status], 0);
    const percentPorStatus = zeros();
    STATUS_GERENCIAL_ORDER.forEach((status) => {
      percentPorStatus[status] = share(porStatusArea[status], totalArea);
    });

    return {
      key,
      label: key === 'nao_definida' ? areaLabel(null) : areaLabel(key),
      total: totalArea,
      porStatus: porStatusArea,
      percentPorStatus,
    };
  });

  return {
    total,
    concluidos: contagem.concluido,
    percentConcluido: share(contagem.concluido, total),
    porStatus,
    percent,
    contagem,
    porArea,
    governanca,
  };
}

/**
 * Medições de aderência ordenadas pela data mais próxima. A estrutura já fica
 * pronta para virar alerta: `dias_para_medicao` negativo é medição vencida.
 */
export function medicoesAderencia(projects: ProjectOverview[], days = MEDICAO_PROXIMA_DIAS) {
  return projects
    .filter((project) => Boolean(project.data_medicao_aderencia))
    .filter((project) => (project.dias_para_medicao ?? Number.POSITIVE_INFINITY) <= days)
    .sort((a, b) => (a.dias_para_medicao ?? 0) - (b.dias_para_medicao ?? 0));
}
