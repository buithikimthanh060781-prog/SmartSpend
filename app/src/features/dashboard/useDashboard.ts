import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { resolveMonthlyBudget, type BudgetLookup } from '@/lib/budget';
import { currentMonthRange, type MonthRange } from '@/lib/dates';
import { subtractMoney, sumMoney, toMoney } from '@/lib/money';
import { fetchAllRows } from '@/lib/paginate';
import { supabase } from '@/lib/supabase';
import type { SsBudget, SsCategory, SsExpense, SsIncome, SsSettings } from '@/types/db';

export interface RecentTransaction {
  id: string;
  kind: 'income' | 'expense';
  date: string;
  description: string;
  categoryName: string;
  amount: number;
}

export interface DashboardData {
  month: MonthRange;
  currency: string;
  income: number;
  expense: number;
  budget: BudgetLookup;
  /** Hạn mức tháng; null chỉ khi chưa thiết lập. 0 là hạn mức hợp lệ. */
  budgetLimit: number | null;
  remaining: number | null;
  plannedExpense: number;
  unplannedExpense: number;
  /** Các giao dịch mới nhất, TRONG MỌI THỜI ĐIỂM (không giới hạn ở tháng hiện tại). */
  recent: RecentTransaction[];
}

export const RECENT_LIMIT = 8;

// 'received' là giá trị mặc định đã xác nhận của ss_incomes.status. Các giá trị khác chưa được xác minh.
const INCOME_RECEIVED = 'received';

type ExpenseAmount = Pick<SsExpense, 'amount' | 'plan_id'>;
type IncomeAmount = Pick<SsIncome, 'amount'>;

async function fetchDashboard(userId: string): Promise<DashboardData> {
  // RLS đã giới hạn theo auth.uid(); vẫn lọc user_id tường minh để rõ ràng.
  const settingsRes = await supabase.from('ss_settings').select('*').eq('user_id', userId).maybeSingle<SsSettings>();
  if (settingsRes.error) throw settingsRes.error;
  if (!settingsRes.data) throw new Error('Tài khoản chưa được khởi tạo (thiếu ss_settings).');

  const { currency, timezone } = settingsRes.data;
  const month = currentMonthRange(timezone);

  const [monthIncomes, monthExpenses, budgetsRes, categoriesRes, recentIncomesRes, recentExpensesRes] = await Promise.all([
    // Cộng tiền: lấy TOÀN BỘ dòng trong tháng (phân trang), chỉ các cột cần thiết.
    fetchAllRows<IncomeAmount>((from, to) =>
      supabase
        .from('ss_incomes')
        .select('amount')
        .eq('user_id', userId)
        .eq('status', INCOME_RECEIVED)
        .gte('income_date', month.start)
        .lt('income_date', month.endExclusive)
        .order('id')
        .range(from, to)
        .returns<IncomeAmount[]>(),
    ),
    fetchAllRows<ExpenseAmount>((from, to) =>
      supabase
        .from('ss_expenses')
        .select('amount, plan_id')
        .eq('user_id', userId)
        .gte('expense_date', month.start)
        .lt('expense_date', month.endExclusive)
        .order('id')
        .range(from, to)
        .returns<ExpenseAmount[]>(),
    ),
    // Ngân sách tổng (category_id null), loại 'monthly', đúng khoảng [đầu tháng, đầu tháng kế tiếp).
    // resolveMonthlyBudget kiểm tra lại các điều kiện này trên dữ liệu trả về.
    supabase
      .from('ss_budgets')
      .select('*')
      .eq('user_id', userId)
      .is('category_id', null)
      .eq('period_type', 'monthly')
      .eq('period_start', month.start)
      .eq('period_end', month.endExclusive)
      .returns<SsBudget[]>(),
    supabase.from('ss_categories').select('id, name').eq('user_id', userId).returns<Pick<SsCategory, 'id' | 'name'>[]>(),
    supabase
      .from('ss_incomes')
      .select('*')
      .eq('user_id', userId)
      .eq('status', INCOME_RECEIVED)
      .order('income_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT)
      .returns<SsIncome[]>(),
    supabase
      .from('ss_expenses')
      .select('*')
      .eq('user_id', userId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT)
      .returns<SsExpense[]>(),
  ]);

  for (const res of [budgetsRes, categoriesRes, recentIncomesRes, recentExpensesRes]) {
    if (res.error) throw res.error;
  }

  const categoryName = new Map((categoriesRes.data ?? []).map((c) => [c.id, c.name]));
  const nameOf = (id: string) => categoryName.get(id) ?? 'Chưa phân loại';

  const income = sumMoney(monthIncomes, (r) => r.amount);
  const expense = sumMoney(monthExpenses, (r) => r.amount);
  const plannedExpense = sumMoney(
    monthExpenses.filter((e) => e.plan_id !== null),
    (r) => r.amount,
  );
  const unplannedExpense = subtractMoney(expense, plannedExpense);

  const budget = resolveMonthlyBudget(budgetsRes.data ?? [], month);
  const budgetLimit = budget.status === 'set' ? budget.amount : null;

  const recent: RecentTransaction[] = [
    ...(recentIncomesRes.data ?? []).map<RecentTransaction>((r) => ({
      id: r.id,
      kind: 'income',
      date: r.income_date,
      description: r.description,
      categoryName: nameOf(r.category_id),
      amount: toMoney(r.amount),
    })),
    ...(recentExpensesRes.data ?? []).map<RecentTransaction>((r) => ({
      id: r.id,
      kind: 'expense',
      date: r.expense_date,
      description: r.description,
      categoryName: nameOf(r.category_id),
      amount: toMoney(r.amount),
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, RECENT_LIMIT);

  return {
    month,
    currency,
    income,
    expense,
    budget,
    budgetLimit,
    remaining: budgetLimit === null ? null : subtractMoney(budgetLimit, expense),
    plannedExpense,
    unplannedExpense,
    recent,
  };
}

export function useDashboard() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => fetchDashboard(userId),
    enabled: Boolean(userId),
  });
}
