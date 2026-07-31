/** Chaves centralizadas do TanStack Query — evita invalidações inconsistentes. */
export const qk = {
  session: ['session'] as const,
  profiles: ['profiles'] as const,
  departments: ['departments'] as const,
  clients: ['clients'] as const,
  tags: ['tags'] as const,

  dashboard: ['dashboard'] as const,
  kpis: ['dashboard', 'kpis'] as const,
  activity: (projectId?: string) => ['activity', projectId ?? 'all'] as const,
  workload: ['workload'] as const,
  executive: ['executive'] as const,
  audit: (table?: string, recordId?: string) => ['audit', table ?? 'all', recordId ?? 'all'] as const,

  projects: (filters?: unknown) => ['projects', filters ?? {}] as const,
  project: (id: string) => ['project', id] as const,
  projectMembers: (id: string) => ['project', id, 'members'] as const,
  projectTags: (id: string) => ['project', id, 'tags'] as const,
  checklist: (projectId: string) => ['project', projectId, 'checklist'] as const,
  milestones: (projectId: string) => ['project', projectId, 'milestones'] as const,
  risks: (projectId: string) => ['project', projectId, 'risks'] as const,
  attachments: (projectId: string) => ['project', projectId, 'attachments'] as const,
  timeEntries: (projectId: string) => ['project', projectId, 'time-entries'] as const,
  burn: (projectId: string) => ['project', projectId, 'burn'] as const,

  tasks: (projectId?: string) => ['tasks', projectId ?? 'all'] as const,
  gantt: (projectId?: string) => ['gantt', projectId ?? 'all'] as const,
  dependencies: (projectId: string) => ['project', projectId, 'dependencies'] as const,
  comments: (projectId: string, taskId?: string | null) =>
    ['comments', projectId, taskId ?? 'project'] as const,

  notifications: ['notifications'] as const,
  roadmap: ['roadmap'] as const,
  riskHeatmap: ['risk-heatmap'] as const,
  search: (term: string) => ['search', term] as const,
  calendar: (from: string, to: string) => ['calendar', from, to] as const,
};
