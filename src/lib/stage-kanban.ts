import { addDays, differenceInCalendarDays, endOfWeek, format, startOfDay } from 'date-fns';

import { STAGE_STATUS_META, STAGE_STATUS_OPTIONS } from '@/lib/constants';
import { toDate } from '@/lib/format';
import type { ProjectStageView, StageStatus } from '@/types/database';

/** Como o quadro organiza as etapas: pelo prazo (padrão) ou pela situação. */
export type StageGrouping = 'prazo' | 'situacao';

export type StageDateBucket = 'atrasada' | 'semana' | 'proxima' | 'mes' | 'futuro' | 'concluida';

export interface StageColumn {
  id: string;
  label: string;
  /** Texto curto com o intervalo de datas da coluna. */
  hint: string;
  accent: string;
  /** Novo término previsto aplicado à etapa solta nesta coluna. */
  target?: Date;
  /** Situação gravada quando a etapa cai aqui. */
  status?: StageStatus;
  /** Coluna de leitura: o lugar dela é consequência das datas, não um destino. */
  readOnly?: boolean;
}

export function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function short(date: Date) {
  return format(date, 'dd/MM');
}

/**
 * Colunas do kanban por prazo. Tudo é calculado a partir de hoje: a etapa
 * caminha sozinha entre as colunas conforme a data de término se aproxima.
 */
export function stageDateColumns(today: Date = startOfDay(new Date())): StageColumn[] {
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const nextWeekEnd = addDays(weekEnd, 7);
  const monthAhead = addDays(today, 30);

  return [
    {
      id: 'atrasada',
      label: 'Atrasadas',
      hint: `venceram até ${short(addDays(today, -1))}`,
      accent: 'bg-rose-500',
      readOnly: true,
    },
    {
      id: 'semana',
      label: 'Esta semana',
      hint: `${short(today)} a ${short(weekEnd)}`,
      accent: 'bg-amber-500',
      target: weekEnd,
    },
    {
      id: 'proxima',
      label: 'Próxima semana',
      hint: `${short(addDays(weekEnd, 1))} a ${short(nextWeekEnd)}`,
      accent: 'bg-moreno-blue-400',
      target: nextWeekEnd,
    },
    {
      id: 'mes',
      label: 'Próximos 30 dias',
      hint: `${short(addDays(nextWeekEnd, 1))} a ${short(monthAhead)}`,
      accent: 'bg-moreno-lime-500',
      target: monthAhead,
    },
    {
      id: 'futuro',
      label: 'Depois de 30 dias',
      hint: `a partir de ${short(addDays(monthAhead, 1))}`,
      accent: 'bg-slate-400',
      target: addDays(today, 60),
    },
    {
      id: 'concluida',
      label: 'Concluídas',
      hint: 'etapas entregues',
      accent: 'bg-moreno-green-500',
      status: 'concluida',
    },
  ];
}

/** Colunas do kanban por situação — uma para cada valor do enum `stage_status`. */
export function stageStatusColumns(): StageColumn[] {
  return STAGE_STATUS_OPTIONS.map(({ value, label }) => ({
    id: value,
    label,
    hint: STAGE_STATUS_META[value].description,
    accent: STAGE_STATUS_META[value].bar,
    status: value,
  }));
}

/** Em qual coluna de prazo a etapa cai hoje. */
export function stageDateBucket(
  stage: ProjectStageView,
  today: Date = startOfDay(new Date()),
): StageDateBucket {
  if (stage.status === 'concluida') return 'concluida';

  const end = toDate(stage.end_date);
  if (!end) return 'futuro';

  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  if (end < today) return 'atrasada';
  if (end <= weekEnd) return 'semana';
  if (end <= addDays(weekEnd, 7)) return 'proxima';
  if (end <= addDays(today, 30)) return 'mes';
  return 'futuro';
}

/**
 * Datas da etapa depois de arrastada para outra coluna de prazo.
 *
 * A etapa que ainda não começou anda inteira, preservando a duração planejada.
 * A que já está em execução mantém o início — só o término previsto muda,
 * porque replanejar o passado apagaria o histórico de quando ela começou.
 */
export function rescheduleStage(stage: ProjectStageView, target: Date) {
  const start = toDate(stage.start_date);
  const end = toDate(stage.end_date);
  const newEnd = startOfDay(target);

  const started =
    Boolean(stage.actual_start_date) || stage.status === 'em_andamento' || stage.status === 'pausada';

  if (!start || !end) {
    return { start_date: toIsoDate(newEnd), end_date: toIsoDate(newEnd) };
  }

  if (started) {
    // O banco exige término >= início; um alvo no passado encosta no início.
    return {
      start_date: stage.start_date,
      end_date: toIsoDate(newEnd < start ? start : newEnd),
    };
  }

  const duration = Math.max(differenceInCalendarDays(end, start), 0);
  return {
    start_date: toIsoDate(addDays(newEnd, -duration)),
    end_date: toIsoDate(newEnd),
  };
}
