import { addDays, firstOfNextMonth, isoWeekday } from '@/lib/dates';
import { toMoney } from '@/lib/money';
import type { SsBudget } from '@/types/db';

/**
 * Quy tắc ss_budgets đã xác minh bằng CHECK constraint trên Supabase Production:
 * - period_type chỉ nhận 'daily' | 'weekly' | 'monthly';
 * - amount >= 0;
 * - daily:   period_end = period_start + 1 ngày;
 * - weekly:  period_start là Thứ Hai, period_end = period_start + 7 ngày;
 * - monthly: period_start là ngày 01, period_end = ngày 01 tháng kế tiếp;
 * - period_end là mốc kết thúc KHÔNG bao gồm: khoảng là [period_start, period_end).
 */
export const PERIOD_TYPES = ['daily', 'weekly', 'monthly'] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];
export const PERIOD_TYPE_LABEL: Record<PeriodType, string> = { daily: 'Ngày', weekly: 'Tuần', monthly: 'Tháng' };

export interface MonthWindow {
  start: string;
  endExclusive: string;
}

/** Kiểm tra một dòng ngân sách có thỏa quy tắc khoảng ngày của loại kỳ tương ứng không. */
export function hasValidPeriod(row: Pick<SsBudget, 'period_type' | 'period_start' | 'period_end'>): boolean {
  const { period_type: type, period_start: start, period_end: end } = row;
  switch (type) {
    case 'daily':
      return end === addDays(start, 1);
    case 'weekly':
      return isoWeekday(start) === 1 && end === addDays(start, 7);
    case 'monthly':
      return start.endsWith('-01') && end === firstOfNextMonth(start);
    default:
      return false;
  }
}

export type BudgetLookup = { status: 'none' } | { status: 'set'; amount: number };

/**
 * Chọn hạn mức tháng từ các dòng ss_budgets. Chỉ nhận ngân sách:
 * - tổng (category_id = null), không phải ngân sách theo danh mục;
 * - period_type = 'monthly' (không lấy daily/weekly, kể cả tuần nằm gọn hay giao với tháng);
 * - khoảng ngày đúng [đầu tháng, đầu tháng kế tiếp).
 * Số tiền 0 là ngân sách hợp lệ ({ status: 'set', amount: 0 }), khác với chưa thiết lập ({ status: 'none' }).
 * Nếu có nhiều dòng trùng, dùng dòng cập nhật gần nhất.
 */
export function resolveMonthlyBudget(rows: readonly SsBudget[], month: MonthWindow): BudgetLookup {
  const matches = rows.filter(
    (r) =>
      r.category_id === null &&
      r.period_type === 'monthly' &&
      r.period_start === month.start &&
      r.period_end === month.endExclusive,
  );
  if (matches.length === 0) return { status: 'none' };

  const latest = [...matches].sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))[0];
  return { status: 'set', amount: toMoney(latest.amount) };
}
