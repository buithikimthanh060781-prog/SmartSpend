import { describe, expect, it } from 'vitest';
import { periodContaining } from '@/lib/periods';
import { buildMonthAnalytics, monthWindow } from '@/reports/monthAnalytics';
import type { ExpenseRow, IncomeRow } from '@/reports/summary';
import { evaluateAmounts } from '@/services/budgetCalculation';
import type { SsBudget } from '@/types/db';

const TODAY = '2026-10-18';
const cats = [
  { id: 'food', name: 'Ăn uống', is_active: true, color: null, icon: null },
  { id: 'taxi', name: 'Đi lại', is_active: true, color: null, icon: null },
];
const exp = (date: string, amount: number, category = 'food', plan: string | null = null): ExpenseRow => ({ expense_date: date, amount, category_id: category, plan_id: plan });
const inc = (date: string, amount: number, status = 'received'): IncomeRow => ({ income_date: date, amount, status });

function monthBudget(amount: number): SsBudget {
  const p = periodContaining('monthly', TODAY);
  return { id: 'm', user_id: 'u', category_id: null, period_type: 'monthly', period_start: p.start, period_end: p.endExclusive, amount, created_at: '', updated_at: '' };
}

describe('phân tích tháng cho Dashboard', () => {
  it('cửa sổ dữ liệu gồm tháng này và tháng trước', () => {
    expect(monthWindow(TODAY)).toEqual({
      range: { start: '2026-10-01', endExclusive: '2026-11-01' },
      previous: { start: '2026-09-01', endExclusive: '2026-09-19' },
      window: { start: '2026-09-01', endExclusive: '2026-11-01' },
    });
  });

  const incomes = [inc('2026-10-01', 20_000_000), inc('2026-10-03', 9_000_000, 'expected'), inc('2026-09-05', 15_000_000)];
  const expenses = [
    exp('2026-10-02', 800_000), exp('2026-10-05', 300_000, 'taxi'), exp('2026-10-10', 500_000, 'food', 'p'), exp('2026-10-12', 400_000, 'taxi'),
    exp('2026-09-02', 500_000), exp('2026-09-10', 200_000, 'taxi'), exp('2026-09-18', 100_000, 'food'), exp('2026-09-25', 9_999_999), // 25/09 nằm ngoài 18 ngày đầu
  ];

  it('tổng hợp tháng này chỉ gồm received và chi thực tế', () => {
    const a = buildMonthAnalytics(incomes, expenses, cats, TODAY, null, 'VND');
    expect(a.summary.receivedIncome).toBe(20_000_000);
    expect(a.summary.expectedIncome).toBe(9_000_000);
    expect(a.summary.actualExpense).toBe(2_000_000);
    expect(a.summary.netCashFlow).toBe(18_000_000);
    expect(a.summary.plannedExpense).toBe(500_000);
    expect(a.summary.unplannedExpense).toBe(1_500_000);
  });

  it('so sánh với tháng trước CÙNG SỐ NGÀY: chi ngày 25/09 không bị tính', () => {
    const a = buildMonthAnalytics(incomes, expenses, cats, TODAY, null, 'VND');
    expect(a.comparison!.spec.days).toBe(18);
    expect(a.comparison!.previous.actualExpense).toBe(800_000); // 02/09 + 10/09 + 18/09; bỏ 25/09
    expect(a.comparison!.actualExpense).toMatchObject({ current: 2_000_000, previous: 800_000, delta: 1_200_000, changePercent: 150, direction: 'up' });
    expect(a.comparison!.receivedIncome).toMatchObject({ current: 20_000_000, previous: 15_000_000, direction: 'up' });
  });

  it('phân bổ danh mục với thay đổi so với kỳ trước cùng số ngày', () => {
    const a = buildMonthAnalytics(incomes, expenses, cats, TODAY, null, 'VND');
    const food = a.categoryReport.rows.find((r) => r.categoryId === 'food')!;
    expect(food.total).toBe(1_300_000);
    expect(food.sharePercent).toBe(65);
    expect(food.change).toMatchObject({ previous: 600_000, delta: 700_000 });
    expect(a.categoryReport.rows.find((r) => r.categoryId === 'taxi')!.change).toMatchObject({ previous: 200_000 });
  });

  it('chuỗi theo ngày đủ 31 mốc của tháng 10, mốc trống bằng 0', () => {
    const a = buildMonthAnalytics(incomes, expenses, cats, TODAY, null, 'VND');
    expect(a.series).toHaveLength(31);
    expect(a.series[0].income).toBe(20_000_000);
    expect(a.series[1].expense).toBe(800_000);
    expect(a.series[29].expense).toBe(0);
  });

  it('nhận xét: danh mục lớn nhất, ngân sách 85%, chi ngoài kế hoạch tăng, cao hơn cùng giai đoạn', () => {
    const budget = evaluateAmounts(monthBudget(2_352_941), 2_000_000); // ~85%
    const a = buildMonthAnalytics(incomes, expenses, cats, TODAY, budget, 'VND');
    const byId = new Map(a.insights.map((i) => [i.id, i]));
    expect(byId.get('top-category')!.text).toBe('Chi tiêu Ăn uống chiếm 65% tổng chi tháng này.');
    expect(byId.get('budget-warning')!.text).toBe('Bạn đã sử dụng 85% ngân sách tháng.');
    expect(byId.get('unplanned-up')!.text).toMatch(/Chi tiêu ngoài kế hoạch tăng/);
    expect(byId.get('expense-vs-previous')!.text).toBe('Chi tiêu tháng này cao hơn 150% so với cùng giai đoạn tháng trước.');
    for (const i of a.insights) expect(i.evidence.length).toBeGreaterThan(0);
  });

  it('chưa có dữ liệu: không có nhận xét nào, không lỗi', () => {
    const a = buildMonthAnalytics([], [], cats, TODAY, null, 'VND');
    expect(a.insights).toEqual([]);
    expect(a.summary.actualExpense).toBe(0);
    expect(a.categoryReport.rows).toEqual([]);
    expect(a.series).toHaveLength(31);
  });

  it('ngày đầu tháng: so sánh 1 ngày với 1 ngày đầu của tháng trước', () => {
    const a = buildMonthAnalytics([], [exp('2026-10-01', 10), exp('2026-09-01', 4)], cats, '2026-10-01', null, 'VND');
    expect(a.comparison!.spec.days).toBe(1);
    expect(a.comparison!.actualExpense).toMatchObject({ current: 10, previous: 4 });
  });

  it('chuyển tháng 3 -> tháng 2 chỉ 28 ngày: hai bên cùng 28 ngày', () => {
    const a = buildMonthAnalytics([], [exp('2026-03-28', 7), exp('2026-03-30', 99), exp('2026-02-28', 5)], cats, '2026-03-31', null, 'VND');
    expect(a.comparison!.spec.days).toBe(28);
    expect(a.comparison!.actualExpense).toMatchObject({ current: 7, previous: 5 }); // 30/03 nằm ngoài 28 ngày được so sánh
    expect(a.summary.actualExpense).toBe(106); // nhưng tổng của tháng vẫn gồm toàn bộ
  });
});
