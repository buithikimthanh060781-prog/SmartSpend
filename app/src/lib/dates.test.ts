import { describe, expect, it } from 'vitest';
import { addDays, currentMonthRange, firstOfNextMonth, isoWeekday, monthRangeOf } from '@/lib/dates';

describe('monthRangeOf - khoảng nửa mở [start, endExclusive)', () => {
  it.each([
    ['tháng 28 ngày (2026-02)', '2026-02-15', '2026-02-01', '2026-03-01'],
    ['tháng 29 ngày (2028-02, năm nhuận)', '2028-02-29', '2028-02-01', '2028-03-01'],
    ['tháng 30 ngày (2026-04)', '2026-04-30', '2026-04-01', '2026-05-01'],
    ['tháng 31 ngày (2026-10)', '2026-10-31', '2026-10-01', '2026-11-01'],
    ['tháng 12 sang năm mới', '2026-12-10', '2026-12-01', '2027-01-01'],
  ])('%s', (_name, date, start, endExclusive) => {
    const r = monthRangeOf(date);
    expect(r.start).toBe(start);
    expect(r.endExclusive).toBe(endExclusive);
  });

  it('số ngày của tháng = endExclusive - start', () => {
    const days = (d: string) => {
      const r = monthRangeOf(d);
      let n = 0;
      for (let cur = r.start; cur !== r.endExclusive; cur = addDays(cur, 1)) n++;
      return n;
    };
    expect([days('2026-02-01'), days('2028-02-01'), days('2026-04-01'), days('2026-10-01')]).toEqual([28, 29, 30, 31]);
  });
});

describe('currentMonthRange', () => {
  it('theo múi giờ người dùng: 31/01 17:30 UTC đã là tháng 2 ở Việt Nam', () => {
    const now = new Date('2026-01-31T17:30:00Z');
    expect(currentMonthRange('Asia/Ho_Chi_Minh', now).start).toBe('2026-02-01');
    expect(currentMonthRange('UTC', now).start).toBe('2026-01-01');
  });
});

describe('addDays / firstOfNextMonth / isoWeekday', () => {
  it('cộng ngày qua ranh giới tháng và năm', () => {
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('firstOfNextMonth', () => {
    expect(firstOfNextMonth('2026-01-01')).toBe('2026-02-01');
    expect(firstOfNextMonth('2026-12-01')).toBe('2027-01-01');
  });
  it('isoWeekday: Thứ Hai = 1, Chủ Nhật = 7', () => {
    expect(isoWeekday('2026-10-26')).toBe(1);
    expect(isoWeekday('2026-11-01')).toBe(7);
  });
});
