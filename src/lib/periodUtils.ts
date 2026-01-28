import { endOfMonth, setDate, addMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PeriodInfo {
  periodStart: Date;
  periodEnd: Date;
  periodStartStr: string;
  label: string;
}

/**
 * Calculate current period info based on today's date
 * Period 1: Days 1-15 of current month
 * Period 2: Days 16-end of current month
 */
export function getCurrentPeriodInfo(): PeriodInfo {
  const now = new Date();
  const day = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const periodStartDay = day >= 16 ? 16 : 1;
  const periodStart = new Date(year, month, periodStartDay);
  
  let periodEnd: Date;
  if (periodStartDay === 1) {
    periodEnd = setDate(now, 15);
  } else {
    periodEnd = endOfMonth(now);
  }
  
  const monthName = format(periodStart, 'MMMM', { locale: ptBR });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const endDay = periodEnd.getDate();
  
  return {
    periodStart,
    periodEnd,
    periodStartStr: periodStart.toISOString().split('T')[0],
    label: `${capitalizedMonth} ${periodStartDay}-${endDay}`,
  };
}

/**
 * Calculate next period info based on current period
 * If current is 1-15, next is 16-end of same month
 * If current is 16-end, next is 1-15 of next month
 */
export function getNextPeriodInfo(): PeriodInfo {
  const now = new Date();
  const day = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  let nextPeriodStart: Date;
  let nextPeriodEnd: Date;
  
  if (day >= 16) {
    // Currently in period 16-end, next is 1-15 of next month
    const nextMonth = addMonths(now, 1);
    nextPeriodStart = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    nextPeriodEnd = setDate(nextMonth, 15);
  } else {
    // Currently in period 1-15, next is 16-end of same month
    nextPeriodStart = new Date(year, month, 16);
    nextPeriodEnd = endOfMonth(now);
  }
  
  const monthName = format(nextPeriodStart, 'MMMM', { locale: ptBR });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const startDay = nextPeriodStart.getDate();
  const endDay = nextPeriodEnd.getDate();
  
  return {
    periodStart: nextPeriodStart,
    periodEnd: nextPeriodEnd,
    periodStartStr: nextPeriodStart.toISOString().split('T')[0],
    label: `${capitalizedMonth} ${startDay}-${endDay}`,
  };
}

/**
 * Format period end date for display
 */
export function formatPeriodEnd(periodEnd: Date): string {
  return format(periodEnd, "d 'de' MMMM", { locale: ptBR });
}
