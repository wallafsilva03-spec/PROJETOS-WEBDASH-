import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Cor determinística a partir de um id — usada em avatares sem foto. */
export function avatarTint(seed?: string | null) {
  const palette = [
    'bg-moreno-blue-500 text-white',
    'bg-moreno-green-500 text-white',
    'bg-moreno-lime-600 text-white',
    'bg-moreno-blue-400 text-white',
    'bg-moreno-green-400 text-white',
  ];
  if (!seed) return palette[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K) {
  return items.reduce<Record<K, T[]>>(
    (acc, item) => {
      const k = key(item);
      (acc[k] ||= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

/** Extrai `@nome` de um texto de comentário. */
export function extractMentions(body: string) {
  const matches = body.match(/@([\p{L}][\p{L}\d._-]{1,40})/gu) ?? [];
  return unique(matches.map((m) => m.slice(1).toLowerCase()));
}

export function debounce<T extends (...args: never[]) => void>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
