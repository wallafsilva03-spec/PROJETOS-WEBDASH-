'use client';

import * as React from 'react';
import { addDays, startOfDay } from 'date-fns';
import { KanbanSquare, Layers, ListTodo, Search, X } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { PortfolioShare } from '@/components/dashboard/portfolio-share';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { Combobox } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KanbanBoard } from '@/components/views/kanban-board';
import { StagesKanban } from '@/components/views/stages-kanban';
import { useStages } from '@/hooks/use-project-details';
import { useProjects } from '@/hooks/use-projects';
import { useSession } from '@/hooks/use-session';
import { useTasks } from '@/hooks/use-tasks';
import { stageDateBucket } from '@/lib/stage-kanban';
import { isLateTask, type TaskGroupKey } from '@/lib/task-grouping';
import { cn } from '@/lib/utils';
import type { TaskWithRelations } from '@/types/database';

const ALL = '__all__';

type BoardMode = 'etapas' | 'tarefas';

const MODES: { id: BoardMode; label: string; icon: typeof Layers }[] = [
  { id: 'etapas', label: 'Etapas', icon: Layers },
  { id: 'tarefas', label: 'Tarefas', icon: ListTodo },
];

/** Ignora acento e caixa — quem digita "producao" acha "Produção". */
function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function KanbanView() {
  const { data: projects } = useProjects({ sort: 'name' });
  const portfolio = React.useMemo(() => projects ?? [], [projects]);
  const { isManager, profile } = useSession();

  const [mode, setMode] = React.useState<BoardMode>('etapas');
  const [selected, setSelected] = React.useState(ALL);
  const [term, setTerm] = React.useState('');
  const [groupKey, setGroupKey] = React.useState<TaskGroupKey>('status');
  const [includeSubtasks, setIncludeSubtasks] = React.useState(false);

  const projectId = selected === ALL ? undefined : selected;
  const { data: stages } = useStages(projectId);
  const tasksQuery = useTasks(projectId);

  const options = React.useMemo(
    () => (projects ?? []).map((project) => ({ id: project.id, code: project.code, name: project.name })),
    [projects],
  );

  const comboOptions = React.useMemo(
    () => [
      { value: ALL, label: 'Todos os projetos' },
      ...options.map((option) => ({ value: option.id, label: option.name, hint: option.code })),
    ],
    [options],
  );

  const canManageProject = React.useCallback(
    (id: string) => isManager || (projects ?? []).some((p) => p.id === id && p.owner_id === profile?.id),
    [isManager, projects, profile?.id],
  );

  /**
   * Busca por digitação nos cards. Uma subtarefa que casa com o termo puxa a
   * tarefa mãe junto — sem isso ela apareceria solta, sem contexto nenhum.
   */
  const tasks = React.useMemo(() => {
    const all = tasksQuery.data ?? [];
    const needle = normalize(term.trim());
    if (!needle) return all;

    const matches = (task: TaskWithRelations) =>
      normalize(
        [
          task.title,
          task.description ?? '',
          task.project?.code ?? '',
          task.project?.name ?? '',
          task.assignee?.full_name ?? '',
        ].join(' '),
      ).includes(needle);

    const keep = new Set<string>();
    for (const task of all) {
      if (!matches(task)) continue;
      keep.add(task.id);
      if (task.parent_task_id) keep.add(task.parent_task_id);
    }

    return all.filter((task) => keep.has(task.id));
  }, [tasksQuery.data, term]);

  const summary = React.useMemo(() => {
    const today = startOfDay(new Date());

    if (mode === 'tarefas') {
      const visible = tasks;
      const weekEnd = addDays(today, 7);
      const vencemNaSemana = visible.filter((task) => {
        if (!task.due_date || task.status === 'concluido') return false;
        const due = startOfDay(new Date(task.due_date));
        return due >= today && due <= weekEnd;
      }).length;

      return [
        { label: 'Tarefas', value: visible.length, tone: '' },
        { label: 'Atrasadas', value: visible.filter(isLateTask).length, tone: 'text-destructive' },
        { label: 'Vencem esta semana', value: vencemNaSemana, tone: 'text-warning' },
        {
          label: 'Concluídas',
          value: visible.filter((task) => task.status === 'concluido').length,
          tone: 'text-success',
        },
      ];
    }

    const visible = (stages ?? []).filter((stage) => stage.status !== 'cancelada');
    const bucket = (id: string) => visible.filter((stage) => stageDateBucket(stage, today) === id).length;

    return [
      { label: 'Etapas', value: visible.length, tone: '' },
      { label: 'Atrasadas', value: bucket('atrasada'), tone: 'text-destructive' },
      { label: 'Vencem esta semana', value: bucket('semana'), tone: 'text-warning' },
      { label: 'Concluídas', value: bucket('concluida'), tone: 'text-success' },
    ];
  }, [mode, stages, tasks]);

  return (
    <div>
      <PageHeader
        eyebrow="Execução"
        title={mode === 'tarefas' ? 'Kanban de tarefas' : 'Kanban de etapas'}
        description={
          mode === 'tarefas'
            ? 'As tarefas de todos os projetos em um quadro só. Filtre o projeto pelo nome, busque pelo título e arraste o card para mudar de coluna.'
            : 'As etapas dos projetos organizadas pela data de término: o que venceu, o que vence nesta semana e o que vem depois. Arraste um card para replanejar a data ou concluir a etapa.'
        }
      />

      <section className="mb-6 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-secondary/40 p-0.5" role="tablist" aria-label="Quadro">
          {MODES.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMode(item.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>

        <Combobox
          options={comboOptions}
          value={selected}
          onChange={setSelected}
          className="w-64"
          ariaLabel="Filtrar por projeto"
          placeholder="Todos os projetos"
          searchPlaceholder="Digite o nome ou o código…"
          emptyMessage="Nenhum projeto com esse nome."
        />

        {mode === 'tarefas' && (
          <>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Buscar tarefa…"
                aria-label="Buscar tarefa"
                className="px-9"
              />
              {term && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setTerm('')}
                  aria-label="Limpar busca"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>

            <Select value={groupKey} onValueChange={(value) => setGroupKey(value as TaskGroupKey)}>
              <SelectTrigger className="w-52" aria-label="Agrupar por">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Agrupar por status</SelectItem>
                <SelectItem value="priority">Agrupar por prioridade</SelectItem>
                <SelectItem value="assignee">Agrupar por responsável</SelectItem>
                <SelectItem value="parent">Agrupar por tarefa principal</SelectItem>
                <SelectItem value="none">Sem agrupamento</SelectItem>
              </SelectContent>
            </Select>

            <label
              className={cn(
                'flex cursor-pointer items-center gap-2 text-sm text-muted-foreground',
                groupKey === 'parent' && 'hidden',
              )}
            >
              <Checkbox
                checked={includeSubtasks}
                onCheckedChange={(checked) => setIncludeSubtasks(checked === true)}
              />
              Subtarefas como cards separados
            </label>
          </>
        )}
      </section>

      {/*
        Abre pela leitura gerencial: o quadro abaixo mostra a execução, e a
        Diretoria pergunta primeiro pelo portfólio inteiro, em percentual.
      */}
      <PortfolioShare
        projects={portfolio}
        className="mb-6"
        description="Situação de todos os projetos, sobre o total do portfólio."
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label} className="flex items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-brand-soft">
              <KanbanSquare className="size-4 text-primary" aria-hidden />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={cn('font-display text-xl font-semibold', item.tone)}>{item.value}</p>
            </div>
          </Card>
        ))}
      </section>

      {mode === 'tarefas' ? (
        <>
          <KanbanBoard
            projectId={projectId}
            tasks={tasks}
            isLoading={tasksQuery.isLoading}
            groupKey={groupKey}
            includeSubtasks={includeSubtasks}
          />
          {!projectId && (
            <p className="mt-3 text-xs text-muted-foreground">
              Escolha um projeto acima para poder criar tarefas direto na coluna.
            </p>
          )}
        </>
      ) : (
        <StagesKanban projectId={projectId} canManageProject={canManageProject} projectOptions={options} />
      )}
    </div>
  );
}
