import { addDays, diffDays, firstOfMonthOffset } from '@/lib/dates';
import { periodContaining } from '@/lib/periods';

/**
 * Khoảng ngày nửa mở [start, endExclusive), cùng quy ước với ss_budgets. Ngày là chuỗi ISO 'YYYY-MM-DD' (kiểu DATE),
 * không bao giờ chuyển qua JavaScript Date theo giờ địa phương nên không lệch ngày. "Hôm nay" luôn tính theo múi giờ
 * của người dùng (ss_settings.timezone, mặc định Asia/Ho_Chi_Minh) do nơi gọi truyền vào.
 */
export interface DateRange {
  start: string;
  endExclusive: string;
}

export const RANGE_PRESETS = ['last7', 'last30', 'thisMonth', 'lastMonth', 'last3m', 'last6m', 'last12m', 'custom'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const PRESET_LABEL: Record<RangePreset, string> = {
  last7: '7 ngày gần nhất',
  last30: '30 ngày gần nhất',
  thisMonth: 'Tháng này',
  lastMonth: 'Tháng trước',
  last3m: '3 tháng gần nhất',
  last6m: '6 tháng gần nhất',
  last12m: '12 tháng gần nhất',
  custom: 'Tùy chọn',
};

export interface CustomRange {
  from: string; // tính cả ngày
  to: string; // tính cả ngày
}

export const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/**
 * Khoảng thời gian của một preset.
 * - 7/30 ngày: các ngày liên tiếp kết thúc HÔM NAY (gồm hôm nay).
 * - 3/6/12 tháng: từ ngày 01 của tháng cách đây (N-1) tháng đến hôm nay.
 * - Tháng này / Tháng trước: nguyên tháng lịch.
 * Trả về null nếu preset 'custom' thiếu hoặc sai khoảng (from > to, ngày không hợp lệ).
 */
export function resolvePreset(preset: RangePreset, today: string, custom?: CustomRange): DateRange | null {
  const tomorrow = addDays(today, 1);
  switch (preset) {
    case 'last7':
      return { start: addDays(today, -6), endExclusive: tomorrow };
    case 'last30':
      return { start: addDays(today, -29), endExclusive: tomorrow };
    case 'thisMonth': {
      const start = firstOfMonthOffset(today, 0);
      return { start, endExclusive: firstOfMonthOffset(today, 1) };
    }
    case 'lastMonth':
      return { start: firstOfMonthOffset(today, -1), endExclusive: firstOfMonthOffset(today, 0) };
    case 'last3m':
      return { start: firstOfMonthOffset(today, -2), endExclusive: tomorrow };
    case 'last6m':
      return { start: firstOfMonthOffset(today, -5), endExclusive: tomorrow };
    case 'last12m':
      return { start: firstOfMonthOffset(today, -11), endExclusive: tomorrow };
    case 'custom': {
      if (!custom || !isIsoDate(custom.from) || !isIsoDate(custom.to) || custom.from > custom.to) return null;
      return { start: custom.from, endExclusive: addDays(custom.to, 1) };
    }
  }
}

export const rangeDays = (r: DateRange): number => Math.max(0, diffDays(r.start, r.endExclusive));
export const inRange = (date: string, r: DateRange): boolean => date >= r.start && date < r.endExclusive;

/** Phần của khoảng đã trôi qua tính đến hết hôm nay (khoảng chứa ngày tương lai sẽ bị cắt). */
export function elapsedRange(r: DateRange, today: string): DateRange {
  const end = addDays(today, 1);
  return { start: r.start, endExclusive: end < r.endExclusive ? (end > r.start ? end : r.start) : r.endExclusive };
}

export const elapsedDays = (r: DateRange, today: string): number => rangeDays(elapsedRange(r, today));

/** Khoảng còn đang diễn ra: đã bắt đầu nhưng chưa kết thúc (còn ngày tương lai). */
export const isInProgress = (r: DateRange, today: string): boolean => r.start <= today && addDays(today, 1) < r.endExclusive;

export type ComparisonKind = 'day' | 'week' | 'month' | 'custom';
/** 'toDate' = kỳ hiện tại đến hết hôm nay, so với cùng số ngày đầu của kỳ trước (so sánh công bằng khi kỳ chưa kết thúc). */
export type ComparisonBasis = 'toDate' | 'complete';

export interface ComparisonSpec {
  current: DateRange;
  previous: DateRange;
  /** Số ngày được so sánh ở mỗi bên (hai bên luôn bằng nhau). */
  days: number;
  /** Kỳ hiện tại chưa kết thúc, đang so sánh với cùng số ngày của kỳ trước. */
  partial: boolean;
  currentLabel: string;
  previousLabel: string;
}

const clip = (r: DateRange, maxEnd: string): DateRange => ({ start: r.start, endExclusive: r.endExclusive < maxEnd ? r.endExclusive : maxEnd });

/**
 * Xác định cặp khoảng để so sánh. Hai bên luôn có CÙNG SỐ NGÀY:
 * - day: hôm nay vs hôm qua; week: tuần ISO này vs tuần trước; month: tháng này vs tháng trước;
 * - custom: khoảng tùy chọn vs khoảng liền trước có cùng số ngày.
 * - basis 'toDate' chỉ so sánh số ngày đã trôi qua của kỳ hiện tại với đúng bấy nhiêu ngày đầu của kỳ trước.
 * - basis 'complete' so sánh kỳ vừa kết thúc gần nhất với kỳ liền trước nó (cả hai đã trọn vẹn).
 */
export function resolveComparison(kind: ComparisonKind, basis: ComparisonBasis, today: string, custom?: CustomRange): ComparisonSpec | null {
  if (kind === 'custom') {
    const r = resolvePreset('custom', today, custom);
    if (!r) return null;
    const current = elapsedRange(r, today);
    const days = rangeDays(current);
    if (days === 0) return null; // khoảng hoàn toàn nằm ở tương lai: chưa có gì để so sánh
    const previous = { start: addDays(current.start, -days), endExclusive: current.start };
    return { current, previous, days, partial: current.endExclusive < r.endExclusive, currentLabel: 'Khoảng đã chọn', previousLabel: 'Khoảng liền trước' };
  }

  const type = kind === 'day' ? 'daily' : kind === 'week' ? 'weekly' : 'monthly';
  const shift = (d: string, n: number) => (kind === 'day' ? addDays(d, n) : kind === 'week' ? addDays(d, 7 * n) : firstOfMonthOffset(d, n));
  const names = { day: ['Hôm nay', 'Hôm qua'], week: ['Tuần này', 'Tuần trước'], month: ['Tháng này', 'Tháng trước'] }[kind];
  const doneNames = { day: ['Hôm qua', 'Hôm kia'], week: ['Tuần trước', 'Hai tuần trước'], month: ['Tháng trước', 'Hai tháng trước'] }[kind];

  const todayPeriod = periodContaining(type, today);
  if (basis === 'complete') {
    const current = { start: shift(todayPeriod.start, -1), endExclusive: todayPeriod.start };
    const previous = { start: shift(todayPeriod.start, -2), endExclusive: shift(todayPeriod.start, -1) };
    // Với tháng, hai tháng có thể khác số ngày: cắt về số ngày nhỏ hơn để hai bên bằng nhau.
    const days = Math.min(rangeDays(current), rangeDays(previous));
    return {
      current: { start: current.start, endExclusive: addDays(current.start, days) },
      previous: { start: previous.start, endExclusive: addDays(previous.start, days) },
      days,
      partial: days < Math.max(rangeDays(current), rangeDays(previous)),
      currentLabel: doneNames[0],
      previousLabel: doneNames[1],
    };
  }

  const elapsed = elapsedRange({ start: todayPeriod.start, endExclusive: todayPeriod.endExclusive }, today);
  const days = rangeDays(elapsed);
  const prevPeriod = { start: shift(todayPeriod.start, -1), endExclusive: todayPeriod.start };
  const previous = clip({ start: prevPeriod.start, endExclusive: addDays(prevPeriod.start, days) }, prevPeriod.endExclusive);
  // Tháng trước ngắn hơn số ngày đã trôi qua của tháng này (ví dụ 31/03 vs tháng 2): cắt cả hai bên cho bằng nhau.
  const common = Math.min(days, rangeDays(previous));
  return {
    current: { start: elapsed.start, endExclusive: addDays(elapsed.start, common) },
    previous: { start: previous.start, endExclusive: addDays(previous.start, common) },
    days: common,
    partial: elapsed.endExclusive < todayPeriod.endExclusive || common < days,
    currentLabel: names[0],
    previousLabel: names[1],
  };
}

/**
 * Khoảng liền trước, cùng số ngày, của một khoảng báo cáo (dùng cho cột "so với kỳ trước").
 * Tháng này/Tháng trước dùng tháng lịch liền trước (cắt bằng số ngày so sánh), các khoảng khác lùi đúng số ngày.
 */
export function previousComparableRange(range: DateRange, preset: RangePreset, today: string): { current: DateRange; previous: DateRange; partial: boolean } {
  const current = elapsedRange(range, today);
  const days = rangeDays(current);
  if (preset === 'thisMonth' || preset === 'lastMonth') {
    const prevStart = firstOfMonthOffset(range.start, -1);
    const prevMonthEnd = range.start;
    const common = Math.min(days, diffDays(prevStart, prevMonthEnd));
    return {
      current: { start: current.start, endExclusive: addDays(current.start, common) },
      previous: { start: prevStart, endExclusive: addDays(prevStart, common) },
      partial: common < rangeDays(range),
    };
  }
  return {
    current,
    previous: { start: addDays(current.start, -days), endExclusive: current.start },
    partial: current.endExclusive < range.endExclusive,
  };
}
