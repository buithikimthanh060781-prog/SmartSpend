import { describe, expect, it } from 'vitest';
import { hasValidPeriod } from '@/lib/budget';
import { lastDayOf, periodContainsDate, periodContaining, periodLabel, periodsForDate, samePeriod, shiftPeriod } from '@/lib/periods';

describe('ngân sách ngày', () => {
  it('[ngày, ngày + 1)', () => {
    expect(periodContaining('daily', '2026-10-18')).toEqual({ type: 'daily', start: '2026-10-18', endExclusive: '2026-10-19' });
  });
  it('ngày cuối tháng/năm', () => {
    expect(periodContaining('daily', '2026-12-31').endExclusive).toBe('2027-01-01');
    expect(periodContaining('daily', '2028-02-29').endExclusive).toBe('2028-03-01');
  });
});

describe('ngân sách tuần ISO', () => {
  it('bắt đầu Thứ Hai, kéo dài 7 ngày', () => {
    // 2026-10-26 là Thứ Hai
    expect(periodContaining('weekly', '2026-10-26')).toEqual({ type: 'weekly', start: '2026-10-26', endExclusive: '2026-11-02' });
  });
  it('mọi ngày trong tuần (Thứ Hai đến Chủ Nhật) cùng về một kỳ', () => {
    const days = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    for (const d of days) expect(periodContaining('weekly', d).start).toBe('2026-10-26');
    expect(periodContaining('weekly', '2026-11-02').start).toBe('2026-11-02'); // Thứ Hai kế tiếp là tuần mới
  });
  it('Chủ Nhật thuộc tuần trước đó (không phải đầu tuần mới)', () => {
    expect(periodContaining('weekly', '2026-10-25').start).toBe('2026-10-19');
  });
  it('tuần giao giữa hai tháng thuộc về MỘT kỳ tuần duy nhất', () => {
    const week = periodContaining('weekly', '2026-10-31'); // Thứ Bảy cuối tháng 10
    expect(week.start).toBe('2026-10-26');
    expect(periodContainsDate(week, '2026-10-31')).toBe(true);
    expect(periodContainsDate(week, '2026-11-01')).toBe(true); // thuộc tháng 11 nhưng cùng tuần
    expect(periodContainsDate(week, '2026-11-02')).toBe(false); // endExclusive không được tính
    expect(periodContainsDate(week, '2026-10-25')).toBe(false);
    // Hai kỳ tháng khác nhau cùng giao với tuần này
    expect(periodContaining('monthly', '2026-10-31').start).not.toBe(periodContaining('monthly', '2026-11-01').start);
  });
  it('tuần giao giữa hai năm', () => {
    expect(periodContaining('weekly', '2027-01-01')).toEqual({ type: 'weekly', start: '2026-12-28', endExclusive: '2027-01-04' });
  });
});

describe('ngân sách tháng', () => {
  it.each([
    ['28 ngày (2026-02)', '2026-02-14', '2026-02-01', '2026-03-01'],
    ['29 ngày, tháng 2 năm nhuận (2028-02)', '2028-02-29', '2028-02-01', '2028-03-01'],
    ['30 ngày (2026-04)', '2026-04-30', '2026-04-01', '2026-05-01'],
    ['31 ngày (2026-10)', '2026-10-31', '2026-10-01', '2026-11-01'],
    ['tháng 12', '2026-12-31', '2026-12-01', '2027-01-01'],
  ])('%s', (_n, date, start, endExclusive) => {
    expect(periodContaining('monthly', date)).toEqual({ type: 'monthly', start, endExclusive });
  });
  it('29/02 chỉ thuộc kỳ tháng 2 năm nhuận, 01/03 thuộc kỳ sau', () => {
    const feb = periodContaining('monthly', '2028-02-10');
    expect(periodContainsDate(feb, '2028-02-29')).toBe(true);
    expect(periodContainsDate(feb, '2028-03-01')).toBe(false);
  });
});

describe('mọi kỳ sinh ra đều thỏa CHECK constraint Production', () => {
  it('daily/weekly/monthly cho nhiều ngày bất kỳ', () => {
    for (const date of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-06-15', '2026-10-31', '2026-12-31', '2027-01-03']) {
      for (const type of ['daily', 'weekly', 'monthly'] as const) {
        const p = periodContaining(type, date);
        expect(hasValidPeriod({ period_type: type, period_start: p.start, period_end: p.endExclusive }), `${type} ${date}`).toBe(true);
      }
    }
  });
});

describe('shiftPeriod / nhãn / so sánh', () => {
  it('lùi và tiến kỳ qua ranh giới tháng, năm', () => {
    const jan = periodContaining('monthly', '2026-01-10');
    expect(shiftPeriod(jan, -1).start).toBe('2025-12-01');
    expect(shiftPeriod(jan, 13).start).toBe('2027-02-01');
    expect(shiftPeriod(periodContaining('weekly', '2026-11-02'), -1).start).toBe('2026-10-26');
    expect(shiftPeriod(periodContaining('daily', '2026-03-01'), -1).start).toBe('2026-02-28');
  });
  it('lastDayOf là ngày cuối được tính', () => {
    expect(lastDayOf(periodContaining('monthly', '2028-02-10'))).toBe('2028-02-29');
    expect(lastDayOf(periodContaining('weekly', '2026-10-28'))).toBe('2026-11-01');
  });
  it('nhãn tiếng Việt', () => {
    expect(periodLabel(periodContaining('daily', '2026-10-05'))).toBe('05/10/2026');
    expect(periodLabel(periodContaining('weekly', '2026-10-28'))).toBe('Tuần 26/10 – 01/11/2026');
    expect(periodLabel(periodContaining('monthly', '2026-02-10'))).toBe('Tháng 2/2026');
  });
  it('periodsForDate trả về ba kỳ cùng chứa ngày đó; samePeriod', () => {
    const p = periodsForDate('2026-10-31');
    for (const t of ['daily', 'weekly', 'monthly'] as const) expect(periodContainsDate(p[t], '2026-10-31')).toBe(true);
    expect(samePeriod(p.weekly, periodContaining('weekly', '2026-10-27'))).toBe(true);
    expect(samePeriod(p.weekly, p.monthly)).toBe(false);
  });
});
