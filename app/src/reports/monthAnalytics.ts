import { buildCategoryReport, withComparableChanges, type CategoryReport, type CategoryRef } from '@/reports/categories';
import { compareValues } from '@/reports/comparison';
import { buildInsights, type Insight } from '@/reports/insights';
import { buildPeriodComparison, type PeriodComparison } from '@/reports/periodComparison';
import { inRange, previousComparableRange, rangeDays, resolvePreset, type ComparisonSpec, type DateRange } from '@/reports/ranges';
import { buildSeries, type Bucket, type Granularity } from '@/reports/series';
import { buildFinancialSummary, type ExpenseRow, type FinancialSummary, type IncomeRow } from '@/reports/summary';
import type { BudgetEvaluation } from '@/services/budgetCalculation';

export interface MonthAnalytics {
  range: DateRange;
  summary: FinancialSummary;
  /** So với tháng trước CÙNG SỐ NGÀY đã trôi qua; null nếu tháng chưa có ngày nào trôi qua. */
  comparison: PeriodComparison | null;
  categoryReport: CategoryReport;
  series: Bucket[];
  insights: Insight[];
}

/** Cửa sổ dữ liệu cần tải cho Dashboard: tháng hiện tại và tháng liền trước (để so sánh công bằng). */
export function monthWindow(today: string): { range: DateRange; previous: DateRange; window: DateRange } {
  const range = resolvePreset('thisMonth', today) as DateRange;
  const cmp = previousComparableRange(range, 'thisMonth', today);
  return {
    range,
    previous: cmp.previous,
    window: { start: cmp.previous.start < range.start ? cmp.previous.start : range.start, endExclusive: range.endExclusive },
  };
}

/**
 * Phân tích tháng hiện tại cho Dashboard từ dữ liệu của cả hai tháng. Hàm thuần: cùng đầu vào cho cùng kết quả.
 * `monthlyBudget` là đánh giá ngân sách tổng THÁNG đang áp dụng (null nếu chưa thiết lập).
 * Nhận xét (insights) chỉ dựa trên quy tắc tính toán, không phải dự đoán bằng AI.
 */
export function buildMonthAnalytics(
  incomes: readonly IncomeRow[],
  expenses: readonly ExpenseRow[],
  categories: readonly CategoryRef[],
  today: string,
  monthlyBudget: BudgetEvaluation | null,
  currency: string,
  granularity: Granularity = 'day',
): MonthAnalytics {
  const { range } = monthWindow(today);
  const cmp = previousComparableRange(range, 'thisMonth', today);
  const days = rangeDays(cmp.current);

  const spec: ComparisonSpec = {
    current: cmp.current,
    previous: cmp.previous,
    days,
    partial: cmp.partial,
    currentLabel: 'Tháng này',
    previousLabel: 'Tháng trước',
  };
  const comparison = days > 0 ? buildPeriodComparison(spec, incomes, expenses, categories, today) : null;

  const rangeExpenses = expenses.filter((e) => inRange(e.expense_date, range));
  const previousExpenses = expenses.filter((e) => inRange(e.expense_date, cmp.previous));
  const comparableExpenses = expenses.filter((e) => inRange(e.expense_date, cmp.current));
  const categoryReport = withComparableChanges(buildCategoryReport(rangeExpenses, categories, previousExpenses), comparableExpenses, previousExpenses);

  // Nhận xét so sánh dùng số liệu của cùng số ngày ở hai tháng (so sánh công bằng).
  const summary = buildFinancialSummary(incomes, expenses, range, today);
  const insights = buildInsights({
    currency,
    periodWord: 'tháng này',
    previousWord: 'tháng trước',
    summary,
    previousSummary: comparison?.previous ?? null,
    categories: categoryReport,
    monthlyBudget,
    expenseChange: comparison ? compareValues(comparison.current.actualExpense, comparison.previous.actualExpense) : null,
    unplannedChange: comparison ? compareValues(comparison.current.unplannedExpense, comparison.previous.unplannedExpense) : null,
  });

  return { range, summary, comparison, categoryReport, series: buildSeries(incomes, expenses, range, granularity), insights };
}
