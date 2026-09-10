'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ClipboardList,
  GanttChartSquare,
  History,
  KanbanSquare,
  Layers,
  ListTodo,
  MessageSquare,
  BellRing,
  Paperclip,
  Pencil,
  ShieldAlert,
  Timer,
  Trash2,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProgressWithDelta } from '@/components/ui/progress';
import { Skeleton, SkeletonCards } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { StagesKanban } from '@/components/views/stages-kanban';
import { TasksBoard } from '@/components/views/tasks-board';
import { GanttChart } from '@/components/views/gantt-chart';
import { TimelineView } from '@/components/views/timeline-view';
import { CalendarView, type CalendarEvent } from '@/components/views/calendar-view';
import { BurnCharts } from '@/components/charts/burn-charts';
import { CommentsPanel } from '@/components/projects/comments-panel';
import { ChecklistPanel } from '@/components/projects/checklist-panel';
import { RisksPanel } from '@/components/projects/risks-panel';
import { FilesPanel } from '@/components/projects/files-panel';
import { TeamPanel } from '@/components/projects/team-panel';
import { ProjectFormDialog } from '@/components/projects/project-form-dialog';
import { DeleteProjectDialog } from '@/components/projects/delete-project-dialog';
import { RemindersDialog } from '@/components/projects/reminders-dialog';
import { StagesPanel } from '@/components/projects/stages-panel';
import { TimeCompletionCard, ViabilityCard } from '@/components/projects/viability-card';
import { ExportMenu } from '@/components/projects/export-menu';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { MilestonesPanel } from '@/components/projects/milestones-panel';
import { TimeEntriesPanel } from '@/components/projects/time-entries-panel';
import { useProject } from '@/hooks/use-projects';
import { useGantt, useTasks } from '@/hooks/use-tasks';
import { useMilestones } from '@/hooks/use-project-details';
import { useSession } from '@/hooks/use-session';
import { HEALTH_META, PRIORITY_META, PROJECT_STATUS_META, COMPLEXITY_META } from '@/lib/constants';
import { TASK_COLUMNS } from '@/lib/report-columns';
import {
  formatCompactCurrency,
  formatDate,
  formatDaysLabel,
  formatHours,
  formatPercent,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TaskWithRelations } from '@/types/database';

export function ProjectDetail({ projectId }: { projectId: string }) {
  const { data: project, isLoading, isError, refetch } = useProject(projectId);
  const tasksQuery = useTasks(projectId);
  const ganttQuery = useGantt(projectId);
  const milestonesQuery = useMilestones(projectId);
  const { isAdmin, isManager, profile } = useSession();

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [remindersOpen, setRemindersOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<TaskWithRelations | null>(null);

  /**
   * As abas são controladas para o botão "Anexar arquivo" do cabeçalho poder
   * abrir a de arquivos direto — são catorze abas, e procurar a certa não é
   * trabalho de quem só quer subir um documento.
   */
  const [tab, setTab] = React.useState('kanban');
  const tabsRef = React.useRef<HTMLDivElement>(null);

  function openTab(value: string) {
    setTab(value);
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const tasks = React.useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const canManage = isManager || project?.owner_id === profile?.id;

  const calendarEvents = React.useMemo<CalendarEvent[]>(
    () => [
      ...tasks
        .filter((task) => task.due_date)
        .map((task) => ({
          id: task.id,
          date: task.due_date as string,
          title: task.title,
          subtitle: task.assignee?.full_name,
          status: task.status,
          priority: task.priority,
          onClick: () => setSelectedTask(task),
        })),
      ...(milestonesQuery.data ?? []).map((milestone) => ({
        id: milestone.id,
        date: milestone.due_date,
        title: `🚩 ${milestone.name}`,
        subtitle: 'Marco do projeto',
      })),
    ],
    [tasks, milestonesQuery.data],
  );

  if (isError) {
    return (
      <ErrorState
        title="Projeto não encontrado"
        description="Ele pode ter sido removido ou você não tem permissão de acesso."
        onRetry={() => refetch()}
      />
    );
  }

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <SkeletonCards count={4} />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const status = PROJECT_STATUS_META[project.status];
  const health = HEALTH_META[project.health];
  const priority = PRIORITY_META[project.priority];
  const isFinished = project.status === 'concluido' || project.status === 'cancelado';

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/projetos">
          <ArrowLeft className="size-4" />
          Voltar ao portfólio
        </Link>
      </Button>

      <PageHeader
        eyebrow={`${project.code}${project.department_name ? ` · ${project.department_name}` : ''}`}
        title={project.name}
        description={project.description ?? undefined}
        actions={
          <>
            <ExportMenu
              rows={ganttQuery.data ?? []}
              columns={TASK_COLUMNS}
              filename={`cronograma-${project.code}`}
              title={`Cronograma · ${project.name}`}
              subtitle={`${project.code} — responsável: ${project.owner_name ?? '—'}`}
            />
            <Button variant="outline" onClick={() => openTab('arquivos')}>
              <Paperclip className="size-4" />
              Anexar arquivo
            </Button>
            <Button variant="outline" onClick={() => setRemindersOpen(true)}>
              <BellRing className="size-4" />
              Lembrete
            </Button>
            {canManage && (
              <Button variant="brand" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Editar
              </Button>
            )}
            {/* A RLS só libera o delete para administradores. */}
            {isAdmin && (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                Excluir
              </Button>
            )}
          </>
        }
      />

      {/* Faixa de identificação */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="soft" className={status.className} dot={status.dot}>
          {status.label}
        </Badge>
        {!isFinished && (
          <Badge variant="soft" className={health.className} title={health.description}>
            {health.label}
          </Badge>
        )}
        <Badge variant="soft" className={priority.className} dot={priority.dot}>
          Prioridade {priority.label}
        </Badge>
        <Badge variant="outline">Complexidade {COMPLEXITY_META[project.complexity].label}</Badge>
        {project.category && <Badge variant="outline">{project.category}</Badge>}
        {project.client_name && <Badge variant="outline">Cliente: {project.client_name}</Badge>}
      </div>

      {project.responsibles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Responsáveis
          </span>
          {project.responsibles.map((name) => (
            <Badge key={name} variant="soft" className="bg-gradient-brand-soft">
              {name}
            </Badge>
          ))}
        </div>
      )}

      {/* Inteligência do projeto */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Execução</p>
          <p className="mt-1 font-display text-3xl font-semibold">{formatPercent(project.progress)}</p>
          <ProgressWithDelta
            value={project.progress}
            expected={project.expected_progress}
            className="mt-3"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Previsto {formatPercent(project.expected_progress)} ·{' '}
            <span
              className={cn(
                'font-medium',
                project.progress_delta >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {project.progress_delta > 0 ? '+' : ''}
              {project.progress_delta.toFixed(1)}%
            </span>
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isFinished ? 'Realização' : 'Prazo'}
          </p>
          {/* Encerrado não tem prazo a cobrar: o número que interessa é
              quanto levou, do início real à entrega. */}
          <p className="mt-1 font-display text-3xl font-semibold">
            {isFinished
              ? project.realizacao_dias === null
                ? '—'
                : project.realizacao_dias
              : project.prazo_a_definir
                ? 'A definir'
                : formatDaysLabel(project.days_remaining).split(' ')[0]}
          </p>
          <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <dt>Início</dt>
              <dd className="font-medium text-foreground">
                {formatDate(project.actual_start_date ?? project.start_date)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>{isFinished ? 'Entrega' : 'Prazo final'}</dt>
              <dd className="font-medium text-foreground">
                {!isFinished && project.prazo_a_definir
                  ? 'A definir'
                  : formatDate(isFinished ? (project.actual_end_date ?? project.due_date) : project.due_date)}
              </dd>
            </div>
            {isFinished ? (
              <div className="flex justify-between">
                <dt>Duração</dt>
                <dd className="font-medium text-foreground">
                  {project.realizacao_dias === null ? '—' : `${project.realizacao_dias} dia(s)`}
                </dd>
              </div>
            ) : (
              <div className="flex justify-between">
                <dt>Dias úteis restantes</dt>
                <dd className="font-medium text-foreground">
                  {Math.max(project.business_days_remaining, 0)}
                </dd>
              </div>
            )}
            {!isFinished && project.days_late > 0 && (
              <div className="flex justify-between text-destructive">
                <dt>Atraso</dt>
                <dd className="font-medium">{project.days_late} dia(s)</dd>
              </div>
            )}
          </dl>
        </Card>

        <TimeCompletionCard project={project} />

        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Esforço</p>
          <p className="mt-1 font-display text-3xl font-semibold">{formatHours(project.actual_hours)}</p>
          <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <dt>Estimado (tarefas)</dt>
              <dd className="font-medium text-foreground">{formatHours(project.tasks_estimated_hours)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Planejado (projeto)</dt>
              <dd className="font-medium text-foreground">{formatHours(project.planned_hours)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Eficiência</dt>
              <dd className="font-medium text-foreground">
                {project.efficiency === null ? '—' : formatPercent(project.efficiency)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Escopo</p>
          <p className="mt-1 font-display text-3xl font-semibold">
            {project.done_tasks}/{project.total_tasks}
          </p>
          <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <dt>Tarefas atrasadas</dt>
              <dd className={cn('font-medium', project.late_tasks > 0 ? 'text-destructive' : 'text-foreground')}>
                {project.late_tasks}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Etapas concluídas</dt>
              <dd className="font-medium text-foreground">
                {project.stages_done}/{project.stages_total}
                {project.stages_late > 0 && (
                  <span className="ml-1 font-medium text-destructive">
                    ({project.stages_late} atrasada{project.stages_late > 1 ? 's' : ''})
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Checklist</dt>
              <dd className="font-medium text-foreground">
                {project.checklist_done}/{project.checklist_total}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Riscos abertos</dt>
              <dd className={cn('font-medium', project.open_risks > 0 ? 'text-warning' : 'text-foreground')}>
                {project.open_risks}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Orçamento</dt>
              <dd className="font-medium text-foreground">{formatCompactCurrency(project.budget)}</dd>
            </div>
          </dl>
        </Card>

        <ViabilityCard project={project} />
      </section>

      <Tabs value={tab} onValueChange={setTab} ref={tabsRef}>
        {/*
          As abas quebram linha em vez de rolarem na horizontal. A lista tem
          catorze itens e a barra de rolagem é escondida por estilo, então o
          que passava da largura da tela — Arquivos, Equipe, Comentários —
          simplesmente não existia para quem olhava.
        */}
        <TabsList className="h-auto w-full flex-wrap justify-start overflow-x-visible">
          <TabsTrigger value="kanban">
            <KanbanSquare /> Kanban
          </TabsTrigger>
          <TabsTrigger value="tarefas">
            <ListTodo /> Tarefas
          </TabsTrigger>
          <TabsTrigger value="etapas">
            <Layers /> Etapas
          </TabsTrigger>
          <TabsTrigger value="gantt">
            <GanttChartSquare /> Gantt
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <History /> Timeline
          </TabsTrigger>
          <TabsTrigger value="calendario">
            <CalendarDays /> Calendário
          </TabsTrigger>
          <TabsTrigger value="indicadores">
            <BarChart3 /> Indicadores
          </TabsTrigger>
          <TabsTrigger value="riscos">
            <ShieldAlert /> Riscos
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ClipboardList /> Checklist
          </TabsTrigger>
          <TabsTrigger value="horas">
            <Timer /> Horas
          </TabsTrigger>
          <TabsTrigger value="arquivos">
            <Paperclip /> Arquivos
          </TabsTrigger>
          <TabsTrigger value="equipe">
            <Users /> Equipe
          </TabsTrigger>
          <TabsTrigger value="comentarios">
            <MessageSquare /> Comentários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <StagesKanban
            projectId={projectId}
            canManageProject={() => Boolean(canManage)}
            defaultStart={project.start_date}
            defaultEnd={project.due_date}
          />
        </TabsContent>

        <TabsContent value="tarefas">
          <TasksBoard projectId={projectId} tasks={tasks} isLoading={tasksQuery.isLoading} />
        </TabsContent>

        <TabsContent value="etapas">
          <StagesPanel
            projectId={projectId}
            canManage={Boolean(canManage)}
            projectStart={project.start_date}
            projectDue={project.due_date}
          />
        </TabsContent>

        <TabsContent value="gantt">
          <GanttChart
            tasks={ganttQuery.data ?? []}
            isLoading={ganttQuery.isLoading}
            onSelectTask={(ganttTask) =>
              setSelectedTask(tasks.find((task) => task.id === ganttTask.id) ?? null)
            }
          />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineView
            tasks={tasks}
            milestones={milestonesQuery.data ?? []}
            isLoading={tasksQuery.isLoading}
            onSelectTask={setSelectedTask}
          />
        </TabsContent>

        <TabsContent value="calendario">
          <CalendarView events={calendarEvents} isLoading={tasksQuery.isLoading} />
        </TabsContent>

        <TabsContent value="indicadores">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <BurnCharts projectId={projectId} />
            </div>
            <MilestonesPanel projectId={projectId} canManage={Boolean(canManage)} />
            <ActivityFeed projectId={projectId} limit={12} />
          </div>
        </TabsContent>

        <TabsContent value="riscos">
          <RisksPanel projectId={projectId} />
        </TabsContent>

        <TabsContent value="checklist">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklist do projeto</CardTitle>
            </CardHeader>
            <CardContent>
              <ChecklistPanel projectId={projectId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="horas">
          <TimeEntriesPanel projectId={projectId} tasks={tasks} />
        </TabsContent>

        <TabsContent value="arquivos">
          <FilesPanel projectId={projectId} />
        </TabsContent>

        <TabsContent value="equipe">
          <div className="grid gap-4 lg:grid-cols-2">
            <TeamPanel projectId={projectId} canManage={Boolean(canManage)} />
            <ActivityFeed projectId={projectId} limit={10} />
          </div>
        </TabsContent>

        <TabsContent value="comentarios">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discussão do projeto</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentsPanel projectId={projectId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} />

      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        project={{ id: project.id, code: project.code, name: project.name }}
        redirectTo="/projetos"
      />

      <RemindersDialog
        open={remindersOpen}
        onOpenChange={setRemindersOpen}
        projectId={projectId}
        projectName={project.name}
      />

      <TaskDialog
        projectId={projectId}
        open={Boolean(selectedTask)}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        task={selectedTask}
      />
    </div>
  );
}
