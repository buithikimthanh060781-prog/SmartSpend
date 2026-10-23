import { addDays, diffDays, firstOfMonthOffset } from '@/lib/dates';
import { subtractMoney, sumMoney } from '@/lib/money';
import { periodContaining } from '@/lib/periods';
import { inRange, rangeDays, type DateRange } from '@/reports/ranges';
import type { ExpenseRow, IncomeRow } from '@/reports/summary';

export type Granularity = 'day' | 'week' | 'month';
export const GRANULARITY_LABEL: Record<Granularity, string> = { day: 'Theo ngày', week: 'Theo tuần', month: 'Theo tháng' };

export interface Bucket {
  /** Ngày bắt đầu của mốc (ngày, thứ Hai của tuần ISO, hoặc ngày 01 của tháng). */
  start: string;
  endExclusive: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

/** Số mốc tối đa của một biểu đồ để vẫn đọc được. */
export const MAX_BUCKETS = 400;

function bucketStart(date: string, g: Granularity): string {
  if (g === 'day') return date;
  if (g === 'week') return periodContaining('weekly', date).start; // tuần ISO bắt đầu Thứ Hai
  return firstOfMonthOffset(date, 0);
}

function nextBucket(start: string, g: Granularity): string {
  return g === 'day' ? addDays(start, 1) : g === 'week' ? addDays(start, 7) : firstOfMonthOffset(start, 1);
}

function label(start: string, g: Granularity): string {
  const [y, m, d] = start.split('-');
  return g === 'month' ? `${m}/${y}` : `${d}/${m}`;
}

/** Số mốc sẽ được tạo ra cho một khoảng ở độ chi tiết `g`. */
export function bucketCount(range: DateRange, g: Granularity): number {
  let n = 0;
  for (let s = bucketStart(range.start, g); s < range.endExclusive && n <= MAX_BUCKETS + 1; s = nextBucket(s, g)) n++;
  return n;
}

/** Độ chi tiết cho phép: không vượt MAX_BUCKETS mốc. Luôn có ít nhất 'month'. */
export function allowedGranularities(range: DateRange): Granularity[] {
  return (['day', 'week', 'month'] as const).filter((g) => bucketCount(range, g) <= MAX_BUCKETS);
}

/** Độ chi tiết gợi ý: đến 31 ngày -> ngày; đến 120 ngày -> tuần; còn lại -> tháng. */
export function suggestGranularity(range: DateRange): Granularity {
  const days = rangeDays(range);
  const g: Granularity = days <= 31 ? 'day' : days <= 120 ? 'week' : 'month';
  return allowedGranularities(range).includes(g) ? g : 'month';
}

/**
 * Chuỗi thu/chi theo thời gian. LUÔN tạo đủ mọi mốc trong khoảng, mốc không có giao dịch có giá trị 0 (không bỏ mất mốc).
 * Thu nhập chỉ gồm status = 'received'. Tuần bắt đầu Thứ Hai (ISO) và có thể bắt đầu trước `range.start`
 * (dòng ngoài khoảng vẫn bị loại, nên tuần đầu/cuối chỉ chứa phần nằm trong khoảng).
 */
export function buildSeries(incomes: readonly IncomeRow[], expenses: readonly ExpenseRow[], range: DateRange, g: Granularity): Bucket[] {
  if (rangeDays(range) === 0) return [];
  const starts: string[] = [];
  for (let s = bucketStart(range.start, g); s < range.endExclusive; s = nextBucket(s, g)) {
    starts.push(s);
    if (starts.length > MAX_BUCKETS) throw new RangeError(`Khoảng thời gian tạo quá ${MAX_BUCKETS} mốc; hãy chọn độ chi tiết lớn hơn.`);
  }

  const inc = new Map<string, IncomeRow[]>();
  const exp = new Map<string, ExpenseRow[]>();
  for (const r of incomes) {
    if (r.status !== 'received' || !inRange(r.income_date, range)) continue;
    const k = bucketStart(r.income_date, g);
    (inc.get(k) ?? inc.set(k, []).get(k)!).push(r);
  }
  for (const r of expenses) {
    if (!inRange(r.expense_date, range)) continue;
    const k = bucketStart(r.expense_date, g);
    (exp.get(k) ?? exp.set(k, []).get(k)!).push(r);
  }

  return starts.map((start) => {
    const income = sumMoney(inc.get(start) ?? [], (r) => r.amount);
    const expense = sumMoney(exp.get(start) ?? [], (r) => r.amount);
    return { start, endExclusive: nextBucket(start, g), label: label(start, g), income, expense, net: subtractMoney(income, expense) };
  });
}

/** Số ngày giữa hai mốc (dùng để kiểm tra mốc liên tục trong test). */
export const bucketSpanDays = (b: Bucket): number => diffDays(b.start, b.endExclusive);
