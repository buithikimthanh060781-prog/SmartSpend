import { describe, expect, it } from 'vitest';
import { buildCategoryReport, UNKNOWN_CATEGORY_NAME, type CategoryRef } from '@/reports/categories';
import type { ExpenseRow } from '@/reports/summary';

const cat = (id: string, name: string, active = true): CategoryRef => ({ id, name, is_active: active, color: null, icon: null });
const exp = (category: string, amount: number | string, date = '2026-10-05'): ExpenseRow => ({ amount, plan_id: null, expense_date: date, category_id: category });

const categories = [cat('food', 'Ăn uống'), cat('taxi', 'Đi lại'), cat('old', 'Danh mục cũ', false)];

describe('chi tiêu theo danh mục', () => {
  const expenses = [exp('food', 300), exp('food', 100), exp('taxi', 100), exp('old', 500)];
  const report = buildCategoryReport(expenses, categories);

  it('tổng, số giao dịch, tỷ trọng, trung bình mỗi giao dịch; sắp xếp giảm dần', () => {
    expect(report.total).toBe(1000);
    expect(report.rows.map((r) => r.categoryId)).toEqual(['old', 'food', 'taxi']);
    const food = report.rows.find((r) => r.categoryId === 'food')!;
    expect(food).toMatchObject({ total: 400, count: 2, sharePercent: 40, avgPerTransaction: 200, known: true });
  });

  it('danh mục đã ngừng hoạt động vẫn hiển thị trong báo cáo lịch sử', () => {
    const old = report.rows.find((r) => r.categoryId === 'old')!;
    expect(old).toMatchObject({ name: 'Danh mục cũ', isActive: false, known: true, total: 500, sharePercent: 50 });
  });

  it('tỷ trọng cộng lại đúng 100%', () => {
    expect(report.rows.reduce((s, r) => s + (r.sharePercent ?? 0), 0)).toBeCloseTo(100, 10);
  });

  it('danh mục không còn trong danh sách hiển thị là "Chưa phân loại" nhưng số liệu không mất', () => {
    const r = buildCategoryReport([exp('ghost', 70), exp('food', 30)], categories);
    expect(r.total).toBe(100);
    const ghost = r.rows.find((x) => x.categoryId === 'ghost')!;
    expect(ghost).toMatchObject({ name: UNKNOWN_CATEGORY_NAME, known: false, total: 70 });
  });

  it('không có chi tiêu: báo cáo rỗng, tỷ trọng null, không chia cho 0', () => {
    const r = buildCategoryReport([], categories);
    expect(r).toEqual({ rows: [], total: 0, count: 0 });
  });

  it('cộng thập phân chính xác', () => {
    const r = buildCategoryReport([exp('food', '0.1'), exp('food', '0.2')], categories);
    expect(r.rows[0].total).toBe(0.3);
  });
});

describe('so sánh với kỳ trước theo danh mục', () => {
  const previous = [exp('food', 200, '2026-09-05'), exp('taxi', 100, '2026-09-06'), exp('gone', 50, '2026-09-07')];
  const current = [exp('food', 300), exp('new', 40)];
  const r = buildCategoryReport(current, [...categories, cat('new', 'Mới'), cat('gone', 'Đã hết chi')], previous);

  it('tăng/giảm và tỷ lệ thay đổi', () => {
    expect(r.rows.find((x) => x.categoryId === 'food')!.change).toMatchObject({ delta: 100, changePercent: 50, direction: 'up' });
  });
  it('danh mục chỉ có ở kỳ này: không có tỷ lệ tăng trưởng vô hạn', () => {
    const c = r.rows.find((x) => x.categoryId === 'new')!.change!;
    expect(c.previousIsZero).toBe(true);
    expect(c.changePercent).toBeNull();
    expect(c.delta).toBe(40);
  });
  it('danh mục chỉ có ở kỳ trước vẫn được liệt kê với kỳ này = 0', () => {
    const taxi = r.rows.find((x) => x.categoryId === 'taxi')!;
    expect(taxi).toMatchObject({ total: 0, count: 0, sharePercent: 0, avgPerTransaction: null });
    expect(taxi.change).toMatchObject({ delta: -100, changePercent: -100, direction: 'down' });
  });
  it('không truyền kỳ trước thì không có cột so sánh', () => {
    expect(buildCategoryReport(current, categories).rows.every((x) => x.change === null)).toBe(true);
  });
});
