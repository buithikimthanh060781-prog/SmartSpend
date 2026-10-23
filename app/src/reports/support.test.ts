import { describe, expect, it } from 'vitest';
import { describeChange } from '@/components/reports/ChangeBadge';
import { categoryNamer, describeFilters, seriesSheet } from '@/export/datasets';
import { buildCsv } from '@/export/csv';
import { chunk, fetchAllRows, RowLimitError } from '@/lib/paginate';
import { round2 } from '@/lib/money';
import { toMutationMessage } from '@/lib/errors';
import { buildCategoryReport, UNKNOWN_CATEGORY_NAME, withComparableChanges } from '@/reports/categories';
import { compareValues } from '@/reports/comparison';
import { resolvePreset } from '@/reports/ranges';
import { buildSeries } from '@/reports/series';
import type { ExpenseRow } from '@/reports/summary';

const exp = (date: string, amount: number, category = 'food'): ExpenseRow => ({ expense_date: date, amount, category_id: category, plan_id: null });

describe('giới hạn dòng khi tải dữ liệu lớn', () => {
  const table = (n: number) => async (from: number, to: number) => ({ data: Array.from({ length: Math.max(0, Math.min(to + 1, n) - from) }, (_, i) => from + i), error: null });

  it('vượt giới hạn thì báo lỗi rõ ràng thay vì cắt âm thầm', async () => {
    await expect(fetchAllRows<number>(table(5000), 3000)).rejects.toThrow(RowLimitError);
    await expect(fetchAllRows<number>(table(5000), 3000)).rejects.toThrow(/vượt quá 3\.000 dòng/);
  });
  it('không vượt giới hạn thì lấy đủ mọi dòng qua nhiều trang', async () => {
    expect(await fetchAllRows<number>(table(2500), 50_000)).toHaveLength(2500);
  });
  it('lỗi giới hạn dòng hiển thị nguyên văn cho người dùng', () => {
    expect(toMutationMessage(new RowLimitError(50_000))).toMatch(/thu hẹp bộ lọc/);
  });
  it('chunk chia nhóm đều và giữ nguyên thứ tự (tránh URL quá dài với .in())', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
    expect(chunk(Array.from({ length: 250 }, (_, i) => i), 100).map((c) => c.length)).toEqual([100, 100, 50]);
  });
});

describe('so sánh danh mục khi hai kỳ khác độ dài', () => {
  const cats = [{ id: 'food', name: 'Ăn uống', is_active: true, color: null, icon: null }];
  it('tổng hiển thị là cả kỳ, nhưng thay đổi tính trên cùng số ngày', () => {
    const wholePeriod = [exp('2026-03-05', 100), exp('2026-03-30', 900)]; // 30/03 nằm ngoài phần so sánh
    const comparable = [exp('2026-03-05', 100)];
    const previous = [exp('2026-02-05', 40)];
    const r = withComparableChanges(buildCategoryReport(wholePeriod, cats, previous), comparable, previous);
    expect(r.rows[0].total).toBe(1000);
    expect(r.rows[0].change).toMatchObject({ current: 100, previous: 40, delta: 60 });
  });
  it('danh mục không còn trong danh sách vẫn có tên an toàn', () => {
    expect(categoryNamer(cats)('ghost')).toBe(UNKNOWN_CATEGORY_NAME);
  });
});

describe('mô tả thay đổi (trung bình, không phán xét)', () => {
  it('tăng, giảm, không đổi, kỳ trước bằng 0', () => {
    expect(describeChange(compareValues(150, 100), 'VND')).toMatch(/^tăng 50\s*₫ \(50%\)$/); // Intl dùng khoảng trắng không ngắt trước ₫
    expect(describeChange(compareValues(50, 100), 'VND')).toMatch(/^giảm/);
    expect(describeChange(compareValues(100, 100), 'VND')).toBe('Không đổi so với kỳ trước');
    expect(describeChange(compareValues(100, 0), 'VND')).toMatch(/kỳ trước bằng 0, không tính tỷ lệ/);
    expect(describeChange(compareValues(0, 0), 'VND')).toMatch(/cả hai kỳ đều bằng 0/);
  });
  it('không dùng từ ngữ đánh giá tốt/xấu', () => {
    for (const [a, b] of [[150, 100], [50, 100], [100, 0]] as const) expect(describeChange(compareValues(a, b), 'VND')).not.toMatch(/tốt|xấu|tệ|nguy/);
  });
});

describe('tiện ích xuất', () => {
  it('describeFilters ghi rõ bộ lọc hoặc ghi không lọc', () => {
    expect(describeFilters([['Từ khóa', 'cà phê'], ['Danh mục', ''], ['Từ ngày', '2026-10-01']])).toBe('Bộ lọc: Từ khóa: cà phê; Từ ngày: 2026-10-01.');
    expect(describeFilters([['Từ khóa', ''], ['Danh mục', undefined]])).toMatch(/Không áp dụng bộ lọc/);
  });
  it('sheet theo thời gian có đủ mốc, kể cả mốc 0, và tổng đúng', () => {
    const r = resolvePreset('custom', '2026-10-18', { from: '2026-10-01', to: '2026-10-05' })!;
    const buckets = buildSeries([], [exp('2026-10-02', 10.5), exp('2026-10-04', 4.5)], r, 'day');
    const sheet = seriesSheet(buckets, 'Theo ngày', 'x');
    expect(sheet.rows).toHaveLength(5);
    expect(sheet.totals![0]).toEqual(['Tổng cộng', null, 0, 15, -15]);
    const csv = buildCsv(sheet.columns, sheet.rows, sheet.totals);
    expect(csv.split('\r\n')).toHaveLength(1 + 5 + 1 + 1); // tiêu đề + 5 mốc + tổng + dòng cuối rỗng
  });
  it('round2 chỉ để hiển thị các chỉ số phái sinh', () => {
    expect(round2(116666.68055555)).toBe(116666.68);
    expect(round2(1 / 3)).toBe(0.33);
  });
});
