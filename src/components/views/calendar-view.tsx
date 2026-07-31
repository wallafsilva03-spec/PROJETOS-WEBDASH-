'use client';

import * as React from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { PRIORITY_META, TASK_STATUS_META } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  subtitle?: string | null;
  status?: keyof typeof TASK_STATUS_META;
  priority?: keyof typeof PRIORITY_META;
  href?: string;
  onClick?: () => void;
}

type Mode = 'mes' | 'semana' | 'dia';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function CalendarView({ events, isLoading }: { events: CalendarEvent[]; isLoading?: boolean }) {
  const [mode, setMode] = React.useState<Mode>('mes');
  const [cursor, setCursor] = React.useState(() => new Date());

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = event.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), event]);
    });
    return map;
  }, [events]);

  const days = React.useMemo(() => {
    if (mode === 'dia') return [cursor];
    if (mode === 'semana') {
      return eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) });
    }
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursor)),
      end: endOfWeek(endOfMonth(cursor)),
    });
  }, [cursor, mode]);

  function shift(direction: 1 | -1) {
    setCursor((current) => {
      if (mode === 'dia') return addDays(current, direction);
      if (mode === 'semana') return direction > 0 ? addWeeks(current, 1) : subWeeks(current, 1);
      return direction > 0 ? addMonths(current, 1) : subMonths(current, 1);
    });
  }

  const title =
    mode === 'dia'
      ? format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
      : mode === 'semana'
        ? `${format(startOfWeek(cursor), 'd MMM', { locale: ptBR })} – ${format(endOfWeek(cursor), 'd MMM yyyy', { locale: ptBR })}`
        : format(cursor, 'MMMM yyyy', { locale: ptBR });

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label="Período anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label="Próximo período">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Hoje
          </Button>
          <h3 className="ml-2 text-sm font-semibold capitalize">{title}</h3>
        </div>

        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList className="h-9">
            <TabsTrigger value="dia">Diário</TabsTrigger>
            <TabsTrigger value="semana">Semanal</TabsTrigger>
            <TabsTrigger value="mes">Mensal</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-px bg-border p-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-card" />
          ))}
        </div>
      ) : mode === 'dia' ? (
        <div className="p-4">
          <DayAgenda date={cursor} events={byDay.get(format(cursor, 'yyyy-MM-dd')) ?? []} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 border-b bg-secondary/60">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-border">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = byDay.get(key) ?? [];
              const outside = mode === 'mes' && !isSameMonth(day, cursor);

              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-28 bg-card p-1.5',
                    outside && 'bg-secondary/40 text-muted-foreground',
                    mode === 'semana' && 'min-h-48',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isToday(day) &&
                          'flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">{dayEvents.length}</span>
                    )}
                  </div>

                  <ul className="space-y-1">
                    {dayEvents.slice(0, mode === 'semana' ? 8 : 3).map((event) => (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={event.onClick}
                          className={cn(
                            'w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-colors',
                            event.status
                              ? TASK_STATUS_META[event.status].className
                              : 'bg-secondary text-secondary-foreground',
                            'hover:brightness-95',
                          )}
                          title={event.title}
                        >
                          {event.title}
                        </button>
                      </li>
                    ))}
                    {dayEvents.length > (mode === 'semana' ? 8 : 3) && (
                      <li className="px-1.5 text-[10px] text-muted-foreground">
                        +{dayEvents.length - (mode === 'semana' ? 8 : 3)} mais
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function DayAgenda({ date, events }: { date: Date; events: CalendarEvent[] }) {
  if (!events.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nada agendado"
        description={`Nenhum prazo para ${formatDate(date)}.`}
        className="border-0 bg-transparent"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((event) => (
        <li key={event.id}>
          <button
            type="button"
            onClick={event.onClick}
            className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-secondary"
          >
            <span
              className={cn('size-2.5 shrink-0 rounded-full', event.status ? TASK_STATUS_META[event.status].dot : 'bg-primary')}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{event.title}</span>
              {event.subtitle && (
                <span className="block truncate text-xs text-muted-foreground">{event.subtitle}</span>
              )}
            </span>
            {event.priority && (
              <Badge variant="soft" className={PRIORITY_META[event.priority].className}>
                {PRIORITY_META[event.priority].label}
              </Badge>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Marcador do dia atual usado pelo cabeçalho semanal. */
export function isSameDate(a: Date, b: Date) {
  return isSameDay(a, b);
}
