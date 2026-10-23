import { chunk, fetchAllRows } from '@/lib/paginate';
import { supabase } from '@/lib/supabase';
import type { DateRange } from '@/reports/ranges';
import type { LinkedExpense } from '@/reports/plans';
import type { ExpenseRow, IncomeRow } from '@/reports/summary';
import type { SsExpensePlan } from '@/types/db';

/** Giới hạn số dòng cho một lần tải báo cáo; vượt quá thì báo lỗi rõ ràng thay vì cắt âm thầm. */
export const REPORT_MAX_ROWS = 100_000;

export interface ReportIncome extends IncomeRow {
  id: string;
  category_id: string;
  description: string;
  note: string | null;
}

export interface ReportExpense extends ExpenseRow {
  id: string;
  payment_method: string;
  description: string;
  note: string | null;
}

const INCOME_COLUMNS = 'id, category_id, amount, income_date, status, description, note';
const EXPENSE_COLUMNS = 'id, category_id, plan_id, amount, expense_date, payment_method, description, note';

/**
 * Thu nhập và chi tiêu của người dùng trong một cửa sổ ngày [start, endExclusive). Một truy vấn phân trang cho mỗi bảng
 * (không phải mỗi kỳ, không N+1). Cửa sổ thường là hợp của kỳ báo cáo và kỳ so sánh liền trước.
 */
export async function fetchPeriodData(userId: string, window: DateRange): Promise<{ incomes: ReportIncome[]; expenses: ReportExpense[] }> {
  const [incomes, expenses] = await Promise.all([
    fetchAllRows<ReportIncome>(
      (from, to) =>
        supabase
          .from('ss_incomes')
          .select(INCOME_COLUMNS)
          .eq('user_id', userId)
          .gte('income_date', window.start)
          .lt('income_date', window.endExclusive)
          .order('income_date', { ascending: false })
          .order('id')
          .range(from, to)
          .returns<ReportIncome[]>(),
      REPORT_MAX_ROWS,
    ),
    fetchAllRows<ReportExpense>(
      (from, to) =>
        supabase
          .from('ss_expenses')
          .select(EXPENSE_COLUMNS)
          .eq('user_id', userId)
          .gte('expense_date', window.start)
          .lt('expense_date', window.endExclusive)
          .order('expense_date', { ascending: false })
          .order('id')
          .range(from, to)
          .returns<ReportExpense[]>(),
      REPORT_MAX_ROWS,
    ),
  ]);
  return { incomes, expenses };
}

const PLAN_ID_CHUNK = 100; // tránh URL quá dài với `.in(...)`

/**
 * Kế hoạch có planned_date trong kỳ, cùng MỌI giao dịch liên kết với các kế hoạch đó (không giới hạn theo ngày giao dịch),
 * để so sánh dự kiến và thực chi trên cùng một tập kế hoạch.
 */
export async function fetchPlanData(userId: string, range: DateRange): Promise<{ plans: SsExpensePlan[]; linked: LinkedExpense[] }> {
  const plans = await fetchAllRows<SsExpensePlan>(
    (from, to) =>
      supabase
        .from('ss_expense_plans')
        .select('*')
        .eq('user_id', userId)
        .gte('planned_date', range.start)
        .lt('planned_date', range.endExclusive)
        .order('planned_date', { ascending: false })
        .order('id')
        .range(from, to)
        .returns<SsExpensePlan[]>(),
    REPORT_MAX_ROWS,
  );

  const groups = await Promise.all(
    chunk(
      plans.map((p) => p.id),
      PLAN_ID_CHUNK,
    ).map((ids) =>
      fetchAllRows<LinkedExpense>(
        (from, to) =>
          supabase.from('ss_expenses').select('plan_id, amount').eq('user_id', userId).in('plan_id', ids).order('id').range(from, to).returns<LinkedExpense[]>(),
        REPORT_MAX_ROWS,
      ),
    ),
  );
  return { plans, linked: groups.flat() };
}
