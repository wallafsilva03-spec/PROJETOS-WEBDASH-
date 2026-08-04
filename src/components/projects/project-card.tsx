'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Clock, Layers, ShieldAlert, TrendingUp, Users } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressWithDelta } from '@/components/ui/progress';
import { Hint } from '@/components/ui/misc';
import { HEALTH_META, PRIORITY_META, PROJECT_STATUS_META, VIABILITY_META } from '@/lib/constants';
import { formatDate, formatDaysLabel, formatDelta, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectOverview } from '@/types/database';

export function ProjectCard({ project, index = 0 }: { project: ProjectOverview; index?: number }) {
  const status = PROJECT_STATUS_META[project.status];
  const health = HEALTH_META[project.health];
  const priority = PRIORITY_META[project.priority];
  const isFinished = project.status === 'concluido' || project.status === 'cancelado';
  const viability = VIABILITY_META[project.viability] ?? VIABILITY_META.sem_dados;
  const hasReturn = project.expected_return > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.2) }}
    >
      <Card className="group relative h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
        <span
          className={cn('absolute inset-y-0 left-0 w-1', health.dot)}
          aria-hidden
          title={health.description}
        />

        <Link href={`/projetos/${project.id}`} className="block p-5 pl-6 focus-visible:outline-none">
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {project.code}
                {project.department_name && ` · ${project.department_name}`}
              </p>
              <h3 className="mt-0.5 line-clamp-2 font-semibold leading-snug transition-colors group-hover:text-primary">
                {project.name}
              </h3>
            </div>
            <Badge variant="soft" className={priority.className} dot={priority.dot}>
              {priority.label}
            </Badge>
          </header>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge variant="soft" className={status.className} dot={status.dot}>
              {status.label}
            </Badge>
            {!isFinished && (
              <Badge variant="soft" className={health.className}>
                {health.label}
              </Badge>
            )}
            {project.open_risks > 0 && (
              <Hint label={`${project.open_risks} risco(s) em aberto`}>
                <Badge variant="soft" className="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
                  <ShieldAlert className="size-3" />
                  {project.open_risks}
                </Badge>
              </Hint>
            )}
            {hasReturn && (
              <Hint label={`${viability.label} — ${viability.description}`}>
                <Badge variant="soft" className={viability.className}>
                  <TrendingUp className="size-3" />
                  ROI {formatDelta(project.roi_percent)}
                </Badge>
              </Hint>
            )}
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">
                Executado
                {project.expected_progress > 0 && (
                  <span className="ml-1 opacity-70">
                    (previsto {formatPercent(project.expected_progress)})
                  </span>
                )}
              </span>
              <span className="font-semibold">{formatPercent(project.progress)}</span>
            </div>
            <ProgressWithDelta value={project.progress} expected={project.expected_progress} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden />
              <dt className="sr-only">Prazo final</dt>
              <dd>{formatDate(project.due_date)}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <dt className="sr-only">Situação do prazo</dt>
              <dd className={cn(project.days_remaining < 0 && !isFinished && 'font-medium text-destructive')}>
                {isFinished ? 'Encerrado' : formatDaysLabel(project.days_remaining)}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
              <dt className="sr-only">Tarefas</dt>
              <dd>
                {project.done_tasks}/{project.total_tasks} tarefas
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5 shrink-0" aria-hidden />
              <dt className="sr-only">Equipe</dt>
              <dd className="truncate">{project.owner_name ?? 'Sem responsável'}</dd>
            </div>
            {project.stages_total > 0 && (
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 shrink-0" aria-hidden />
                <dt className="sr-only">Etapas</dt>
                <dd className={cn(project.stages_late > 0 && 'font-medium text-destructive')}>
                  {project.stages_done}/{project.stages_total} etapas
                </dd>
              </div>
            )}
          </dl>
        </Link>
      </Card>
    </motion.article>
  );
}
