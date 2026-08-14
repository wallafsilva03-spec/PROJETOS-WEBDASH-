'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AuroraRail } from '@/components/brand/aurora';
import { Sidebar } from '@/components/layout/sidebar';
import { GlobalSearch } from '@/components/layout/global-search';
import { NotificationsBell } from '@/components/layout/notifications-bell';
import { UserMenu } from '@/components/layout/user-menu';
import { usePresenceHeartbeat } from '@/hooks/use-realtime';
import { useReminderRunner } from '@/hooks/use-reminders';

const STORAGE_KEY = 'webdash:sidebar-collapsed';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  usePresenceHeartbeat();

  // Um relógio só para o app inteiro: montado aqui, confere os lembretes
  // vencidos em qualquer tela, e não apenas na do projeto que os criou.
  useReminderRunner();

  React.useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      window.localStorage.setItem(STORAGE_KEY, value ? '0' : '1');
      return !value;
    });
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sem barra lateral no celular, o fio de cor segura a identidade. */}
      <AuroraRail className="fixed inset-y-0 left-0 z-30 w-1 lg:hidden" duration="5s" />

      {/* Sidebar fixa (desktop) */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 lg:block">
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {/* Sidebar em drawer (mobile) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-moreno-blue-900/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              role="dialog"
              aria-label="Menu"
            >
              <div className="relative h-full">
                <Sidebar collapsed={false} onToggle={toggleCollapsed} onNavigate={() => setMobileOpen(false)} />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="absolute -right-11 top-4 rounded-lg bg-card p-2 shadow-lg"
                  aria-label="Fechar menu"
                >
                  <X className="size-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-lg sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>

          <div className="flex-1">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-1">
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>

        <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
