import { describe, expect, it } from 'vitest';
import { periodContaining } from '@/lib/periods';
import { buildInsights, type InsightInput } from '@/reports/insights';
import { buildCategoryReport } from '@/reports/categories';
import { compareValues } from '@/reports/comparison';
import { resolvePreset } from '@/reports/ranges';
import { buildFinancialSummary, type ExpenseRow, type IncomeRow } from '@/reports/summary';
import { evaluateAmounts } from '@/services/budgetCalculation';
import type { SsBudget } from '@/types/db';

const TODAY = '2026-10-18';
const MONTH = resolvePreset('thisMonth', TODAY)!;
const exp = (category: string, amount: number, plan: string | null = null, date = '2026-10-05'): ExpenseRow => ({ amount, plan_id: plan, expense_date: date, category_id: category });
const inc = (amount: number): IncomeRow => ({ amount, status: 'received', income_date: '2026-10-01' });
const cats = [{ id: 'food', name: 'Ăn uống', is_active: true, color: null, icon: null }, { id: 'taxi', name: 'Đi lại', is_active: true, color: null, icon: null }];

function budget(amount: number): SsBudget {
  const p = periodContaining('monthly', TODAY);
  return { id: 'b', user_id: 'u', category_id: null, period_type: 'monthly', period_start: p.start, period_end: p.endExclusive, amount, created_at: '', updated_at: '' };
}

function input(over: Partial<InsightInput> & { expenses?: ExpenseRow[]; incomes?: IncomeRow[]; prevExpenses?: ExpenseRow[] }): InsightInput {
  const expenses = over.expenses ?? [];
  const summary = buildFinancialSummary(over.incomes ?? [], expenses, MONTH, TODAY);
  const prevRange = { start: '2026-09-01', endExclusive: '2026-09-19' };
  const prevSummary = over.prevExpenses ? buildFinancialSummary([], over.prevExpenses, prevRange, TODAY) : null;
  return {
    currency: 'VND',
    periodWord: 'tháng này',
    previousWord: 'tháng trước',
    summary,
    previousSummary: prevSummary,
    categories: buildCategoryReport(expenses, cats),
    monthlyBudget: null,
    expenseChange: prevSummary ? compareValues(summary.actualExpense, prevSummary.actualExpense) : null,
    unplannedChange: prevSummary ? compareValues(summary.unplannedExpense, prevSummary.unplannedExpense) : null,
    ...over,
  };
}

const ids = (i: InsightInput) => buildInsights(i).map((x) => x.id);

describe('Smart Insights (rule-based)', () => {
  it('không có dữ liệu thì không có nhận xét nào', () => {
    expect(buildInsights(input({}))).toEqual([]);
  });

  it('chưa đủ giao dịch (dưới 3) thì không đưa ra nhận xét về danh mục', () => {
    expect(ids(input({ expenses: [exp('food', 900), exp('taxi', 100)] }))).toEqual([]);
  });

  it('danh mục chiếm tỷ trọng lớn: nêu đúng tỷ lệ và có số liệu chứng minh', () => {
    const out = buildInsights(input({ expenses: [exp('food', 320), exp('taxi', 340), exp('taxi', 340)] }));
    expect(out.find((x) => x.id === 'top-category')!.text).toBe('Chi tiêu Đi lại chiếm 68% tổng chi tháng này.');
    expect(out.find((x) => x.id === 'top-category')!.evidence).toMatch(/680/);
  });

  it('không nêu danh mục nếu tỷ trọng dưới 25%', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((c) => exp(c, 100));
    expect(ids(input({ expenses: many }))).not.toContain('top-category');
  });

  it('ngân sách tháng: 85% -> cảnh báo mức sử dụng; dưới 80% -> không nói gì', () => {
    const e = [exp('food', 850)];
    expect(buildInsights(input({ expenses: e, monthlyBudget: evaluateAmounts(budget(1000), 850) })).find((x) => x.id === 'budget-warning')!.text).toBe('Bạn đã sử dụng 85% ngân sách tháng.');
    expect(ids(input({ expenses: e, monthlyBudget: evaluateAmounts(budget(1000), 700) }))).not.toContain('budget-warning');
  });

  it('ngân sách tháng: hết và vượt; không có ngân sách thì không có nhận xét ngân sách', () => {
    expect(ids(input({ monthlyBudget: evaluateAmounts(budget(1000), 1000) }))).toContain('budget-exhausted');
    const over = buildInsights(input({ monthlyBudget: evaluateAmounts(budget(1000), 1200) })).find((x) => x.id === 'budget-exceeded')!;
    expect(over.text).toMatch(/vượt ngân sách tháng/);
    expect(ids(input({ monthlyBudget: null }))).toEqual([]);
  });

  it('chi ngoài kế hoạch tăng so với kỳ trước (cùng số ngày)', () => {
    const cur = [exp('food', 300, null), exp('taxi', 200, null), exp('food', 100, 'p')];
    const prev = [exp('food', 200, null, '2026-09-05'), exp('taxi', 100, 'p', '2026-09-06'), exp('food', 100, 'p', '2026-09-07')];
    const out = buildInsights(input({ expenses: cur, prevExpenses: prev }));
    expect(out.find((x) => x.id === 'unplanned-up')!.text).toBe('Chi tiêu ngoài kế hoạch tăng 150% so với tháng trước.');
  });

  it('kỳ trước chưa có chi ngoài kế hoạch: nêu sự thật, không tính tỷ lệ vô hạn', () => {
    const cur = [exp('food', 300), exp('taxi', 200), exp('food', 100)];
    const prev = [exp('food', 100, 'p', '2026-09-05')];
    const t = buildInsights(input({ expenses: cur, prevExpenses: prev })).find((x) => x.id === 'unplanned-up')!.text;
    expect(t).toMatch(/chưa có/);
    expect(t).not.toMatch(/Infinity|∞|NaN/);
  });

  it('tổng chi cao hơn/thấp hơn cùng giai đoạn kỳ trước: diễn đạt trung bình, không phán xét', () => {
    const cur = [exp('food', 600), exp('taxi', 300), exp('food', 100)];
    const higher = buildInsights(input({ expenses: cur, prevExpenses: [exp('food', 500, null, '2026-09-05')] })).find((x) => x.id === 'expense-vs-previous')!;
    expect(higher.text).toBe('Chi tiêu tháng này cao hơn 100% so với cùng giai đoạn tháng trước.');
    expect(higher.tone).toBe('info');
    const lower = buildInsights(input({ expenses: cur, prevExpenses: [exp('food', 5000, null, '2026-09-05')] })).find((x) => x.id === 'expense-vs-previous')!;
    expect(lower.text).toMatch(/thấp hơn 80%/);
    expect(lower.tone).toBe('info');
    expect(`${higher.text}${lower.text}`).not.toMatch(/tệ|xấu|tốt|nên|khuyên/);
  });

  it('không so sánh khi kỳ trước không có dữ liệu', () => {
    expect(ids(input({ expenses: [exp('food', 600), exp('taxi', 300), exp('food', 100)], prevExpenses: [] }))).not.toContain('expense-vs-previous');
  });

  it('chi vượt thu nhập thực nhận: chỉ nêu khi có thu nhập thực nhận', () => {
    const e = [exp('food', 600), exp('taxi', 300), exp('food', 400)];
    expect(buildInsights(input({ expenses: e, incomes: [inc(1000)] })).find((x) => x.id === 'net-negative')!.text).toMatch(/lớn hơn thu nhập thực nhận 300/);
    expect(ids(input({ expenses: e }))).not.toContain('net-negative');
  });

  it('mọi nhận xét đều có số liệu chứng minh và không có lời khuyên đầu tư', () => {
    const out = buildInsights(input({
      expenses: [exp('food', 900), exp('taxi', 200), exp('food', 100)],
      incomes: [inc(1000)],
      monthlyBudget: evaluateAmounts(budget(1000), 1200),
      prevExpenses: [exp('food', 500, null, '2026-09-05')],
    }));
    expect(out.length).toBeGreaterThanOrEqual(3);
    for (const i of out) {
      expect(i.evidence.length).toBeGreaterThan(5);
      expect(`${i.text} ${i.evidence}`).not.toMatch(/đầu tư|\bAI\b|dự đoán/);
    }
  });
});
