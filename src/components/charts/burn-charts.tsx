'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useBurnSeries } from '@/hooks/use-analytics';
import { formatDate } from '@/lib/format';

type Mode = 'burndown' | 'burnup' | 'curva-s';

const AXIS = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 11,
};

function tooltipStyle() {
  return {
    contentStyle: {
      background: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      fontSize: 12,
    },
    labelFormatter: (value: string) => formatDate(value),
  };
}

export function BurnCharts({ projectId }: { projectId: string }) {
  const { data, isLoading } = useBurnSeries(projectId);
  const [mode, setMode] = React.useState<Mode>('burndown');

  const series = React.useMemo(
    () =>
      (data ?? []).map((point) => {
        const planejado = Number(point.planejado);
        const concluido = Number(point.concluido);
        const restante = Number(point.restante);
        // Escopo total é constante; a linha ideal é o que deveria restar a cada dia.
        return {
          ...point,
          planejado,
          concluido,
          restante,
          ideal: Math.max(concluido + restante - planejado, 0),
        };
      }),
    [data],
  );

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingDown className="size-4 text-primary" aria-hidden />
          Evolução do esforço
        </CardTitle>
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList className="h-9">
            <TabsTrigger value="burndown">Burn Down</TabsTrigger>
            <TabsTrigger value="burnup">Burn Up</TabsTrigger>
            <TabsTrigger value="curva-s">Curva S</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : series.length < 2 ? (
          <EmptyState
            icon={TrendingDown}
            title="Sem dados suficientes"
            description="Cadastre tarefas com horas estimadas para gerar os gráficos de esforço."
            className="border-0 bg-transparent"
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {mode === 'burndown' ? (
                <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tickFormatter={(v) => formatDate(v, 'dd/MM')} {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...tooltipStyle()} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="restante"
                    name="Horas restantes (real)"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    name="Ideal"
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              ) : mode === 'burnup' ? (
                <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="burnup" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tickFormatter={(v) => formatDate(v, 'dd/MM')} {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...tooltipStyle()} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="concluido"
                    name="Horas entregues"
                    stroke="hsl(var(--chart-2))"
                    fill="url(#burnup)"
                    strokeWidth={2.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="planejado"
                    name="Escopo planejado"
                    stroke="hsl(var(--chart-1))"
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </AreaChart>
              ) : (
                <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="curvaPlan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="curvaReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" tickFormatter={(v) => formatDate(v, 'dd/MM')} {...AXIS} />
                  <YAxis {...AXIS} />
                  <Tooltip {...tooltipStyle()} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="planejado"
                    name="Planejado acumulado"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#curvaPlan)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="concluido"
                    name="Realizado acumulado"
                    stroke="hsl(var(--chart-3))"
                    fill="url(#curvaReal)"
                    strokeWidth={2}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
