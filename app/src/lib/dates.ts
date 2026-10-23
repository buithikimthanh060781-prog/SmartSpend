/**
 * Mọi khoảng ngày trong Smart Spend dùng quy ước nửa mở [start, endExclusive), khớp ss_budgets:
 * period_end là mốc kết thúc KHÔNG bao gồm. Ngày là chuỗi ISO 'YYYY-MM-DD' (kiểu date, không có múi giờ).
 */
export interface MonthRange {
  start: string; // ngày 01 của tháng
  endExclusive: string; // ngày 01 của tháng kế tiếp
  label: string;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** Ngày 01 của tháng kế tiếp (qua năm đúng). */
export function firstOfNextMonth(iso: string): string {
  const d = parseIso(iso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
}

/** Số ngày từ `from` đến `to` (to - from). Tính theo UTC trên chuỗi ngày nên không bị lệch múi giờ/giờ mùa hè. */
export function diffDays(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);
}

/** Ngày 01 của tháng cách tháng chứa `iso` đúng `n` tháng (n âm = lùi). Qua năm đúng. */
export function firstOfMonthOffset(iso: string, n: number): string {
  const d = parseIso(iso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

/** 1 = Thứ Hai ... 7 = Chủ Nhật. */
export function isoWeekday(iso: string): number {
  const day = parseIso(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Khoảng tháng chứa ngày `isoDate`. */
export function monthRangeOf(isoDate: string): MonthRange {
  const [y, m] = isoDate.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  return { start, endExclusive: firstOfNextMonth(start), label: `Tháng ${m}/${y}` };
}

/** Tháng hiện tại theo múi giờ của người dùng (ss_settings.timezone). */
export function currentMonthRange(timeZone: string, now = new Date()): MonthRange {
  let year: number;
  let month: number;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now);
    year = Number(parts.find((p) => p.type === 'year')?.value);
    month = Number(parts.find((p) => p.type === 'month')?.value);
  } catch {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  return monthRangeOf(`${year}-${String(month).padStart(2, '0')}-01`);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
