import { describe, expect, it } from 'vitest';
import { hasValidPeriod, resolveMonthlyBudget } from '@/lib/budget';
import { monthRangeOf } from '@/lib/dates';
import type { SsBudget } from '@/types/db';

function budget(over: Partial<SsBudget>): SsBudget {
  return {
    id: 'b',
    user_id: 'u',
    category_id: null,
    period_type: 'monthly',
    period_start: '2026-10-01',
    period_end: '2026-11-01',
    amount: 5_000_000,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...over,
  };
}

const monthly = (start: string, end: string, amount: number | string = 1000) =>
  budget({ period_start: start, period_end: end, amount });

describe('hasValidPeriod - khớp CHECK constraint Production', () => {
  it('daily: end = start + 1 ngày', () => {
    expect(hasValidPeriod({ period_type: 'daily', period_start: '2026-10-05', period_end: '2026-10-06' })).toBe(true);
    expect(hasValidPeriod({ period_type: 'daily', period_start: '2026-10-05', period_end: '2026-10-07' })).toBe(false);
  });

  it('weekly: bắt đầu Thứ Hai, end = start + 7 ngày', () => {
    expect(hasValidPeriod({ period_type: 'weekly', period_start: '2026-10-26', period_end: '2026-11-02' })).toBe(true);
    // 2026-10-27 là Thứ Ba
    expect(hasValidPeriod({ period_type: 'weekly', period_start: '2026-10-27', period_end: '2026-11-03' })).toBe(false);
    expect(hasValidPeriod({ period_type: 'weekly', period_start: '2026-10-26', period_end: '2026-11-01' })).toBe(false);
  });

  it('monthly: bắt đầu ngày 01, end = ngày 01 tháng kế tiếp', () => {
    expect(hasValidPeriod({ period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01' })).toBe(true);
    expect(hasValidPeriod({ period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-10-31' })).toBe(false);
    expect(hasValidPeriod({ period_type: 'monthly', period_start: '2026-10-02', period_end: '2026-11-02' })).toBe(false);
  });

  it('từ chối giá trị cũ month/week/day và giá trị lạ', () => {
    for (const t of ['month', 'week', 'day', 'custom', '']) {
      expect(hasValidPeriod({ period_type: t, period_start: '2026-10-01', period_end: '2026-11-01' })).toBe(false);
    }
  });
});

describe('resolveMonthlyBudget', () => {
  const oct = monthRangeOf('2026-10-15');

  it('chưa có ngân sách -> none', () => {
    expect(resolveMonthlyBudget([], oct)).toEqual({ status: 'none' });
  });

  it('nhận ngân sách monthly đúng khoảng [01, 01 tháng sau)', () => {
    expect(resolveMonthlyBudget([budget({})], oct)).toEqual({ status: 'set', amount: 5_000_000 });
  });

  it('ngân sách bằng 0 là đã thiết lập, khác với chưa có', () => {
    expect(resolveMonthlyBudget([budget({ amount: 0 })], oct)).toEqual({ status: 'set', amount: 0 });
    expect(resolveMonthlyBudget([], oct)).not.toEqual({ status: 'set', amount: 0 });
  });

  it('bỏ qua ngân sách theo danh mục (category_id khác null)', () => {
    expect(resolveMonthlyBudget([budget({ category_id: 'cat-1' })], oct)).toEqual({ status: 'none' });
  });

  it('không dùng period_type month/week/day', () => {
    expect(resolveMonthlyBudget([budget({ period_type: 'month' })], oct)).toEqual({ status: 'none' });
  });

  it('bỏ qua ngân sách daily và weekly', () => {
    const daily = budget({ period_type: 'daily', period_start: '2026-10-05', period_end: '2026-10-06' });
    const weekly = budget({ period_type: 'weekly', period_start: '2026-10-05', period_end: '2026-10-12' });
    expect(resolveMonthlyBudget([daily, weekly], oct)).toEqual({ status: 'none' });
  });

  it('tuần giao giữa hai tháng (26/10 - 02/11) không bị tính là ngân sách của tháng nào', () => {
    const crossing = budget({ period_type: 'weekly', period_start: '2026-10-26', period_end: '2026-11-02', amount: 999 });
    const nov = monthRangeOf('2026-11-15');
    expect(resolveMonthlyBudget([crossing], oct)).toEqual({ status: 'none' });
    expect(resolveMonthlyBudget([crossing], nov)).toEqual({ status: 'none' });
    // Ngân sách tháng thật vẫn được chọn dù có tuần giao tháng đi kèm.
    expect(resolveMonthlyBudget([crossing, budget({})], oct)).toEqual({ status: 'set', amount: 5_000_000 });
  });

  it('end là mốc không bao gồm: end = 31 (kiểu bao gồm cũ) KHÔNG khớp', () => {
    expect(resolveMonthlyBudget([monthly('2026-10-01', '2026-10-31')], oct)).toEqual({ status: 'none' });
  });

  it.each([
    ['28 ngày', '2026-02-10', '2026-02-01', '2026-03-01'],
    ['29 ngày', '2028-02-10', '2028-02-01', '2028-03-01'],
    ['30 ngày', '2026-04-10', '2026-04-01', '2026-05-01'],
    ['31 ngày', '2026-10-10', '2026-10-01', '2026-11-01'],
    ['tháng 12', '2026-12-10', '2026-12-01', '2027-01-01'],
  ])('tháng %s chọn đúng ngân sách và loại ngân sách tháng khác', (_n, date, start, end) => {
    const month = monthRangeOf(date);
    const target = monthly(start, end, 123);
    const prevMonth = monthly('2025-01-01', '2025-02-01', 7);
    expect(hasValidPeriod(target)).toBe(true);
    expect(resolveMonthlyBudget([prevMonth, target], month)).toEqual({ status: 'set', amount: 123 });
    expect(resolveMonthlyBudget([prevMonth], month)).toEqual({ status: 'none' });
  });

  it('nhiều dòng trùng -> dùng dòng cập nhật gần nhất', () => {
    const old = budget({ id: 'old', amount: 1, updated_at: '2026-10-01T00:00:00Z' });
    const recent = budget({ id: 'new', amount: 9, updated_at: '2026-10-09T00:00:00Z' });
    expect(resolveMonthlyBudget([old, recent], oct)).toEqual({ status: 'set', amount: 9 });
  });

  it('amount dạng chuỗi numeric được xử lý chính xác', () => {
    expect(resolveMonthlyBudget([budget({ amount: '2500000.50' })], oct)).toEqual({ status: 'set', amount: 2500000.5 });
  });
});
