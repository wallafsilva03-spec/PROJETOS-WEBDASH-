'use client';

import * as React from 'react';
import { FileSpreadsheet, FolderKanban, ListChecks, Users } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { ExportMenu } from '@/components/projects/export-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/misc';
import { useProjects } from '@/hooks/use-projects';
import { useGantt } from '@/hooks/use-tasks';
import { useWorkload } from '@/hooks/use-analytics';
import { useDepartments } from '@/hooks/use-catalogs';
import { PROJECT_COLUMNS, TASK_COLUMNS, WORKLOAD_COLUMNS } from '@/lib/report-columns';
import { formatNumber } from '@/lib/format';

const ALL = '__all__';

export function RelatoriosView() {
  const departments = useDepartments();
  const [departmentId, setDepartmentId] = React.useState(ALL);
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [hideDoneTasks, setHideDoneTasks] = React.useState(false);

  const projects = useProjects({
    departmentId: departmentId === ALL ? undefined : departmentId,
    includeArchived,
    sort: 'due_date',
  });
  const gantt = useGantt();
  const workload = useWorkload();

  const projectRows = React.useMemo(() => projects.data ?? [], [projects.data]);

  const taskRows = React.useMemo(() => {
    const projectIds = new Set(projectRows.map((project) => project.id));
    let rows = (gantt.data ?? []).filter((task) => projectIds.has(task.project_id));
    if (hideDoneTasks) rows = rows.filter((task) => task.status !== 'concluido');
    return rows;
  }, [gantt.data, projectRows, hideDoneTasks]);

  const workloadRows = workload.data ?? [];

  const reports = [
    {
      icon: FolderKanban,
      title: 'Portfólio de projetos',
      description:
        'Status, saúde, prioridade, execução prevista × realizada, horas, orçamento e riscos de cada projeto.',
      rows: projectRows,
      columns: PROJECT_COLUMNS,
      filename: 'portfolio-projetos',
      reportTitle: 'Portfólio de Projetos',
    },
    {
      icon: ListChecks,
      title: 'Cronograma de tarefas',
      description:
        'Todas as tarefas com datas, duração em dias úteis, percentual concluído, atraso e caminho crítico.',
      rows: taskRows,
      columns: TASK_COLUMNS,
      filename: 'cronograma-tarefas',
      reportTitle: 'Cronograma de Tarefas',
    },
    {
      icon: Users,
      title: 'Capacidade da equipe',
      description: 'Capacidade semanal, horas planejadas e realizadas, ocupação e disponibilidade por pessoa.',
      rows: workloadRows,
      columns: WORKLOAD_COLUMNS,
      filename: 'workload-equipe',
      reportTitle: 'Capacidade da Equipe',
    },
  ] as const;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Direção"
        title="Relatórios"
        description="Exportação em Excel, CSV e PDF com o cabeçalho institucional do Grupo Moreno."
      />

      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="lg:w-72" aria-label="Filtrar por departamento">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os departamentos</SelectItem>
            {departments.data?.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={includeArchived} onCheckedChange={(v) => setIncludeArchived(v === true)} />
          Incluir projetos arquivados
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={hideDoneTasks} onCheckedChange={(v) => setHideDoneTasks(v === true)} />
          Ocultar tarefas concluídas
        </label>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.filename} className="flex flex-col">
            <CardHeader>
              <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-gradient-brand-soft">
                <report.icon className="size-5 text-primary" aria-hidden />
              </span>
              <CardTitle className="text-base">{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between gap-2">
              <Badge variant="secondary">
                <FileSpreadsheet className="size-3" />
                {formatNumber(report.rows.length)} linha(s)
              </Badge>
              <ExportMenu
                rows={report.rows as never[]}
                columns={report.columns as never}
                filename={report.filename}
                title={report.reportTitle}
                subtitle={
                  departmentId === ALL
                    ? 'Todos os departamentos'
                    : departments.data?.find((d) => d.id === departmentId)?.name
                }
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
