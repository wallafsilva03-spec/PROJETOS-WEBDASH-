import {
  BarChart3,
  CalendarDays,
  FolderKanban,
  GanttChartSquare,
  KanbanSquare,
  LayoutDashboard,
  Map,
  Settings,
  ShieldAlert,
  Users,
  UserCog,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { AppRole } from '@/types/database';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Perfis com acesso; ausente = todos. */
  roles?: AppRole[];
  description?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Visão geral',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Indicadores do dia a dia' },
      { href: '/projetos', label: 'Projetos', icon: FolderKanban, description: 'Portfólio completo' },
      { href: '/atividades', label: 'Atividades', icon: Activity, description: 'Tudo que está acontecendo' },
    ],
  },
  {
    title: 'Planejamento',
    items: [
      { href: '/kanban', label: 'Kanban', icon: KanbanSquare, description: 'Etapas e tarefas em quadro' },
      { href: '/cronograma', label: 'Cronograma', icon: GanttChartSquare, description: 'Gantt consolidado' },
      { href: '/roadmap', label: 'Roadmap', icon: Map, description: 'Visão executiva por mês' },
      { href: '/calendario', label: 'Calendário', icon: CalendarDays, description: 'Diário, semanal e mensal' },
      { href: '/workload', label: 'Workload', icon: Users, description: 'Capacidade da equipe' },
    ],
  },
  {
    title: 'Direção',
    items: [
      {
        href: '/executivo',
        label: 'Dashboard Executivo',
        icon: BarChart3,
        roles: ['administrador', 'analista'],
        description: 'KPIs de portfólio',
      },
      {
        href: '/analistas',
        label: 'Gestão por analista',
        icon: UserCog,
        roles: ['administrador'],
        description: 'Projetos, prazos e atrasos de cada responsável',
      },
      { href: '/riscos', label: 'Riscos', icon: ShieldAlert, description: 'Heatmap corporativo' },
      { href: '/relatorios', label: 'Relatórios', icon: FileSpreadsheet, description: 'Excel, CSV e PDF' },
    ],
  },
  {
    title: 'Administração',
    items: [{ href: '/configuracoes', label: 'Configurações', icon: Settings }],
  },
];

export function visibleSections(role?: AppRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || (role && item.roles.includes(role))),
  })).filter((section) => section.items.length > 0);
}
