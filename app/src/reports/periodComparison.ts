import { compareValues, type Comparison } from '@/reports/comparison';
import { buildCategoryReport, type CategoryRef, type CategoryReport } from '@/reports/categories';
import type { ComparisonSpec } from '@/reports/ranges';
import { buildFinancialSummary, type ExpenseRow, type FinancialSummary, type IncomeRow } from '@/reports/summary';

export interface PeriodComparison {
  spec: ComparisonSpec;
  current: FinancialSummary;
  previous: FinancialSummary;
  receivedIncome: Comparison;
  actualExpense: Comparison;
  netCashFlow: Comparison;
  plannedExpense: Comparison;
  unplannedExpense: Comparison;
  avgExpensePerDay: Comparison | null;
  categories: CategoryReport;
}

/**
 * So sánh hai khoảng có CÙNG SỐ NGÀY (xem resolveComparison). Chỉ mô tả chênh lệch, không kết luận tăng là xấu hay giảm là tốt.
 * Truyền toàn bộ dữ liệu của cả hai khoảng; hàm tự lọc đúng khoảng.
 */
export function buildPeriodComparison(
  spec: ComparisonSpec,
  incomes: readonly IncomeRow[],
  expenses: readonly ExpenseRow[],
  categories: readonly CategoryRef[],
  today: string,
): PeriodComparison {
  const current = buildFinancialSummary(incomes, expenses, spec.current, today);
  const previous = buildFinancialSummary(incomes, expenses, spec.previous, today);
  const inRangeOf = (r: { start: string; endExclusive: string }) => expenses.filter((e) => e.expense_date >= r.start && e.expense_date < r.endExclusive);
  return {
    spec,
    current,
    previous,
    receivedIncome: compareValues(current.receivedIncome, previous.receivedIncome),
    actualExpense: compareValues(current.actualExpense, previous.actualExpense),
    netCashFlow: compareValues(current.netCashFlow, previous.netCashFlow),
    plannedExpense: compareValues(current.plannedExpense, previous.plannedExpense),
    unplannedExpense: compareValues(current.unplannedExpense, previous.unplannedExpense),
    avgExpensePerDay:
      current.avgExpensePerDay !== null && previous.avgExpensePerDay !== null ? compareValues(current.avgExpensePerDay, previous.avgExpensePerDay) : null,
    categories: buildCategoryReport(inRangeOf(spec.current), categories, inRangeOf(spec.previous)),
  };
}
