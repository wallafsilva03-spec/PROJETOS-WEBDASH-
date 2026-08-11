'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'green' | 'lime' | 'warning' | 'danger' | 'neutral';

const TONES: Record<Tone, { icon: string; accent: string }> = {
  brand: { icon: 'bg-moreno-blue-50 text-moreno-blue-600 dark:bg-moreno-blue-900/50 dark:text-moreno-blue-200', accent: 'bg-moreno-blue-500' },
  green: { icon: 'bg-moreno-green-50 text-moreno-green-600 dark:bg-moreno-green-900/50 dark:text-moreno-green-200', accent: 'bg-moreno-green-500' },
  lime: { icon: 'bg-moreno-lime-50 text-moreno-lime-700 dark:bg-moreno-lime-900/40 dark:text-moreno-lime-200', accent: 'bg-moreno-lime-500' },
  warning: { icon: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200', accent: 'bg-amber-500' },
  danger: { icon: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200', accent: 'bg-rose-500' },
  neutral: { icon: 'bg-secondary text-secondary-foreground', accent: 'bg-slate-400' },
};

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  progress?: number | null;
  trend?: { value: number; label?: string } | null;
  index?: number;
  /** Destino ao clicar — normalmente o portfólio já filtrado pelo indicador. */
  href?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  hint,
  progress,
  trend,
  index = 0,
  href,
}: KpiCardProps) {
  const palette = TONES[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.24) }}
      className="h-full"
    >
      <Card
        className={cn(
          'group relative h-full overflow-hidden p-5 transition-shadow hover:shadow-card-hover',
          href && 'focus-within:ring-2 focus-within:ring-ring',
        )}
      >
        <span className={cn('absolute inset-x-0 top-0 h-0.5', palette.accent)} aria-hidden />

        {/* O link cobre o card inteiro; o conteúdo continua legível e selecionável. */}
        {href && (
          <Link
            href={href}
            className="absolute inset-0 z-10 rounded-xl focus:outline-none"
            aria-label={`Ver ${label}`}
          >
            <span className="sr-only">Ver {label}</span>
          </Link>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="font-display text-3xl font-semibold tracking-tight">{value}</p>
          </div>
          <span className={cn('relative flex size-10 shrink-0 items-center justify-center rounded-lg', palette.icon)}>
            <Icon className="size-5" aria-hidden />
            {href && (
              <ArrowUpRight
                className="absolute -right-1 -top-1 size-3.5 rounded-full bg-card p-px opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            )}
          </span>
        </div>

        {typeof progress === 'number' && (
          <Progress value={progress} className="mt-4 h-1.5" indicatorClassName={palette.accent} />
        )}

        {(hint || trend) && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-medium',
                  trend.value >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {trend.value >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {trend.value > 0 ? '+' : ''}
                {trend.value.toFixed(1)}%
              </span>
            )}
            {hint && <span className="truncate text-muted-foreground">{hint}</span>}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
