import { compareMoney, comparePercent, subtractMoney, sumMoney, toMoney, type NumericValue } from '@/lib/money';
import type { SsBudget } from '@/types/db';

/** Cột tối thiểu của ss_expenses mà engine cần. planned_amount của kế hoạch KHÔNG bao giờ được đưa vào đây. */
export interface ExpenseLite {
  user_id?: string;
  category_id: string;
  amount: NumericValue;
  expense_date: string;
}

export type BudgetStatus = 'safe' | 'warning' | 'exhausted' | 'exceeded';

export interface BudgetEvaluation {
  budget: SsBudget;
  amount: number;
  spent: number;
  /** amount - spent; âm khi đã vượt. */
  remaining: number;
  /** MAX(0, spent - amount). */
  overspent: number;
  /** spent / amount * 100, chỉ để HIỂN THỊ. null khi amount = 0 (không chia cho 0). Trạng thái KHÔNG dựa vào số này. */
  usagePercent: number | null;
  status: BudgetStatus;
}

export const STATUS_LABEL: Record<BudgetStatus, string> = {
  safe: 'An toàn',
  warning: 'Sắp hết',
  exhausted: 'Hết hạn mức',
  exceeded: 'Vượt hạn mức',
};

export const WARNING_PERCENT = 80;
export const LIMIT_PERCENT = 100;

/** Chi tiêu thuộc phạm vi một ngân sách: cùng user, trong [period_start, period_end), đúng danh mục nếu là ngân sách danh mục. */
export function expensesOfBudget(budget: SsBudget, expenses: readonly ExpenseLite[]): ExpenseLite[] {
  return expenses.filter(
    (e) =>
      (e.user_id === undefined || e.user_id === budget.user_id) &&
      e.expense_date >= budget.period_start &&
      e.expense_date < budget.period_end &&
      (budget.category_id === null || e.category_id === budget.category_id),
  );
}

/** Tổng thực chi (cả chi trong và ngoài kế hoạch). Tính chính xác bằng số thập phân. */
export function computeSpent(budget: SsBudget, expenses: readonly ExpenseLite[]): number {
  return sumMoney(expensesOfBudget(budget, expenses), (e) => e.amount);
}

/**
 * Trạng thái theo so sánh số thập phân chính xác, không làm tròn phần trăm trước:
 * - amount > 0:  < 80% safe; 80% đến < 100% warning; = 100% exhausted; > 100% exceeded.
 * - amount = 0:  spent = 0 -> exhausted (hết hạn mức nhưng chưa vượt); spent > 0 -> exceeded. Không chia cho 0.
 */
export function statusOf(amount: NumericValue, spent: NumericValue): BudgetStatus {
  if (compareMoney(amount, 0) === 0) return compareMoney(spent, 0) > 0 ? 'exceeded' : 'exhausted';
  const vsLimit = comparePercent(spent, amount, LIMIT_PERCENT);
  if (vsLimit > 0) return 'exceeded';
  if (vsLimit === 0) return 'exhausted';
  return comparePercent(spent, amount, WARNING_PERCENT) >= 0 ? 'warning' : 'safe';
}

export function evaluateAmounts(budget: SsBudget, spentValue: NumericValue): BudgetEvaluation {
  const amount = toMoney(budget.amount);
  const spent = toMoney(spentValue);
  const remaining = subtractMoney(amount, spent);
  return {
    budget,
    amount,
    spent,
    remaining,
    overspent: remaining < 0 ? subtractMoney(spent, amount) : 0,
    usagePercent: amount > 0 ? (spent / amount) * 100 : null,
    status: statusOf(amount, spent),
  };
}

export function evaluateBudget(budget: SsBudget, expenses: readonly ExpenseLite[]): BudgetEvaluation {
  return evaluateAmounts(budget, computeSpent(budget, expenses));
}

/**
 * Đánh giá từng ngân sách ĐỘC LẬP. Một khoản chi có thể được tính đồng thời vào ngân sách ngày, tuần, tháng và danh mục:
 * đó là các góc nhìn khác nhau nên tuyệt đối không cộng chúng với nhau (không có hàm tổng hợp nào ở đây).
 */
export function evaluateBudgets(budgets: readonly SsBudget[], expenses: readonly ExpenseLite[]): BudgetEvaluation[] {
  return budgets.map((b) => evaluateBudget(b, expenses));
}

/** Phần trăm hiển thị: làm tròn XUỐNG 1 chữ số thập phân để không bao giờ hiện 100% khi chưa chạm 100%. */
export function formatPercent(percent: number | null): string {
  if (percent === null) return '—';
  const floored = Math.floor(percent * 10) / 10;
  return `${floored.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
}

/**
 * Thay đổi hạn mức có ảnh hưởng lớn (cần xác nhận): hạn mức mới thấp hơn mức đã chi, đưa về 0 khi đã có chi tiêu,
 * hoặc thay đổi từ 50% trở lên so với hạn mức cũ.
 */
export function isMajorChange(oldAmount: NumericValue, newAmount: NumericValue, spent: NumericValue): boolean {
  if (compareMoney(newAmount, oldAmount) === 0) return false;
  if (compareMoney(newAmount, spent) < 0) return true;
  if (compareMoney(oldAmount, 0) === 0) return false;
  // |new - old| * 100 >= old * 50, so sánh chính xác bằng comparePercent trên giá trị chênh lệch.
  const diff = Math.abs(subtractMoney(newAmount, oldAmount));
  return comparePercent(diff, oldAmount, 50) >= 0;
}
