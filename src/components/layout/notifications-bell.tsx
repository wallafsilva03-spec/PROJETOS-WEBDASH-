'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  ListChecks,
  MessageSquare,
  Paperclip,
  UserPlus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger, Separator } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/empty-state';
import { useNotifications } from '@/hooks/use-notifications';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types/database';

const ICONS: Record<NotificationType, typeof Bell> = {
  comentario: MessageSquare,
  mencao: MessageSquare,
  tarefa_atribuida: UserPlus,
  tarefa_status: ListChecks,
  prazo_hoje: CalendarClock,
  prazo_amanha: CalendarClock,
  projeto_atrasado: AlertTriangle,
  projeto_risco: AlertTriangle,
  checklist: ListChecks,
  arquivo: Paperclip,
  sistema: Bell,
};

const TONES: Partial<Record<NotificationType, string>> = {
  projeto_atrasado: 'text-destructive',
  projeto_risco: 'text-warning',
  prazo_hoje: 'text-warning',
  mencao: 'text-primary',
};

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { items, unreadCount, markAllRead, markRead, isLoading } = useNotifications();

  function openNotification(notification: Notification) {
    if (!notification.is_read) markRead.mutate(notification.id);
    setOpen(false);
    if (notification.project_id) router.push(`/projetos/${notification.project_id}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ''}`}
        >
          <Bell className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <header className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              loading={markAllRead.isPending}
            >
              <CheckCheck className="size-3.5" />
              Marcar todas
            </Button>
          )}
        </header>
        <Separator />

        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Tudo em dia"
              description="Você não tem notificações pendentes."
              className="border-0 bg-transparent py-10"
            />
          ) : (
            <ul className="divide-y">
              {items.map((notification) => {
                const Icon = ICONS[notification.type] ?? Bell;
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary',
                        !notification.is_read && 'bg-primary/[0.04]',
                      )}
                    >
                      <Icon
                        className={cn('mt-0.5 size-4 shrink-0', TONES[notification.type] ?? 'text-muted-foreground')}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm font-medium">{notification.title}</span>
                        {notification.body && (
                          <span className="line-clamp-2 block text-xs text-muted-foreground">
                            {notification.body}
                          </span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {formatRelative(notification.created_at)}
                        </span>
                      </span>
                      {!notification.is_read && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
