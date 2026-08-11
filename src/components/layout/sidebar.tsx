'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { AuroraBackdrop, AuroraRail } from '@/components/brand/aurora';
import { Logo, LogoMark } from '@/components/brand/logo';
import { BrandManifestoInline } from '@/components/brand/manifesto';
import { Hint } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';
import { visibleSections } from './nav-items';

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { role } = useSession();
  const sections = React.useMemo(() => visibleSections(role), [role]);

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'relative flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {/* A mesma aurora da tela de entrada, respirando atrás do menu. */}
      <AuroraBackdrop className="opacity-[0.35]" intensity="soft" />
      <AuroraRail className="absolute inset-y-0 right-0 z-10 w-[3px]" duration="5s" />

      <div className="relative flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-4">
        {collapsed ? (
          <span className="mx-auto flex size-9 items-center justify-center rounded-lg bg-white p-1.5">
            <LogoMark className="size-6" />
          </span>
        ) : (
          <Logo tone="light" />
        )}
        <button
          type="button"
          onClick={onToggle}
          className="hidden shrink-0 rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white lg:block"
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <div className="relative flex-1 space-y-6 overflow-y-auto px-3 py-5 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-sidebar-muted hover:bg-white/5 hover:text-white',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-accent"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <item.icon className="size-[18px] shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              return collapsed ? (
                <Hint key={item.href} label={item.label}>
                  {link}
                </Hint>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </div>

      {!collapsed && (
        <div className="relative border-t border-sidebar-border p-4">
          <div className="rounded-lg bg-white/5 p-3">
            <BrandManifestoInline />
            <p className="mt-1.5 text-xs text-sidebar-muted">
              Plataforma interna de gestão de projetos do Grupo Moreno.
            </p>
          </div>
        </div>
      )}
    </nav>
  );
}
