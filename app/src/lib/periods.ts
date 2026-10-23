import type { PeriodType } from '@/lib/budget';
import { addDays, firstOfMonthOffset, firstOfNextMonth, formatDate, isoWeekday } from '@/lib/dates';

/**
 * Kỳ ngân sách theo đúng CHECK constraint Production, khoảng nửa mở [start, endExclusive):
 * - daily:   endExclusive = start + 1 ngày
 * - weekly:  start là Thứ Hai (ISO), endExclusive = start + 7 ngày
 * - monthly: start là ngày 01, endExclusive = ngày 01 tháng kế tiếp
 */
export interface Period {
  type: PeriodType;
  start: string;
  endExclusive: string;
}

/** Kỳ thuộc loại `type` chứa ngày `isoDate`. Tuần ISO có thể nằm giữa hai tháng. */
export function periodContaining(type: PeriodType, isoDate: string): Period {
  switch (type) {
    case 'daily':
      return { type, start: isoDate, endExclusive: addDays(isoDate, 1) };
    case 'weekly': {
      const start = addDays(isoDate, -(isoWeekday(isoDate) - 1));
      return { type, start, endExclusive: addDays(start, 7) };
    }
    case 'monthly': {
      const start = firstOfMonthOffset(isoDate, 0);
      return { type, start, endExclusive: firstOfNextMonth(start) };
    }
  }
}

/** Dịch chuyển `n` kỳ (n âm = các kỳ trước). */
export function shiftPeriod(period: Period, n: number): Period {
  switch (period.type) {
    case 'daily':
      return periodContaining('daily', addDays(period.start, n));
    case 'weekly':
      return periodContaining('weekly', addDays(period.start, 7 * n));
    case 'monthly':
      return periodContaining('monthly', firstOfMonthOffset(period.start, n));
  }
}

export function periodContainsDate(period: Period, isoDate: string): boolean {
  return isoDate >= period.start && isoDate < period.endExclusive;
}

/** Ngày cuối cùng được tính trong kỳ (để hiển thị; endExclusive không được tính). */
export function lastDayOf(period: Period): string {
  return addDays(period.endExclusive, -1);
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.type === b.type && a.start === b.start;
}

export function periodLabel(period: Period): string {
  const [y, m] = period.start.split('-');
  switch (period.type) {
    case 'daily':
      return formatDate(period.start);
    case 'weekly': {
      const last = lastDayOf(period);
      const [, lm, ld] = last.split('-');
      const [, , sd] = period.start.split('-');
      return `Tuần ${sd}/${m} – ${ld}/${lm}/${last.slice(0, 4)}`;
    }
    case 'monthly':
      return `Tháng ${Number(m)}/${y}`;
  }
}

/** Ba kỳ (ngày, tuần, tháng) cùng chứa một ngày. */
export function periodsForDate(isoDate: string): Record<PeriodType, Period> {
  return {
    daily: periodContaining('daily', isoDate),
    weekly: periodContaining('weekly', isoDate),
    monthly: periodContaining('monthly', isoDate),
  };
}
