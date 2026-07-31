'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { GanttChart } from '@/components/views/gantt-chart';
import { ExportMenu } from '@/components/projects/export-menu';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/misc';
import { useGantt } from '@/hooks/use-tasks';
import { useProjects } from '@/hooks/use-projects';
import { TASK_COLUMNS } from '@/lib/report-columns';

const ALL = '__all__';

export function CronogramaView() {
  const router = useRouter();
  const projects = useProjects({ sort: 'due_date' });
  const [projectId, setProjectId] = React.useState<string>(ALL);
  const [onlyCritical, setOnlyCritical] = React.useState(false);
  const [hideDone, setHideDone] = React.useState(false);

  const gantt = useGantt(projectId === ALL ? undefined : projectId);

  const tasks = React.useMemo(() => {
    let list = gantt.data ?? [];
    if (onlyCritical) list = list.filter((task) => task.caminho_critico);
    if (hideDone) list = list.filter((task) => task.status !== 'concluido');
    return list;
  }, [gantt.data, onlyCritical, hideDone]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Planejamento"
        title="Cronograma consolidado"
        description="Gantt de todo o portfólio. Alterar datas recalcula automaticamente as tarefas dependentes."
        actions={
          <ExportMenu
            rows={tasks}
            columns={TASK_COLUMNS}
            filename="cronograma-consolidado"
            title="Cronograma Consolidado"
            subtitle="Inclui duração em dias úteis, atraso e caminho crítico."
          />
        }
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
          <Checkbox checked={onlyCritical} onCheckedChange={(v) => setOnlyCritical(v === true)} />
          Apenas caminho crítico
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={hideDone} onCheckedChange={(v) => setHideDone(v === true)} />
          Ocultar concluídas
        </label>
      </Card>

      <GanttChart
        tasks={tasks}
        isLoading={gantt.isLoading}
        showProject={projectId === ALL}
        onSelectTask={(task) => router.push(`/projetos/${task.project_id}`)}
      />
    </div>
  );
}
