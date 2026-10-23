import { describe, expect, it } from 'vitest';
import { elapsedDays, elapsedRange, inRange, isInProgress, previousComparableRange, rangeDays, resolveComparison, resolvePreset } from '@/reports/ranges';

const TODAY = '2026-10-18'; // Chủ Nhật

describe('resolvePreset', () => {
  it.each([
    ['last7', '2026-10-12', '2026-10-19', 7],
    ['last30', '2026-09-19', '2026-10-19', 30],
    ['thisMonth', '2026-10-01', '2026-11-01', 31],
    ['lastMonth', '2026-09-01', '2026-10-01', 30],
    ['last3m', '2026-08-01', '2026-10-19', 79],
    ['last6m', '2026-05-01', '2026-10-19', 171],
    ['last12m', '2025-11-01', '2026-10-19', 352],
  ] as const)('%s', (preset, start, end, days) => {
    const r = resolvePreset(preset, TODAY)!;
    expect(r).toEqual({ start, endExclusive: end });
    expect(rangeDays(r)).toBe(days);
  });

  it('khoảng tùy chọn: from/to tính cả ngày, end nửa mở', () => {
    expect(resolvePreset('custom', TODAY, { from: '2026-10-01', to: '2026-10-10' })).toEqual({ start: '2026-10-01', endExclusive: '2026-10-11' });
    expect(resolvePreset('custom', TODAY, { from: '2026-10-05', to: '2026-10-05' })).toEqual({ start: '2026-10-05', endExclusive: '2026-10-06' });
  });
  it('khoảng tùy chọn sai -> null', () => {
    expect(resolvePreset('custom', TODAY)).toBeNull();
    expect(resolvePreset('custom', TODAY, { from: '2026-10-10', to: '2026-10-01' })).toBeNull();
    expect(resolvePreset('custom', TODAY, { from: '10/10/2026', to: '2026-10-11' })).toBeNull();
  });
  it('tháng trước của tháng 3 năm nhuận có 29 ngày', () => {
    const r = resolvePreset('lastMonth', '2028-03-05')!;
    expect(r).toEqual({ start: '2028-02-01', endExclusive: '2028-03-01' });
    expect(rangeDays(r)).toBe(29);
  });
  it('tháng 2 thường có 28 ngày; qua ranh giới năm', () => {
    expect(rangeDays(resolvePreset('lastMonth', '2026-03-10')!)).toBe(28);
    expect(resolvePreset('last3m', '2027-01-15')!.start).toBe('2026-11-01');
    expect(resolvePreset('lastMonth', '2027-01-15')).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' });
  });
});

describe('elapsed / inRange', () => {
  it('tháng đang diễn ra chỉ tính đến hết hôm nay', () => {
    const r = resolvePreset('thisMonth', TODAY)!;
    expect(elapsedRange(r, TODAY)).toEqual({ start: '2026-10-01', endExclusive: '2026-10-19' });
    expect(elapsedDays(r, TODAY)).toBe(18);
    expect(isInProgress(r, TODAY)).toBe(true);
  });
  it('ngày cuối tháng: không còn ngày tương lai nên không còn "đang diễn ra"', () => {
    const r = resolvePreset('thisMonth', '2026-10-31')!;
    expect(isInProgress(r, '2026-10-31')).toBe(false);
    expect(elapsedDays(r, '2026-10-31')).toBe(31);
  });
  it('kỳ hoàn toàn ở tương lai: 0 ngày đã trôi qua', () => {
    expect(elapsedDays({ start: '2026-11-01', endExclusive: '2026-12-01' }, TODAY)).toBe(0);
  });
  it('kỳ đã kết thúc giữ nguyên', () => {
    const r = resolvePreset('lastMonth', TODAY)!;
    expect(elapsedRange(r, TODAY)).toEqual(r);
    expect(isInProgress(r, TODAY)).toBe(false);
  });
  it('inRange nửa mở', () => {
    const r = { start: '2026-10-01', endExclusive: '2026-11-01' };
    expect(inRange('2026-10-01', r)).toBe(true);
    expect(inRange('2026-10-31', r)).toBe(true);
    expect(inRange('2026-11-01', r)).toBe(false);
    expect(inRange('2026-09-30', r)).toBe(false);
  });
});

describe('resolveComparison: hai bên luôn cùng số ngày', () => {
  it('hôm nay vs hôm qua', () => {
    expect(resolveComparison('day', 'toDate', TODAY)).toMatchObject({
      current: { start: '2026-10-18', endExclusive: '2026-10-19' },
      previous: { start: '2026-10-17', endExclusive: '2026-10-18' },
      days: 1,
      partial: false,
    });
  });

  it('tuần này vs tuần trước khi tuần chưa kết thúc (Thứ Tư): chỉ so 3 ngày đầu của hai tuần', () => {
    const c = resolveComparison('week', 'toDate', '2026-10-14')!;
    expect(c.current).toEqual({ start: '2026-10-12', endExclusive: '2026-10-15' });
    expect(c.previous).toEqual({ start: '2026-10-05', endExclusive: '2026-10-08' });
    expect(c.days).toBe(3);
    expect(c.partial).toBe(true);
  });

  it('Chủ Nhật là ngày cuối tuần ISO: so sánh trọn 7 ngày', () => {
    const c = resolveComparison('week', 'toDate', TODAY)!;
    expect(c.days).toBe(7);
    expect(c.partial).toBe(false);
    expect(c.previous).toEqual({ start: '2026-10-05', endExclusive: '2026-10-12' });
  });

  it('tháng này vs tháng trước: cùng số ngày đã trôi qua', () => {
    const c = resolveComparison('month', 'toDate', TODAY)!;
    expect(c.current).toEqual({ start: '2026-10-01', endExclusive: '2026-10-19' });
    expect(c.previous).toEqual({ start: '2026-09-01', endExclusive: '2026-09-19' });
    expect(c.days).toBe(18);
    expect(c.partial).toBe(true);
  });

  it('31/03 so với tháng 2 chỉ có 28 ngày: cắt cả hai bên về 28 ngày cho bằng nhau', () => {
    const c = resolveComparison('month', 'toDate', '2026-03-31')!;
    expect(c.days).toBe(28);
    expect(c.current).toEqual({ start: '2026-03-01', endExclusive: '2026-03-29' });
    expect(c.previous).toEqual({ start: '2026-02-01', endExclusive: '2026-03-01' });
    expect(c.partial).toBe(true);
  });

  it('tháng 3 năm nhuận: tháng 2 có 29 ngày', () => {
    const c = resolveComparison('month', 'toDate', '2028-03-31')!;
    expect(c.days).toBe(29);
    expect(c.previous).toEqual({ start: '2028-02-01', endExclusive: '2028-03-01' });
  });

  it('kỳ đã hoàn thành: tháng trước vs 2 tháng trước, cắt bằng số ngày nhỏ hơn', () => {
    const c = resolveComparison('month', 'complete', TODAY)!;
    expect(c.currentLabel).toBe('Tháng trước');
    expect(c.current).toEqual({ start: '2026-09-01', endExclusive: '2026-10-01' }); // 30 ngày
    expect(c.previous).toEqual({ start: '2026-08-01', endExclusive: '2026-08-31' }); // cắt 31 -> 30 ngày
    expect(c.days).toBe(30);
  });

  it('tuần đã hoàn thành: tuần trước vs hai tuần trước', () => {
    const c = resolveComparison('week', 'complete', TODAY)!;
    expect(c.current).toEqual({ start: '2026-10-05', endExclusive: '2026-10-12' });
    expect(c.previous).toEqual({ start: '2026-09-28', endExclusive: '2026-10-05' });
    expect(c.partial).toBe(false);
  });

  it('khoảng tùy chọn đã hoàn thành so với khoảng liền trước cùng số ngày', () => {
    const c = resolveComparison('custom', 'toDate', TODAY, { from: '2026-10-01', to: '2026-10-10' })!;
    expect(c.current).toEqual({ start: '2026-10-01', endExclusive: '2026-10-11' });
    expect(c.previous).toEqual({ start: '2026-09-21', endExclusive: '2026-10-01' });
    expect(c.days).toBe(10);
    expect(c.partial).toBe(false);
  });

  it('khoảng tùy chọn có ngày tương lai chỉ so phần đã trôi qua', () => {
    const c = resolveComparison('custom', 'toDate', TODAY, { from: '2026-10-10', to: '2026-10-30' })!;
    expect(c.current).toEqual({ start: '2026-10-10', endExclusive: '2026-10-19' });
    expect(c.previous).toEqual({ start: '2026-10-01', endExclusive: '2026-10-10' });
    expect(c.partial).toBe(true);
  });

  it('khoảng tùy chọn hoàn toàn ở tương lai hoặc sai -> null', () => {
    expect(resolveComparison('custom', 'toDate', TODAY, { from: '2026-11-01', to: '2026-11-10' })).toBeNull();
    expect(resolveComparison('custom', 'toDate', TODAY, { from: '2026-10-10', to: '2026-10-01' })).toBeNull();
  });

  it('mọi cặp so sánh có độ dài hai bên bằng nhau', () => {
    for (const today of ['2026-01-31', '2026-02-28', '2026-03-31', '2028-02-29', '2026-10-18', '2026-12-31']) {
      for (const kind of ['day', 'week', 'month'] as const) {
        for (const basis of ['toDate', 'complete'] as const) {
          const c = resolveComparison(kind, basis, today)!;
          expect(rangeDays(c.current), `${kind} ${basis} ${today}`).toBe(rangeDays(c.previous));
          expect(c.days).toBe(rangeDays(c.current));
        }
      }
    }
  });
});

describe('previousComparableRange (cột "so với kỳ trước" của báo cáo)', () => {
  it('tháng này: tháng lịch liền trước cùng số ngày', () => {
    const r = resolvePreset('thisMonth', TODAY)!;
    const p = previousComparableRange(r, 'thisMonth', TODAY);
    expect(p.current).toEqual({ start: '2026-10-01', endExclusive: '2026-10-19' });
    expect(p.previous).toEqual({ start: '2026-09-01', endExclusive: '2026-09-19' });
    expect(p.partial).toBe(true);
  });
  it('tháng trước (trọn vẹn): so với tháng trước nữa, cắt cho bằng số ngày', () => {
    const r = resolvePreset('lastMonth', TODAY)!; // tháng 9: 30 ngày
    const p = previousComparableRange(r, 'lastMonth', TODAY);
    expect(rangeDays(p.current)).toBe(rangeDays(p.previous));
    expect(p.previous.start).toBe('2026-08-01');
  });
  it('7 ngày gần nhất: lùi đúng 7 ngày', () => {
    const r = resolvePreset('last7', TODAY)!;
    expect(previousComparableRange(r, 'last7', TODAY).previous).toEqual({ start: '2026-10-05', endExclusive: '2026-10-12' });
  });
});
