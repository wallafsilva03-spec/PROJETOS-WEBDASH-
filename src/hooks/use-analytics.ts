'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { isSchemaOutdated } from '@/lib/supabase/errors';
import { qk } from '@/lib/query-keys';
import { useRealtime } from '@/hooks/use-realtime';
import type {
  ActivityFeedItem,
  AuditLogEntry,
  BurnPoint,
  DashboardKpis,
  ExecFinancialRow,
  FlowMetrics,
  GroupCount,
  RiskHeatCell,
  RoadmapRow,
  WorkloadRow,
} from '@/types/database';

/** KPIs consolidados do dashboard inicial. */
export function useDashboardKpis() {
  const query = useQuery({
    queryKey: qk.kpis,
    staleTime: 30_000,
    queryFn: async (): Promise<DashboardKpis> => {
      const { data, error } = await createClient().from('v_dashboard_kpis').select('*').single();
      if (error) throw error;
      return data as DashboardKpis;
    },
  });

  useRealtime(
    'dashboard-kpis',
    [{ table: 'projects' }, { table: 'tasks' }, { table: 'time_entries' }, { table: 'user_presence' }],
    [qk.kpis],
  );

  return query;
}

export function useActivityFeed(projectId?: string, limit = 25) {
  const query = useQuery({
    queryKey: qk.activity(projectId),
    queryFn: async (): Promise<ActivityFeedItem[]> => {
      let request = createClient().from('v_activity_feed').select('*');
      if (projectId) request = request.eq('project_id', projectId);

      const { data, error } = await request.limit(limit);
      if (error) throw error;
      return data as ActivityFeedItem[];
    },
  });

  useRealtime(
    `activity-${projectId ?? 'global'}`,
    [{ table: 'activity_log', ...(projectId ? { filter: `project_id=eq.${projectId}` } : {}) }],
    [qk.activity(projectId)],
  );

  return query;
}

export function useWorkload() {
  return useQuery({
    queryKey: qk.workload,
    queryFn: async (): Promise<WorkloadRow[]> => {
      const { data, error } = await createClient()
        .from('v_workload')
        .select('*')
        .order('ocupacao_percentual', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as WorkloadRow[];
    },
  });
}

export interface ExecutiveData {
  byStatus: GroupCount[];
  byDepartment: GroupCount[];
  byPriority: GroupCount[];
  byManager: GroupCount[];
  health: GroupCount[];
  flow: FlowMetrics | null;
  /** Retorno financeiro consolidado por departamento. */
  financials: ExecFinancialRow[];
}

/** Todas as agregações do Dashboard Executivo em uma única rodada. */
export function useExecutiveData() {
  return useQuery({
    queryKey: qk.executive,
    staleTime: 60_000,
    queryFn: async (): Promise<ExecutiveData> => {
      const supabase = createClient();
      const [byStatus, byDepartment, byPriority, byManager, health, flow, financials] = await Promise.all([
        supabase.from('v_exec_by_status').select('*'),
        supabase.from('v_exec_by_department').select('*').order('total', { ascending: false }),
        supabase.from('v_exec_by_priority').select('*'),
        supabase.from('v_exec_by_manager').select('*').order('total', { ascending: false }).limit(10),
        supabase.from('v_exec_health').select('*'),
        supabase.from('v_exec_flow_metrics').select('*').maybeSingle(),
        supabase.from('v_exec_financials').select('*').order('retorno_esperado', { ascending: false }),
      ]);

      // O retorno financeiro é opcional: em banco sem a migration nova a view
      // ainda não existe e o resto da tela continua funcionando.
      const failure = [byStatus, byDepartment, byPriority, byManager, health, flow].find((r) => r.error);
      if (failure?.error) throw failure.error;
      if (financials.error && !isSchemaOutdated(financials.error)) throw financials.error;

      return {
        byStatus: (byStatus.data ?? []) as GroupCount[],
        byDepartment: (byDepartment.data ?? []) as GroupCount[],
        byPriority: (byPriority.data ?? []) as GroupCount[],
        byManager: (byManager.data ?? []) as GroupCount[],
        health: (health.data ?? []) as GroupCount[],
        flow: (flow.data ?? null) as FlowMetrics | null,
        financials: (financials.data ?? []) as ExecFinancialRow[],
      };
    },
  });
}

export function useRiskHeatmap() {
  return useQuery({
    queryKey: qk.riskHeatmap,
    queryFn: async (): Promise<RiskHeatCell[]> => {
      const { data, error } = await createClient().from('v_risk_heatmap').select('*');
      if (error) throw error;
      return data as RiskHeatCell[];
    },
  });
}

export function useRoadmap() {
  return useQuery({
    queryKey: qk.roadmap,
    queryFn: async (): Promise<RoadmapRow[]> => {
      const { data, error } = await createClient()
        .from('v_roadmap')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data as RoadmapRow[];
    },
  });
}

/** Série para Burn Down, Burn Up e Curva S do projeto. */
export function useBurnSeries(projectId: string) {
  return useQuery({
    queryKey: qk.burn(projectId),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<BurnPoint[]> => {
      const { data, error } = await createClient().rpc('project_burn_series', { p_project_id: projectId });
      if (error) throw error;
      return (data ?? []) as BurnPoint[];
    },
  });
}

/** Trilha de auditoria — restrita a administradores e gerentes pela RLS. */
export function useAuditLog(params: { table?: string; recordId?: string; limit?: number } = {}) {
  const { table, recordId, limit = 100 } = params;

  return useQuery({
    queryKey: qk.audit(table, recordId),
    queryFn: async (): Promise<(AuditLogEntry & { actor: { full_name: string } | null })[]> => {
      let request = createClient()
        .from('audit_log')
        .select('*, actor:profiles(full_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (table) request = request.eq('table_name', table);
      if (recordId) request = request.eq('record_id', recordId);

      const { data, error } = await request;
      if (error) throw error;
      return data as never;
    },
  });
}
