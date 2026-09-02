/**
 * Leitura gerencial do portfólio: cinco situações e três áreas.
 *
 * O sistema trabalha com oito status, que servem para quem executa. Para a
 * Diretoria isso é detalhe demais — o que se pergunta numa reunião é quanto
 * está concluído, quanto anda, quanto parou e quanto nem começou. Aqui os
 * oito viram cinco, e é por este arquivo que as telas gerenciais passam a
 * falar a mesma língua.
 *
 * Tudo é devolvido em contagem **e** percentual, porque é assim que o número
 * é lido no telão e na apresentação.
 */

import { PROJECT_STATUS_META } from '@/lib/constants';
import type { ProjectArea, ProjectOverview, ProjectStatus } from '@/types/database';

export interface ManagementBucket {
  id: 'concluido' | 'em_andamento' | 'paralisado' | 'nao_iniciado' | 'cancelado';
  label: string;
  /** Classe de fundo, usada nas barras e nos pontos. */
  tone: string;
  statuses: ProjectStatus[];
}

/**
 * A ordem é a da leitura: o que terminou, o que anda, o que travou, o que não
 * começou e o que foi descartado.
 */
export const MANAGEMENT_BUCKETS: ManagementBucket[] = [
  {
    id: 'concluido',
    label: 'Concluído',
    tone: 'bg-moreno-green-500',
    statuses: ['concluido'],
  },
  {
    id: 'em_andamento',
    label: 'Em andamento',
    tone: 'bg-moreno-lime-500',
    statuses: ['planejamento', 'em_desenvolvimento', 'homologacao'],
  },
  {
    id: 'paralisado',
    label: 'Paralisado',
    tone: 'bg-orange-400',
    statuses: ['pausado'],
  },
  {
    id: 'nao_iniciado',
    label: 'Não iniciado',
    tone: 'bg-slate-400',
    statuses: ['nao_iniciado', 'backlog'],
  },
  {
    id: 'cancelado',
    label: 'Cancelado',
    tone: 'bg-rose-500',
    statuses: ['cancelado'],
  },
];

/** Em que situação gerencial um status cai. */
export function bucketOf(status: string): ManagementBucket['id'] | null {
  return MANAGEMENT_BUCKETS.find((bucket) => bucket.statuses.includes(status as ProjectStatus))?.id ?? null;
}

/** Rótulo dos oito status, para quem precisa do detalhe por baixo do resumo. */
export function statusLabel(status: string) {
  return PROJECT_STATUS_META[status as ProjectStatus]?.label ?? status;
}

export interface BucketShare extends ManagementBucket {
  total: number;
  /** Percentual sobre o conjunto recebido. Zero quando não há projeto. */
  percent: number;
}

/**
 * Distribuição do conjunto pelas cinco situações.
 *
 * `cancelado` só aparece quando existe — numa reunião, uma fatia zerada de
 * "cancelado" só ocupa espaço. As outras quatro ficam mesmo em zero, porque
 * a ausência delas também diz alguma coisa.
 */
export function buildStatusShare(projects: Pick<ProjectOverview, 'status'>[]): BucketShare[] {
  const total = projects.length;

  return MANAGEMENT_BUCKETS.map((bucket) => {
    const count = projects.filter((project) => bucket.statuses.includes(project.status)).length;
    return { ...bucket, total: count, percent: total ? (count / total) * 100 : 0 };
  }).filter((bucket) => bucket.id !== 'cancelado' || bucket.total > 0);
}

/** Percentual de projetos concluídos no conjunto — o número de abertura. */
export function completionRate(projects: Pick<ProjectOverview, 'status'>[]) {
  if (!projects.length) return 0;
  const done = projects.filter((project) => project.status === 'concluido').length;
  return (done / projects.length) * 100;
}

/* ------------------------------------------------------------------- Áreas */

export const AREA_META: Record<ProjectArea, { label: string; tone: string; text: string }> = {
  agricola: { label: 'Agrícola', tone: 'bg-moreno-green-500', text: 'text-moreno-green-600' },
  administrativo: { label: 'Administrativo', tone: 'bg-moreno-blue-500', text: 'text-moreno-blue-600' },
  industrial: { label: 'Industrial', tone: 'bg-moreno-lime-500', text: 'text-moreno-lime-700' },
};

export const AREA_OPTIONS = (Object.keys(AREA_META) as ProjectArea[]).map((value) => ({
  value,
  label: AREA_META[value].label,
}));

export interface AreaRow {
  id: ProjectArea | 'sem_area';
  label: string;
  tone: string;
  total: number;
  /** Fatia da área no portfólio inteiro. */
  percent: number;
  /** Percentual de concluídos dentro da própria área. */
  completion: number;
  buckets: BucketShare[];
}

/**
 * Matriz área × situação, que é o gráfico gerencial pedido.
 *
 * "Sem área" entra na lista em vez de sumir: projeto sem classificação é
 * trabalho pendente de cadastro, e esconder isso faria os percentuais das
 * outras áreas mentirem.
 */
export function buildAreaMatrix(projects: Pick<ProjectOverview, 'status' | 'area'>[]): AreaRow[] {
  const total = projects.length;

  const rows: AreaRow[] = (Object.keys(AREA_META) as ProjectArea[]).map((area) => {
    const list = projects.filter((project) => project.area === area);
    return {
      id: area,
      label: AREA_META[area].label,
      tone: AREA_META[area].tone,
      total: list.length,
      percent: total ? (list.length / total) * 100 : 0,
      completion: completionRate(list),
      buckets: buildStatusShare(list),
    };
  });

  const semArea = projects.filter((project) => !project.area);
  if (semArea.length) {
    rows.push({
      id: 'sem_area',
      label: 'Sem área',
      tone: 'bg-slate-400',
      total: semArea.length,
      percent: total ? (semArea.length / total) * 100 : 0,
      completion: completionRate(semArea),
      buckets: buildStatusShare(semArea),
    });
  }

  return rows;
}

/* -------------------------------------------------------------- Governança */

export interface GovernanceSlice {
  id: string;
  label: string;
  tone: string;
  total: number;
  percent: number;
}

export interface GovernanceGroup {
  id: 'diretoria' | 'redmine';
  label: string;
  hint: string;
  slices: GovernanceSlice[];
  /** O número de abertura: quanto já está aprovado / já foi lançado. */
  headline: number;
  headlineLabel: string;
}

/**
 * Aprovação da Diretoria e lançamento no Redmine, em percentual.
 *
 * As duas leituras vêm juntas porque respondem à mesma pergunta de reunião:
 * do que está no portfólio, quanto já passou pelo crivo e quanto já foi
 * registrado. Cada grupo soma 100% dentro de si.
 */
export function buildGovernanceShare(
  projects: Pick<ProjectOverview, 'diretoria_aprovacao' | 'redmine_lancado'>[],
): GovernanceGroup[] {
  const total = projects.length;
  const share = (count: number) => (total ? (count / total) * 100 : 0);

  const aprovados = projects.filter((p) => p.diretoria_aprovacao === 'sim').length;
  const reprovados = projects.filter((p) => p.diretoria_aprovacao === 'nao').length;
  const emAprovacao = projects.filter((p) => p.diretoria_aprovacao === 'em_aprovacao').length;

  const noRedmine = projects.filter((p) => p.redmine_lancado).length;
  const foraRedmine = total - noRedmine;

  return [
    {
      id: 'diretoria',
      label: 'Aprovação da Diretoria',
      hint: 'Sobre os projetos do recorte.',
      headline: share(aprovados),
      headlineLabel: 'aprovados',
      slices: [
        { id: 'sim', label: 'Aprovados', tone: 'bg-moreno-green-500', total: aprovados, percent: share(aprovados) },
        {
          id: 'em_aprovacao',
          label: 'Em aprovação',
          tone: 'bg-amber-500',
          total: emAprovacao,
          percent: share(emAprovacao),
        },
        { id: 'nao', label: 'Não aprovados', tone: 'bg-rose-500', total: reprovados, percent: share(reprovados) },
      ],
    },
    {
      id: 'redmine',
      label: 'Lançamento no Redmine',
      hint: 'Quanto já foi registrado lá.',
      headline: share(noRedmine),
      headlineLabel: 'lançados',
      slices: [
        { id: 'sim', label: 'Lançados', tone: 'bg-moreno-blue-500', total: noRedmine, percent: share(noRedmine) },
        {
          id: 'nao',
          label: 'Não lançados',
          tone: 'bg-slate-400',
          total: foraRedmine,
          percent: share(foraRedmine),
        },
      ],
    },
  ];
}
