'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { CalendarView, type CalendarEvent } from '@/components/views/calendar-view';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGantt } from '@/hooks/use-tasks';
import { useProjects } from '@/hooks/use-projects';
import { useSession } from '@/hooks/use-session';

const ALL = '__all__';

export function CalendarioView() {
  const router = useRouter();
  const { profile } = useSession();
  const projects = useProjects({ sort: 'due_date' });
  const gantt = useGantt();

  const [projectId, setProjectId] = React.useState(ALL);
  const [onlyMine, setOnlyMine] = React.useState(false);

  const events = React.useMemo<CalendarEvent[]>(() => {
    let tasks = gantt.data ?? [];
    if (projectId !== ALL) tasks = tasks.filter((task) => task.project_id === projectId);
    if (onlyMine && profile) tasks = tasks.filter((task) => task.assignee_id === profile.id);

    const taskEvents = tasks
      .filter((task) => task.due_date)
      .map<CalendarEvent>((task) => ({
        id: `task-${task.id}`,
        date: task.due_date as string,
        title: task.title,
        subtitle: `${task.project_code} · ${task.assignee_name ?? 'Sem responsável'}`,
        status: task.status,
        priority: task.priority,
        onClick: () => router.push(`/projetos/${task.project_id}`),
      }));

    const projectDeadlines = (projects.data ?? [])
      .filter((project) => projectId === ALL || project.id === projectId)
      .map<CalendarEvent>((project) => ({
        id: `project-${project.id}`,
        date: project.due_date,
        title: `🏁 ${project.name}`,
        subtitle: 'Prazo final do projeto',
        onClick: () => router.push(`/projetos/${project.id}`),
      }));

    return [...taskEvents, ...projectDeadlines];
  }, [gantt.data, projects.data, projectId, onlyMine, profile, router]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Planejamento"
        title="Calendário"
        description="Prazos de tarefas e projetos nas visões diária, semanal e mensal."
      />

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="sm:w-80" aria-label="Filtrar por projeto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os projetos</SelectItem>
            {projects.data?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.code} · {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={onlyMine} onCheckedChange={(value) => setOnlyMine(value === true)} />
          Somente minhas tarefas
        </label>

        <span className="text-xs text-muted-foreground sm:ml-auto">{events.length} evento(s)</span>
      </Card>

      <CalendarView events={events} isLoading={gantt.isLoading} />
    </div>
  );
}
