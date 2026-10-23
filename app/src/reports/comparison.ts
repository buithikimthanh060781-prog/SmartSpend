import { compareMoney, subtractMoney, toMoney, type NumericValue } from '@/lib/money';

export interface Comparison {
  current: number;
  previous: number;
  /** current - previous (chính xác, có thể âm). */
  delta: number;
  /** Tỷ lệ thay đổi (%) so với kỳ trước. null khi kỳ trước bằng 0: không có tăng trưởng "vô hạn". Chỉ để hiển thị. */
  changePercent: number | null;
  direction: 'up' | 'down' | 'flat';
  previousIsZero: boolean;
}

/**
 * So sánh hai giá trị tiền. Kỳ trước = 0 thì KHÔNG tính tỷ lệ (changePercent = null) và `previousIsZero = true`
 * để giao diện hiển thị "không có kỳ trước để so sánh" thay vì +∞%. Hàm này chỉ mô tả sự thay đổi, không đánh giá tốt/xấu.
 */
export function compareValues(current: NumericValue, previous: NumericValue): Comparison {
  const cur = toMoney(current);
  const prev = toMoney(previous);
  const delta = subtractMoney(cur, prev);
  const sign = compareMoney(delta, 0);
  const previousIsZero = compareMoney(prev, 0) === 0;
  return {
    current: cur,
    previous: prev,
    delta,
    changePercent: previousIsZero ? null : (delta / Math.abs(prev)) * 100,
    direction: sign > 0 ? 'up' : sign < 0 ? 'down' : 'flat',
    previousIsZero,
  };
}

/** Tỷ lệ phần trăm part/whole. whole = 0 -> null ("không áp dụng"), không bao giờ chia cho 0. Chỉ để hiển thị. */
export function percentOf(part: NumericValue, whole: NumericValue): number | null {
  if (compareMoney(whole, 0) === 0) return null;
  return (toMoney(part) / toMoney(whole)) * 100;
}

/** Hiển thị phần trăm kiểu vi-VN, 1 chữ số thập phân; null -> "—". */
export function formatRatio(percent: number | null, empty = '—'): string {
  if (percent === null) return empty;
  return `${percent.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
}
