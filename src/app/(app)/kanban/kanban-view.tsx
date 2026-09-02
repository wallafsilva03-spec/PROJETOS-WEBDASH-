'use client';

import * as React from 'react';
import { startOfDay } from 'date-fns';
import { KanbanSquare } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { PortfolioShare } from '@/components/dashboard/portfolio-share';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StagesKanban } from '@/components/views/stages-kanban';
import { useStages } from '@/hooks/use-project-details';
import { useProjects } from '@/hooks/use-projects';
import { useSession } from '@/hooks/use-session';
import { stageDateBucket } from '@/lib/stage-kanban';
import { cn } from '@/lib/utils';

const ALL = '__all__';

export function KanbanView() {
  const { data: projects } = useProjects({ sort: 'name' });
  const portfolio = React.useMemo(() => projects ?? [], [projects]);
  const { isManager, profile } = useSession();
  const [selected, setSelected] = React.useState(ALL);

  const projectId = selected === ALL ? undefined : selected;
  const { data: stages } = useStages(projectId);

  const options = React.useMemo(
    () => (projects ?? []).map((project) => ({ id: project.id, code: project.code, name: project.name })),
    [projects],
  );

  const canManageProject = React.useCallback(
    (id: string) => isManager || (projects ?? []).some((p) => p.id === id && p.owner_id === profile?.id),
    [isManager, projects, profile?.id],
  );

  const summary = React.useMemo(() => {
    const today = startOfDay(new Date());
    const visible = (stages ?? []).filter((stage) => stage.status !== 'cancelada');
    const bucket = (id: string) => visible.filter((stage) => stageDateBucket(stage, today) === id).length;

    return [
      { label: 'Etapas', value: visible.length, tone: '' },
      { label: 'Atrasadas', value: bucket('atrasada'), tone: 'text-destructive' },
      { label: 'Vencem esta semana', value: bucket('semana'), tone: 'text-warning' },
      { label: 'Concluídas', value: bucket('concluida'), tone: 'text-success' },
    ];
  }, [stages]);

  return (
    <div>
      <PageHeader
        eyebrow="Execução"
        title="Kanban de etapas"
        description="As etapas dos projetos organizadas pela data de término: o que venceu, o que vence nesta semana e o que vem depois. Arraste um card para replanejar a data ou concluir a etapa."
        actions={
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Todos os projetos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os projetos</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.code} · {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/*
        Abre pela leitura gerencial: o quadro abaixo mostra etapas, e a
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

      <StagesKanban
        projectId={projectId}
        canManageProject={canManageProject}
        projectOptions={options}
      />
    </div>
  );
}
