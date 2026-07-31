import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return isValid(date) ? date : null;
}

export function formatDate(value?: string | Date | null, pattern = 'dd/MM/yyyy') {
  const date = toDate(value);
  return date ? format(date, pattern, { locale: ptBR }) : '—';
}

export function formatDateTime(value?: string | Date | null) {
  return formatDate(value, "dd/MM/yyyy 'às' HH:mm");
}

export function formatMonth(value?: string | Date | null) {
  const date = toDate(value);
  return date ? format(date, 'MMM/yy', { locale: ptBR }) : '—';
}

export function formatRelative(value?: string | Date | null) {
  const date = toDate(value);
  if (!date) return '—';
  return formatDistanceToNowStrict(date, { locale: ptBR, addSuffix: true });
}

export function formatCurrency(value?: number | null) {
  return currency.format(value ?? 0);
}

export function formatCompactCurrency(value?: number | null) {
  const v = value ?? 0;
  if (Math.abs(v) >= 1_000_000) return `R$ ${decimal.format(v / 1_000_000)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${decimal.format(v / 1_000)}k`;
  return currency.format(v);
}

export function formatNumber(value?: number | null) {
  return integer.format(value ?? 0);
}

export function formatHours(value?: number | null) {
  return `${decimal.format(value ?? 0)}h`;
}

export function formatPercent(value?: number | null, digits = 0) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatDelta(value?: number | null) {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${decimal.format(value)}%`;
}

/** "há 3 dias" / "em 5 dias" a partir de um número de dias. */
export function formatDaysLabel(days?: number | null) {
  if (days === null || days === undefined) return '—';
  if (days === 0) return 'vence hoje';
  if (days > 0) return `${integer.format(days)} ${days === 1 ? 'dia restante' : 'dias restantes'}`;
  const late = Math.abs(days);
  return `${integer.format(late)} ${late === 1 ? 'dia de atraso' : 'dias de atraso'}`;
}

export function formatFileSize(bytes?: number | null) {
  const size = bytes ?? 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${decimal.format(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) return `${decimal.format(size / (1024 * 1024))} MB`;
  return `${decimal.format(size / (1024 * 1024 * 1024))} GB`;
}

/** Rótulo humanizado para enums vindos do banco (`em_desenvolvimento` → `Em desenvolvimento`). */
export function humanizeEnum(value?: string | null) {
  if (!value) return '—';
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
