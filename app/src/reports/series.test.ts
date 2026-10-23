import { describe, expect, it } from 'vitest';
import { resolvePreset } from '@/reports/ranges';
import { allowedGranularities, bucketCount, bucketSpanDays, buildSeries, MAX_BUCKETS, suggestGranularity } from '@/reports/series';
import type { ExpenseRow, IncomeRow } from '@/reports/summary';

const TODAY = '2026-10-18';
const inc = (date: string, amount: number, status = 'received'): IncomeRow => ({ amount, status, income_date: date });
const exp = (date: string, amount: number): ExpenseRow => ({ amount, plan_id: null, expense_date: date, category_id: 'c' });

describe('chuỗi theo ngày', () => {
  const week = resolvePreset('last7', TODAY)!; // 12/10 - 18/10

  it('luôn có đủ mọi ngày, ngày không giao dịch = 0 (không bỏ mất mốc)', () => {
    const s = buildSeries([inc('2026-10-14', 1000)], [exp('2026-10-14', 300), exp('2026-10-16', 50)], week, 'day');
    expect(s).toHaveLength(7);
    expect(s.map((b) => b.start)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect(s.map((b) => b.expense)).toEqual([0, 0, 300, 0, 50, 0, 0]);
    expect(s.map((b) => b.income)).toEqual([0, 0, 1000, 0, 0, 0, 0]);
    expect(s[2].net).toBe(700);
    expect(s[0].net).toBe(0);
  });

  it('thu nhập expected không xuất hiện trong biểu đồ', () => {
    const s = buildSeries([inc('2026-10-14', 5000, 'expected')], [], week, 'day');
    expect(s.every((b) => b.income === 0)).toBe(true);
  });

  it('không có dữ liệu: vẫn đủ mốc bằng 0', () => {
    const s = buildSeries([], [], week, 'day');
    expect(s).toHaveLength(7);
    expect(s.every((b) => b.income === 0 && b.expense === 0 && b.net === 0)).toBe(true);
  });

  it('các mốc liên tục, mỗi mốc 1 ngày, kể cả qua ranh giới tháng/năm/DST (chuỗi ngày thuần, không dùng Date địa phương)', () => {
    for (const [from, to, n] of [
      ['2026-10-28', '2026-11-03', 7],
      ['2026-12-28', '2027-01-03', 7],
      ['2026-03-27', '2026-03-31', 5], // tuần chuyển giờ mùa hè ở châu Âu
      ['2028-02-27', '2028-03-02', 5], // 29/02 tồn tại
      ['2026-02-26', '2026-03-02', 5], // 29/02 không tồn tại
    ] as const) {
      const r = resolvePreset('custom', TODAY, { from, to })!;
      const s = buildSeries([], [], r, 'day');
      expect(s).toHaveLength(n);
      s.forEach((b, i) => {
        expect(bucketSpanDays(b)).toBe(1);
        if (i > 0) expect(b.start).toBe(s[i - 1].endExclusive);
      });
    }
  });

  it('tháng 2 năm nhuận có 29 mốc ngày, tháng 2 thường 28', () => {
    expect(buildSeries([], [], resolvePreset('custom', TODAY, { from: '2028-02-01', to: '2028-02-29' })!, 'day')).toHaveLength(29);
    expect(buildSeries([], [], resolvePreset('custom', TODAY, { from: '2026-02-01', to: '2026-02-28' })!, 'day')).toHaveLength(28);
  });

  it('ngày cuối kỳ (nửa mở) không bị tính, ngày đầu kỳ được tính', () => {
    const r = resolvePreset('custom', TODAY, { from: '2026-10-01', to: '2026-10-03' })!;
    const s = buildSeries([], [exp('2026-09-30', 9), exp('2026-10-01', 1), exp('2026-10-03', 3), exp('2026-10-04', 9)], r, 'day');
    expect(s.map((b) => b.expense)).toEqual([1, 0, 3]);
  });
});

describe('chuỗi theo tuần ISO', () => {
  it('mỗi mốc bắt đầu Thứ Hai và dài 7 ngày; tuần giao hai tháng là MỘT mốc', () => {
    const r = resolvePreset('custom', TODAY, { from: '2026-10-26', to: '2026-11-08' })!; // 2 tuần trọn vẹn
    const s = buildSeries([], [exp('2026-10-31', 100), exp('2026-11-01', 50), exp('2026-11-02', 7)], r, 'week');
    expect(s.map((b) => b.start)).toEqual(['2026-10-26', '2026-11-02']);
    expect(s.every((b) => bucketSpanDays(b) === 7)).toBe(true);
    expect(s[0].expense).toBe(150); // 31/10 (T7) và 01/11 (CN) cùng tuần
    expect(s[1].expense).toBe(7); // 02/11 là Thứ Hai tuần mới
  });

  it('khoảng bắt đầu giữa tuần: mốc đầu tính từ Thứ Hai trước đó nhưng chỉ chứa dữ liệu trong khoảng', () => {
    const r = resolvePreset('custom', TODAY, { from: '2026-10-14', to: '2026-10-20' })!; // Thứ Tư -> Thứ Ba
    const s = buildSeries([], [exp('2026-10-13', 999), exp('2026-10-14', 10), exp('2026-10-19', 5)], r, 'week');
    expect(s.map((b) => b.start)).toEqual(['2026-10-12', '2026-10-19']);
    expect(s[0].expense).toBe(10); // 13/10 nằm ngoài khoảng nên bị loại
    expect(s[1].expense).toBe(5);
  });

  it('Chủ Nhật thuộc tuần trước đó', () => {
    const r = resolvePreset('custom', TODAY, { from: '2026-10-18', to: '2026-10-18' })!;
    expect(buildSeries([], [], r, 'week').map((b) => b.start)).toEqual(['2026-10-12']);
  });
});

describe('chuỗi theo tháng', () => {
  it('đủ mọi tháng kể cả tháng không có giao dịch, qua ranh giới năm', () => {
    const r = resolvePreset('custom', TODAY, { from: '2025-11-15', to: '2026-02-10' })!;
    const s = buildSeries([inc('2026-01-05', 100)], [exp('2025-11-20', 10), exp('2026-02-01', 20)], r, 'month');
    expect(s.map((b) => b.start)).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01']);
    expect(s.map((b) => b.expense)).toEqual([10, 0, 0, 20]);
    expect(s.map((b) => b.income)).toEqual([0, 0, 100, 0]);
    expect(s.map((b) => b.label)).toEqual(['11/2025', '12/2025', '01/2026', '02/2026']);
  });

  it('12 tháng gần nhất có 12 mốc tháng', () => {
    expect(buildSeries([], [], resolvePreset('last12m', TODAY)!, 'month')).toHaveLength(12);
  });

  it('tổng các mốc bằng tổng dữ liệu trong khoảng (không mất, không trùng)', () => {
    const r = resolvePreset('last3m', TODAY)!;
    const rows = Array.from({ length: 90 }, (_, i) => exp(`2026-08-${String((i % 28) + 1).padStart(2, '0')}`, 0.1));
    const total = (g: 'day' | 'week' | 'month') => buildSeries([], rows, r, g).reduce((s, b) => s + Math.round(b.expense * 10), 0);
    expect(total('day')).toBe(90);
    expect(total('week')).toBe(90);
    expect(total('month')).toBe(90);
  });
});

describe('độ chi tiết', () => {
  it('gợi ý theo độ dài khoảng', () => {
    expect(suggestGranularity(resolvePreset('last7', TODAY)!)).toBe('day');
    expect(suggestGranularity(resolvePreset('last30', TODAY)!)).toBe('day');
    expect(suggestGranularity(resolvePreset('last3m', TODAY)!)).toBe('week');
    expect(suggestGranularity(resolvePreset('last12m', TODAY)!)).toBe('month');
  });
  it('không cho độ chi tiết tạo quá nhiều mốc; luôn còn lựa chọn theo tháng', () => {
    const fiveYears = resolvePreset('custom', TODAY, { from: '2021-01-01', to: '2026-01-01' })!;
    expect(bucketCount(fiveYears, 'day')).toBeGreaterThan(MAX_BUCKETS);
    expect(allowedGranularities(fiveYears)).not.toContain('day');
    expect(allowedGranularities(fiveYears)).toContain('month');
    expect(() => buildSeries([], [], fiveYears, 'day')).toThrow(RangeError);
  });
  it('12 tháng cho phép cả ngày (365 mốc <= giới hạn)', () => {
    expect(allowedGranularities(resolvePreset('last12m', TODAY)!)).toEqual(['day', 'week', 'month']);
  });
});
