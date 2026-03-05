import { endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PeriodInfo {
  periodStart: Date;
  periodEnd: Date;
  periodStartStr: string;
  label: string;
}

/**
 * Calculate current period info — full month
 */
export function getCurrentPeriodInfo(): PeriodInfo {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const periodStart = new Date(year, month, 1);
  const periodEnd = endOfMonth(now);
  
  const monthName = format(periodStart, 'MMMM', { locale: ptBR });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  
  return {
    periodStart,
    periodEnd,
    periodStartStr: periodStart.toISOString().split('T')[0],
    label: capitalizedMonth,
  };
}

/**
 * Calculate next period — next full month
 */
export function getNextPeriodInfo(): PeriodInfo {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  
  const periodStart = new Date(nextYear, nextMonth, 1);
  const periodEnd = endOfMonth(periodStart);
  
  const monthName = format(periodStart, 'MMMM', { locale: ptBR });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  
  return {
    periodStart,
    periodEnd,
    periodStartStr: periodStart.toISOString().split('T')[0],
    label: capitalizedMonth,
  };
}

/**
 * Format period end date for display
 */
export function formatPeriodEnd(periodEnd: Date): string {
  return format(periodEnd, "d 'de' MMMM", { locale: ptBR });
}
