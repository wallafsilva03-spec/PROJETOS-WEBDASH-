'use client';

import * as React from 'react';
import { AlertTriangle, Search, Users, X } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { ExportMenu } from '@/components/projects/export-menu';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useWorkload } from '@/hooks/use-analytics';
import { useDepartments } from '@/hooks/use-catalogs';
import { WORKLOAD_COLUMNS } from '@/lib/report-columns';
import { formatHours, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Valor do item "sem filtro" — o Radix Select não aceita opção com valor vazio. */
const ALL = '__all__';

/** Quem está sem departamento cadastrado no perfil. */
const NO_DEPARTMENT = '__none__';

/** Faixa de ocupação → tom visual. */
function occupancyMeta(percent: number | null) {
  if (percent === null) return { label: 'Sem alocação', tone: 'bg-slate-300', badge: 'secondary' as const };
  if (percent > 110) return { label: 'Sobrecarregado', tone: 'bg-destructive', badge: 'destructive' as const };
  if (percent > 85) return { label: 'No limite', tone: 'bg-warning', badge: 'warning' as const };
  if (percent > 40) return { label: 'Equilibrado', tone: 'bg-success', badge: 'success' as const };
  return { label: 'Disponível', tone: 'bg-moreno-lime-500', badge: 'secondary' as const };
}

export function WorkloadView() {
  const { data, isLoading, isError, refetch } = useWorkload();
  const departments = useDepartments();

  const [departmentId, setDepartmentId] = React.useState<string>(ALL);
  const [search, setSearch] = React.useState('');

  const all = React.useMemo(() => data ?? [], [data]);

  /**
   * Departamentos oferecidos no filtro: os do catálogo que realmente têm
   * gente, mais os que aparecem só no workload (perfil com departamento já
   * desativado no catálogo). Assim o campo nunca esconde uma linha da lista.
   */
  const departmentOptions = React.useMemo(() => {
    const fromRows = new Map<string, string>();
    all.forEach((row) => {
      if (row.department_id) fromRows.set(row.department_id, row.department_name ?? 'Sem nome');
    });

    (departments.data ?? []).forEach((department) => {
      if (fromRows.has(department.id)) fromRows.set(department.id, department.name);
    });

    return [...fromRows].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [all, departments.data]);

  const hasUnassigned = all.some((row) => !row.department_id);

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase();

    return all.filter((row) => {
      if (departmentId === NO_DEPARTMENT && row.department_id) return false;
      if (departmentId !== ALL && departmentId !== NO_DEPARTMENT && row.department_id !== departmentId) return false;
      if (!term) return true;

      return (
        row.full_name.toLowerCase().includes(term) ||
        (row.job_title ?? '').toLowerCase().includes(term) ||
        (row.department_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [all, departmentId, search]);

  const hasFilters = departmentId !== ALL || Boolean(search.trim());

  function clearFilters() {
    setDepartmentId(ALL);
    setSearch('');
  }

  const summary = React.useMemo(() => {
    const capacity = rows.reduce((sum, row) => sum + Number(row.capacidade_semanal), 0);
    const planned = rows.reduce((sum, row) => sum + Number(row.horas_planejadas), 0);
    const overloaded = rows.filter((row) => (row.ocupacao_percentual ?? 0) > 110).length;
    const available = rows.reduce((sum, row) => sum + Number(row.disponibilidade_horas), 0);

    return { capacity, planned, overloaded, available, people: rows.length };
  }, [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Planejamento"
        title="Capacidade da equipe"
        description="Horas planejadas versus capacidade semanal, disponibilidade e sobrecarga por analista."
        actions={
          <ExportMenu
            rows={rows}
            columns={WORKLOAD_COLUMNS}
            filename="workload-equipe"
            title="Capacidade da Equipe"
            subtitle={
              hasFilters
                ? 'Relatório gerado com filtros aplicados.'
                : 'Horas planejadas consideram o esforço restante das tarefas abertas.'
            }
          />
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar analista por nome ou cargo…"
              className="pl-9"
              aria-label="Buscar analista"
            />
          </div>

          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="sm:w-64" aria-label="Filtrar por departamento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os departamentos</SelectItem>
              {departmentOptions.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
              {hasUnassigned && <SelectItem value={NO_DEPARTMENT}>Sem departamento</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {rows.length} de {all.length} analista(s) com os filtros aplicados
            </span>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-3.5" />
              Limpar filtros
            </Button>
          </div>
        )}
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Analistas"
          value={formatNumber(summary.people)}
          icon={Users}
          tone="brand"
          hint={hasFilters ? 'No filtro aplicado' : 'Colaboradores ativos'}
        />
        <KpiCard
          index={1}
          label="Capacidade semanal"
          value={formatHours(summary.capacity)}
          icon={Users}
          tone="lime"
          hint={`${formatHours(summary.planned)} já planejadas`}
          progress={summary.capacity ? (summary.planned / summary.capacity) * 100 : 0}
        />
        <KpiCard
          index={2}
          label="Disponibilidade"
          value={formatHours(summary.available)}
          icon={Users}
          tone="green"
          hint="Horas livres na semana"
        />
        <KpiCard
          index={3}
          label="Sobrecarregados"
          value={formatNumber(summary.overloaded)}
          icon={AlertTriangle}
          tone={summary.overloaded ? 'danger' : 'green'}
          hint="Acima de 110% da capacidade"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alocação por analista</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <SkeletonTable rows={6} />
          ) : !rows.length ? (
            <EmptyState
              icon={Users}
              title={hasFilters ? 'Nenhum analista encontrado' : 'Nenhum colaborador ativo'}
              description={hasFilters ? 'Ajuste o departamento ou a busca para ampliar a lista.' : undefined}
              className="border-0 bg-transparent"
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y">
              {rows.map((row) => {
                const percent = row.ocupacao_percentual;
                const meta = occupancyMeta(percent);

                return (
                  <li key={row.user_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <UserAvatar userId={row.user_id} name={row.full_name} src={row.avatar_url} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.job_title ?? '—'}
                          {row.department_name && ` · ${row.department_name}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {formatHours(row.horas_planejadas)} de {formatHours(row.capacidade_semanal)}
                        </span>
                        <span className="font-semibold">{formatPercent(percent)}</span>
                      </div>
                      <Progress
                        value={Math.min(percent ?? 0, 100)}
                        indicatorClassName={meta.tone}
                        className="h-2"
                      />
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:w-72 sm:justify-end">
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {row.tarefas_abertas} tarefa(s)
                      </span>
                      {row.tarefas_atrasadas > 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          {row.tarefas_atrasadas} atrasada(s)
                        </Badge>
                      )}
                      <span
                        className={cn(
                          'text-xs',
                          row.projetos_atrasados > 0 ? 'font-medium text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {row.projetos_ativos} projeto(s)
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
