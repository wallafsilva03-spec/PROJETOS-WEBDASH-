'use client';

import * as React from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuditLog } from '@/hooks/use-analytics';
import { useProjects } from '@/hooks/use-projects';
import { useSession } from '@/hooks/use-session';
import { formatDateTime } from '@/lib/format';
import { History } from 'lucide-react';

const ALL = '__all__';

const AUDIT_TABLES = [
  { value: ALL, label: 'Todas as entidades' },
  { value: 'projects', label: 'Projetos' },
  { value: 'tasks', label: 'Tarefas' },
  { value: 'risks', label: 'Riscos' },
  { value: 'milestones', label: 'Marcos' },
  { value: 'time_entries', label: 'Apontamentos' },
  { value: 'project_members', label: 'Equipe' },
  { value: 'profiles', label: 'Perfis' },
];

export function AtividadesView() {
  const { isManager } = useSession();
  const projects = useProjects({ sort: 'created_at' });
  const [projectId, setProjectId] = React.useState(ALL);
  const [auditTable, setAuditTable] = React.useState(ALL);

  const audit = useAuditLog({ table: auditTable === ALL ? undefined : auditTable, limit: 60 });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Visão geral"
        title="Centro de atividades"
        description="Tudo o que a equipe está fazendo, atualizado em tempo real, mais a trilha de auditoria."
      />

      <Card className="p-4">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="sm:w-80" aria-label="Filtrar atividades por projeto">
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
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityFeed projectId={projectId === ALL ? undefined : projectId} limit={30} />

        {isManager && (
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-primary" aria-hidden />
                Trilha de auditoria
              </CardTitle>
              <Select value={auditTable} onValueChange={setAuditTable}>
                <SelectTrigger className="h-9 w-52" aria-label="Filtrar auditoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIT_TABLES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>

            <CardContent>
              {audit.isLoading ? (
                <SkeletonTable rows={6} />
              ) : !audit.data?.length ? (
                <EmptyState
                  icon={History}
                  title="Sem registros de auditoria"
                  description="Toda alteração em projetos, tarefas e riscos é registrada aqui."
                  className="border-0 bg-transparent"
                />
              ) : (
                <ul className="max-h-[32rem] divide-y overflow-y-auto scrollbar-thin">
                  {audit.data.map((entry) => (
                    <li key={entry.id} className="flex gap-3 py-3">
                      <UserAvatar
                        userId={entry.actor_id}
                        name={entry.actor?.full_name}
                        className="size-8 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm">
                          <span className="font-medium">{entry.actor?.full_name ?? 'Sistema'}</span>
                          <Badge
                            variant={
                              entry.action === 'DELETE'
                                ? 'destructive'
                                : entry.action === 'INSERT'
                                  ? 'success'
                                  : 'secondary'
                            }
                            className="text-[10px]"
                          >
                            {entry.action}
                          </Badge>
                          <span className="text-muted-foreground">{entry.table_name}</span>
                        </p>
                        {entry.changed_fields?.length ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Campos alterados: {entry.changed_fields.join(', ')}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
