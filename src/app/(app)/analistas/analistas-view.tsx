'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Search,
  Timer,
  UserCog,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ExportMenu } from '@/components/projects/export-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { UserAvatar } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/misc';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useProjects } from '@/hooks/use-projects';
import { useDepartments, useProfiles } from '@/hooks/use-catalogs';
import { useDebouncedValue } from '@/hooks/use-search';
import { HEALTH_META, PROJECT_STATUS_META, PROJECT_STATUS_OPTIONS, ROLE_META } from '@/lib/constants';
import { ANALYST_COLUMNS } from '@/lib/report-columns';
import { buildAnalystSummaries, UNASSIGNED, type AnalystSummary } from '@/lib/analyst-overview';
import {
  ALL,
  isLate,
  portfolioHref,
  statusList,
  type StatusFilter,
} from '@/lib/project-filters';
import { formatDate, formatHours, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/types/database';

/** Linha de um analista — recolhida por padrão, expandida para ver projetos. */
function AnalystRow({ analyst, departmentId }: { analyst: AnalystSummary; departmentId: string }) {
  const [open, setOpen] = React.useState(false);
  const late = analyst.atrasados > 0;

  return (
    <li className={cn('border-b last:border-b-0', late && 'bg-destructive/[0.03]')}>
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
            aria-hidden
          />
          <UserAvatar userId={analyst.profileId ?? undefined} name={analyst.name} src={analyst.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{analyst.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {analyst.jobTitle ?? (analyst.role ? ROLE_META[analyst.role].label : 'Área ou pessoa sem login')}
              {analyst.proximoPrazo && ` · próximo prazo ${formatDate(analyst.proximoPrazo)}`}
            </p>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 lg:w-[34rem] lg:shrink-0">
          <div>
            <p className="text-muted-foreground">Projetos</p>
            <p className="font-display text-lg font-semibold">{analyst.total}</p>
            <p className="text-[11px] text-muted-foreground">{analyst.ativos} em aberto</p>
          </div>
          <div>
            <p className="text-muted-foreground">Em atraso</p>
            <p className={cn('font-display text-lg font-semibold', late && 'text-destructive')}>
              {analyst.atrasados}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {analyst.maiorAtraso ? `pior: ${analyst.maiorAtraso} dia(s)` : 'nenhum vencido'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Execução média</p>
            <div className="flex items-center gap-2">
              <Progress value={analyst.progressoMedio} className="h-1.5" />
              <span className="w-9 shrink-0 text-right font-semibold">
                {formatPercent(analyst.progressoMedio)}
              </span>
            </div>
            <p
              className={cn(
                'text-[11px]',
                analyst.desvioMedio < 0 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {analyst.desvioMedio >= 0 ? '+' : ''}
              {analyst.desvioMedio.toFixed(1)} p.p. vs. previsto
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Horas</p>
            <p className="font-display text-lg font-semibold">{formatHours(analyst.horasRealizadas)}</p>
            <p className="text-[11px] text-muted-foreground">
              de {formatHours(analyst.horasPlanejadas)} estimadas
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" asChild className="lg:shrink-0">
          <Link href={portfolioHref({ responsavel: analyst.name, depto: departmentId })}>
            <ExternalLink className="size-3.5" />
            No portfólio
          </Link>
        </Button>
      </div>

      {/* Todos os status do analista, sempre visíveis: é a leitura de gestão. */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-4">
        {PROJECT_STATUS_OPTIONS.filter((option) => analyst.byStatus[option.value]).map((option) => {
          const meta = PROJECT_STATUS_META[option.value];
          return (
            <Badge key={option.value} variant="soft" className={cn('text-[10px]', meta.className)} dot={meta.dot}>
              {option.label}: {analyst.byStatus[option.value]}
            </Badge>
          );
        })}
        {analyst.total === 0 && (
          <span className="text-xs text-muted-foreground">Sem projeto sob responsabilidade.</span>
        )}
      </div>

      {open && analyst.total > 0 && (
        <div className="overflow-x-auto border-t bg-secondary/30">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">Projeto</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
                <th scope="col" className="px-4 py-2 font-medium">Saúde</th>
                <th scope="col" className="px-4 py-2 font-medium">Prazo</th>
                <th scope="col" className="px-4 py-2 font-medium">Tempo</th>
                <th scope="col" className="w-40 px-4 py-2 font-medium">Execução</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {analyst.projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-2">
                    <Link href={`/projetos/${project.id}`} className="group block">
                      <span className="font-mono text-[11px] text-muted-foreground">{project.code}</span>
                      <span className="block font-medium group-hover:text-primary">{project.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      variant="soft"
                      className={cn('text-[10px]', PROJECT_STATUS_META[project.status].className)}
                      dot={PROJECT_STATUS_META[project.status].dot}
                    >
                      {PROJECT_STATUS_META[project.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      variant="soft"
                      className={cn('text-[10px]', HEALTH_META[project.health].className)}
                    >
                      {HEALTH_META[project.health].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatDate(project.due_date)}</td>
                  <td
                    className={cn(
                      'whitespace-nowrap px-4 py-2 text-xs',
                      isLate(project) ? 'font-medium text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {project.days_late > 0
                      ? `${project.days_late} dia(s) de atraso`
                      : project.status === 'concluido'
                        ? 'entregue'
                        : `${project.days_remaining} dia(s) restantes`}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Progress value={project.progress} className="h-1.5" />
                      <span className="w-9 shrink-0 text-right text-xs font-semibold">
                        {formatPercent(project.progress)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

export function AnalistasView() {
  const projects = useProjects({ sort: 'due_date' });
  const profiles = useProfiles();
  const departments = useDepartments();

  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<StatusFilter>(ALL);
  const [departmentId, setDepartmentId] = React.useState<string>(ALL);
  const [onlyLate, setOnlyLate] = React.useState(false);
  const [showIdle, setShowIdle] = React.useState(true);

  const debouncedSearch = useDebouncedValue(search, 250);

  /**
   * Status e departamento recortam os **projetos** antes do agrupamento, e não
   * a lista de analistas depois dele. É o que faz "departamento X" responder
   * "como cada responsável está indo dentro do departamento X" — os números da
   * linha passam a contar só os projetos daquele setor.
   */
  const filtered = React.useMemo(() => {
    const allowed = statusList(status);

    return (projects.data ?? []).filter((project) => {
      if (allowed && !allowed.includes(project.status as ProjectStatus)) return false;
      if (departmentId !== ALL && project.department_id !== departmentId) return false;
      return true;
    });
  }, [projects.data, status, departmentId]);

  const analysts = React.useMemo(
    () => buildAnalystSummaries(filtered, profiles.data ?? []),
    [filtered, profiles.data],
  );

  const visible = React.useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return analysts.filter((analyst) => {
      if (term && !analyst.name.toLowerCase().includes(term)) return false;
      if (onlyLate && analyst.atrasados === 0) return false;
      if (!showIdle && analyst.total === 0) return false;
      return true;
    });
  }, [analysts, debouncedSearch, onlyLate, showIdle]);

  const summary = React.useMemo(() => {
    const comProjeto = analysts.filter((analyst) => analyst.total > 0);
    const comAtraso = analysts.filter((analyst) => analyst.atrasados > 0);
    const semResponsavel = analysts.find((analyst) => analyst.name === UNASSIGNED);

    return {
      pessoas: comProjeto.length,
      comAtraso: comAtraso.length,
      projetosAtrasados: filtered.filter(isLate).length,
      semResponsavel: semResponsavel?.total ?? 0,
    };
  }, [analysts, filtered]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administração"
        title="Gestão por analista"
        description="Quem responde por cada projeto, em que status ele está e quanto tempo já passou do prazo. Um projeto com mais de um responsável aparece na conta de cada um."
        actions={
          <ExportMenu
            rows={visible}
            columns={ANALYST_COLUMNS}
            filename="gestao-por-analista"
            title="Gestão por analista"
            subtitle="Projetos, prazos e atrasos por responsável."
          />
        }
      />

      <section aria-label="Resumo da gestão" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Responsáveis com projeto"
          value={formatNumber(summary.pessoas)}
          icon={Users}
          tone="brand"
          hint="Pessoas e áreas com carga hoje"
        />
        <KpiCard
          index={1}
          label="Com projeto em atraso"
          value={formatNumber(summary.comAtraso)}
          icon={AlertTriangle}
          tone={summary.comAtraso ? 'danger' : 'green'}
          hint="Responsáveis a cobrar"
        />
        <KpiCard
          index={2}
          label="Projetos em atraso"
          value={formatNumber(summary.projetosAtrasados)}
          icon={Timer}
          tone={summary.projetosAtrasados ? 'danger' : 'green'}
          hint="Atrasados e críticos no portfólio"
          href={portfolioHref({ saude: 'em_atraso', depto: departmentId })}
        />
        <KpiCard
          index={3}
          label="Sem responsável"
          value={formatNumber(summary.semResponsavel)}
          icon={UserCog}
          tone={summary.semResponsavel ? 'warning' : 'green'}
          hint="Projetos sem dono nem responsável"
        />
      </section>

      <Card>
        <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Acompanhamento individual</CardTitle>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar analista…"
                className="pl-9 sm:w-56"
                aria-label="Buscar analista"
              />
            </div>

            <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
              <SelectTrigger className="sm:w-48" aria-label="Filtrar por status do projeto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                <SelectItem value="ativos">Em andamento</SelectItem>
                <SelectItem value="encerrados">Encerrados</SelectItem>
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="sm:w-52" aria-label="Filtrar por departamento">
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
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={onlyLate} onCheckedChange={setOnlyLate} />
              Somente quem tem atraso
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={showIdle} onCheckedChange={setShowIdle} />
              Mostrar quem está sem projeto
            </label>
            <span className="text-xs text-muted-foreground">{visible.length} responsável(is)</span>
          </div>

          {projects.isError ? (
            <ErrorState onRetry={() => projects.refetch()} />
          ) : projects.isLoading ? (
            <SkeletonTable rows={6} />
          ) : !visible.length ? (
            <EmptyState
              icon={UserCog}
              title="Nenhum responsável encontrado"
              description="Ajuste os filtros ou cadastre responsáveis nos projetos."
              className="border-0 bg-transparent"
            />
          ) : (
            <ul className="-mx-6 divide-y border-y">
              {visible.map((analyst) => (
                <AnalystRow key={analyst.key} analyst={analyst} departmentId={departmentId} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
