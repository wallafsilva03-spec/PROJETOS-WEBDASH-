'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn, clamp } from '@/lib/utils';

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
}

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, indicatorClassName, ...props }, ref) => {
    const percent = clamp(value ?? 0, 0, 100);

    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={percent}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn('size-full flex-1 rounded-full bg-primary transition-transform duration-500', indicatorClassName)}
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = ProgressPrimitive.Root.displayName;

/** Barra de progresso que muda de cor conforme o desvio do planejado. */
function ProgressWithDelta({
  value,
  expected,
  className,
}: {
  value: number;
  expected?: number | null;
  className?: string;
}) {
  const delta = expected === null || expected === undefined ? 0 : value - expected;
  const tone =
    delta >= 0 ? 'bg-success' : delta >= -10 ? 'bg-primary' : delta >= -25 ? 'bg-warning' : 'bg-destructive';

  return (
    <div className={cn('relative', className)}>
      <Progress value={value} indicatorClassName={tone} />
      {expected !== null && expected !== undefined && expected > 0 && expected < 100 && (
        <span
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/50"
          style={{ left: `${clamp(expected, 0, 100)}%` }}
          aria-hidden
          title={`Previsto: ${expected.toFixed(0)}%`}
        />
      )}
    </div>
  );
}

export { Progress, ProgressWithDelta };
