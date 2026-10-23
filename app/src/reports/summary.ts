import { round2, subtractMoney, sumMoney, type NumericValue } from '@/lib/money';
import { percentOf } from '@/reports/comparison';
import { elapsedDays, inRange, type DateRange } from '@/reports/ranges';

/** Cột tối thiểu mà báo cáo cần từ ss_incomes. */
export interface IncomeRow {
  amount: NumericValue;
  status: string;
  income_date: string;
  category_id?: string;
}

/** Cột tối thiểu mà báo cáo cần từ ss_expenses. */
export interface ExpenseRow {
  amount: NumericValue;
  plan_id: string | null;
  expense_date: string;
  category_id: string;
}

export interface FinancialSummary {
  /** Chỉ thu nhập status = 'received'. Thu nhập 'expected' KHÔNG nằm trong đây. */
  receivedIncome: number;
  expectedIncome: number;
  /** Chi tiêu thực tế (ss_expenses). Kế hoạch chưa thực hiện/planned_amount không bao giờ được cộng vào. */
  actualExpense: number;
  /** receivedIncome - actualExpense (có thể âm). */
  netCashFlow: number;
  /** actualExpense / receivedIncome * 100; null khi receivedIncome = 0 (không áp dụng). */
  expenseToIncomeRatio: number | null;
  plannedExpense: number;
  unplannedExpense: number;
  /** unplannedExpense / actualExpense * 100; null khi actualExpense = 0. */
  unplannedExpenseRatio: number | null;
  daysWithExpense: number;
  /** Số ngày đã trôi qua trong kỳ (kỳ chưa kết thúc chỉ tính đến hết hôm nay). */
  elapsedDays: number;
  /** actualExpense / elapsedDays, làm tròn 2 chữ số thập phân (chỉ số phái sinh để hiển thị); null khi elapsedDays = 0. */
  avgExpensePerDay: number | null;
  incomeCount: number;
  expenseCount: number;
}

/**
 * Tổng hợp tài chính của một khoảng ngày [start, endExclusive). Mọi phép cộng là số thập phân chính xác;
 * dữ liệu tiền không hợp lệ làm hàm ném lỗi (không bị coi là 0). Dòng ngoài khoảng bị bỏ qua.
 */
export function buildFinancialSummary(
  incomes: readonly IncomeRow[],
  expenses: readonly ExpenseRow[],
  range: DateRange,
  today: string,
): FinancialSummary {
  const inc = incomes.filter((r) => inRange(r.income_date, range));
  const exp = expenses.filter((r) => inRange(r.expense_date, range));

  const received = inc.filter((r) => r.status === 'received');
  const expected = inc.filter((r) => r.status === 'expected');
  const planned = exp.filter((r) => r.plan_id !== null);

  const receivedIncome = sumMoney(received, (r) => r.amount);
  const actualExpense = sumMoney(exp, (r) => r.amount);
  const plannedExpense = sumMoney(planned, (r) => r.amount);
  const unplannedExpense = subtractMoney(actualExpense, plannedExpense);
  const days = elapsedDays(range, today);

  return {
    receivedIncome,
    expectedIncome: sumMoney(expected, (r) => r.amount),
    actualExpense,
    netCashFlow: subtractMoney(receivedIncome, actualExpense),
    expenseToIncomeRatio: percentOf(actualExpense, receivedIncome),
    plannedExpense,
    unplannedExpense,
    unplannedExpenseRatio: percentOf(unplannedExpense, actualExpense),
    daysWithExpense: new Set(exp.map((r) => r.expense_date)).size,
    elapsedDays: days,
    avgExpensePerDay: days > 0 ? round2(actualExpense / days) : null,
    incomeCount: received.length,
    expenseCount: exp.length,
  };
}
