import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/constants';

/** Símbolo do Grupo Moreno — o "V" em verde/verde-limão com a folha azul. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('size-8', className)}
      role="img"
      aria-label="Grupo Moreno"
      fill="none"
    >
      <path d="M6 4 H28 L48 96 H32 Z" fill={BRAND.green} />
      <path d="M58 4 H78 L54 96 H44 Z" fill={BRAND.lime} />
      <path
        d="M86 12 C 96 40, 92 74, 74 96 L 62 96 C 80 70, 86 40, 86 12 Z"
        fill={BRAND.blue}
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** `light` inverte o texto para uso sobre fundos escuros (sidebar). */
  tone?: 'default' | 'light';
  showTagline?: boolean;
}

export function Logo({ className, tone = 'default', showTagline = false }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className="size-9 shrink-0" />
      <div className="min-w-0 leading-tight">
        <p
          className={cn(
            'truncate font-display text-[15px] font-semibold tracking-tight',
            tone === 'light' ? 'text-white' : 'text-moreno-blue-600 dark:text-moreno-blue-200',
          )}
        >
          Grupo Moreno
        </p>
        <p
          className={cn(
            'truncate text-[11px] font-medium uppercase tracking-[0.14em]',
            tone === 'light' ? 'text-white/60' : 'text-muted-foreground',
          )}
        >
          {showTagline ? 'Fortalecer · Conectar · Crescer' : 'Gestão de Projetos'}
        </p>
      </div>
    </div>
  );
}

/** Selos institucionais FORTALECER · CONECTAR · CRESCER. */
export function BrandPills({ className }: { className?: string }) {
  const pills = [
    { label: 'FORTALECER', bg: BRAND.green },
    { label: 'CONECTAR', bg: BRAND.lime },
    { label: 'CRESCER', bg: BRAND.blue },
  ];

  return (
    <ul className={cn('flex flex-wrap items-center gap-2', className)}>
      {pills.map((pill) => (
        <li
          key={pill.label}
          className="rounded-md px-3 py-1 text-[11px] font-bold tracking-wider text-white"
          style={{ backgroundColor: pill.bg }}
        >
          {pill.label}
        </li>
      ))}
    </ul>
  );
}
