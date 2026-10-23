import { PERIOD_TYPES, type PeriodType } from '@/lib/budget';
import { addDays } from '@/lib/dates';
import { compareMoney, toMoney } from '@/lib/money';
import { fetchAllRows } from '@/lib/paginate';
import { periodContaining, periodsForDate, type Period } from '@/lib/periods';
import { supabase } from '@/lib/supabase';
import { buildAlerts, type BudgetAlert } from '@/services/budgetAlerts';
import { evaluateBudgets, type BudgetEvaluation, type ExpenseLite } from '@/services/budgetCalculation';
import { assertCategoryUsable, BusinessRuleError } from '@/services/guards';
import { pageRange, withFilters, type Paged } from '@/services/query';
import type { SsBudget, SsBudgetAuditLog } from '@/types/db';

export class DuplicateBudgetError extends Error {
  constructor() {
    super('Đã có ngân sách cùng loại kỳ, ngày bắt đầu và phạm vi (tổng/danh mục) này. Hãy sửa ngân sách đã có.');
    this.name = 'DuplicateBudgetError';
  }
}

export interface BudgetFilters {
  /** '' = mọi loại kỳ. */
  periodType: '' | PeriodType;
  /** Chỉ lấy ngân sách có đúng period_start này (chế độ chọn kỳ). */
  start?: string;
  /** Chế độ khoảng thời gian: lấy ngân sách có kỳ giao với [from, to] (to tính cả ngày). */
  from?: string;
  to?: string;
  scope: '' | 'total' | 'category';
  categoryId: string;
}

export interface BudgetInput {
  period_type: PeriodType;
  /** Ngày bất kỳ nằm trong kỳ muốn áp dụng; period_start/period_end luôn do hệ thống tính, không do người dùng nhập. */
  anchor: string;
  /** null = ngân sách tổng chi tiêu. */
  category_id: string | null;
  amount: number;
}

const EXPENSE_COLUMNS = 'user_id, category_id, amount, expense_date';

export async function listBudgets(userId: string, f: BudgetFilters): Promise<SsBudget[]> {
  return fetchAllRows<SsBudget>((from, to) =>
    withFilters(supabase.from('ss_budgets').select('*').eq('user_id', userId), (q) => {
      let r = q;
      if (f.periodType) r = r.eq('period_type', f.periodType);
      if (f.start) r = r.eq('period_start', f.start);
      if (f.from) r = r.gt('period_end', f.from);
      if (f.to) r = r.lt('period_start', addDays(f.to, 1));
      if (f.scope === 'total') r = r.is('category_id', null);
      if (f.scope === 'category') r = r.not('category_id', 'is', null);
      if (f.categoryId) r = r.eq('category_id', f.categoryId);
      return r;
    })
      .order('period_start', { ascending: false })
      .order('id')
      .range(from, to)
      .returns<SsBudget[]>(),
  );
}

/** Chi tiêu của người dùng trong [start, endExclusive), lấy đủ mọi trang. */
export function listExpensesInRange(userId: string, start: string, endExclusive: string): Promise<ExpenseLite[]> {
  return fetchAllRows<ExpenseLite>((from, to) =>
    supabase
      .from('ss_expenses')
      .select(EXPENSE_COLUMNS)
      .eq('user_id', userId)
      .gte('expense_date', start)
      .lt('expense_date', endExclusive)
      .order('id')
      .range(from, to)
      .returns<ExpenseLite[]>(),
  );
}

async function expensesCovering(userId: string, budgets: readonly SsBudget[]): Promise<ExpenseLite[]> {
  if (budgets.length === 0) return [];
  const start = budgets.reduce((m, b) => (b.period_start < m ? b.period_start : m), budgets[0].period_start);
  const end = budgets.reduce((m, b) => (b.period_end > m ? b.period_end : m), budgets[0].period_end);
  return listExpensesInRange(userId, start, end);
}

export async function listBudgetEvaluations(userId: string, f: BudgetFilters): Promise<BudgetEvaluation[]> {
  const budgets = await listBudgets(userId, f);
  return evaluateBudgets(budgets, await expensesCovering(userId, budgets));
}

export interface PeriodBudgets {
  period: Period;
  /** Ngân sách tổng của kỳ; null = chưa thiết lập. */
  total: BudgetEvaluation | null;
  categories: BudgetEvaluation[];
}

export interface BudgetOverview {
  date: string;
  byPeriod: Record<PeriodType, PeriodBudgets>;
  evaluations: BudgetEvaluation[];
  alerts: BudgetAlert[];
}

/** Gom đánh giá theo kỳ. Không cộng gộp các ngân sách với nhau. */
export function groupOverview(date: string, evaluations: readonly BudgetEvaluation[]): BudgetOverview {
  const periods = periodsForDate(date);
  const byPeriod = {} as Record<PeriodType, PeriodBudgets>;
  for (const type of PERIOD_TYPES) {
    const p = periods[type];
    const inPeriod = evaluations.filter(
      (e) => e.budget.period_type === type && e.budget.period_start === p.start && e.budget.period_end === p.endExclusive,
    );
    byPeriod[type] = {
      period: p,
      total: inPeriod.find((e) => e.budget.category_id === null) ?? null,
      categories: inPeriod.filter((e) => e.budget.category_id !== null).sort((a, b) => (b.usagePercent ?? Infinity) - (a.usagePercent ?? Infinity)),
    };
  }
  const flat = PERIOD_TYPES.flatMap((t) => (byPeriod[t].total ? [byPeriod[t].total as BudgetEvaluation] : []).concat(byPeriod[t].categories));
  return { date, byPeriod, evaluations: flat, alerts: buildAlerts(flat) };
}

/** Ngân sách ngày/tuần/tháng đang áp dụng cho `date` kèm thực chi và cảnh báo (dùng cho Dashboard, badge, toast). */
export async function loadBudgetOverview(userId: string, date: string): Promise<BudgetOverview> {
  const periods = periodsForDate(date);
  const starts = PERIOD_TYPES.map((t) => periods[t].start);
  const rows = await fetchAllRows<SsBudget>((from, to) =>
    supabase
      .from('ss_budgets')
      .select('*')
      .eq('user_id', userId)
      .in('period_start', starts)
      .order('id')
      .range(from, to)
      .returns<SsBudget[]>(),
  );
  const exact = rows.filter((b) => {
    const p = periods[b.period_type as PeriodType];
    return p !== undefined && b.period_start === p.start && b.period_end === p.endExclusive;
  });
  const expenses = await expensesCovering(userId, exact);
  return groupOverview(date, evaluateBudgets(exact, expenses));
}

/** Kiểm tra trùng trên dữ liệu mới nhất ở server: cùng user, loại kỳ, ngày bắt đầu và danh mục (null = tổng). */
export async function assertNoDuplicateBudget(userId: string, period: Period, categoryId: string | null): Promise<void> {
  const { data, error } = await withFilters(
    supabase.from('ss_budgets').select('id').eq('user_id', userId).eq('period_type', period.type).eq('period_start', period.start),
    (q) => (categoryId === null ? q.is('category_id', null) : q.eq('category_id', categoryId)),
  ).returns<Array<{ id: string }>>();
  if (error) throw error;
  if ((data ?? []).length > 0) throw new DuplicateBudgetError();
}

function assertAmount(amount: number): void {
  // 0 là hợp lệ (CHECK amount >= 0); âm hoặc không phải số thì từ chối.
  if (!Number.isFinite(amount) || compareMoney(amount, 0) < 0) throw new BusinessRuleError('Hạn mức không được âm.');
  toMoney(amount); // ném lỗi nếu ngoài phạm vi biểu diễn chính xác
}

export async function createBudget(userId: string, input: BudgetInput): Promise<void> {
  assertAmount(input.amount);
  const period = periodContaining(input.period_type, input.anchor);
  if (input.category_id !== null) await assertCategoryUsable(input.category_id, 'expense', true);
  await assertNoDuplicateBudget(userId, period, input.category_id);

  const { error } = await supabase.from('ss_budgets').insert({
    user_id: userId,
    category_id: input.category_id,
    period_type: period.type,
    period_start: period.start,
    period_end: period.endExclusive,
    amount: input.amount,
  });
  if (error) {
    // Unique constraint ở database là lớp chặn cuối cùng (race giữa hai tab/thiết bị).
    if ((error as { code?: string }).code === '23505') throw new DuplicateBudgetError();
    throw error;
  }
}

/**
 * Chỉ cho sửa hạn mức. Đổi loại kỳ, ngày bắt đầu hoặc danh mục KHÔNG được hỗ trợ ở đây: người dùng phải tạo ngân sách mới,
 * để không âm thầm chuyển một ngân sách (và lịch sử của nó) sang kỳ/danh mục khác.
 */
export async function updateBudgetAmount(id: string, amount: number): Promise<void> {
  assertAmount(amount);
  const { data, error } = await supabase
    .from('ss_budgets')
    .update({ amount, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new BusinessRuleError('Không tìm thấy ngân sách hoặc bạn không có quyền sửa.');
}

/** Số bản ghi lịch sử (audit log) của một ngân sách, để cảnh báo trước khi xóa. Chỉ đọc. */
export async function countBudgetAuditLogs(budgetId: string): Promise<number> {
  const { count, error } = await supabase.from('ss_budget_audit_logs').select('id', { count: 'exact', head: true }).eq('budget_id', budgetId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Xóa ngân sách. Chỉ chạm bảng ss_budgets: KHÔNG xóa giao dịch chi tiêu và KHÔNG ghi audit log từ frontend.
 * Nếu database từ chối (ví dụ khóa ngoại từ audit log), báo lỗi rõ ràng và không tự sửa khóa ngoại/trigger.
 */
export async function deleteBudget(id: string): Promise<void> {
  const { data, error } = await supabase.from('ss_budgets').delete().eq('id', id).select('id');
  if (error) {
    if ((error as { code?: string }).code === '23503') {
      throw new BusinessRuleError('Database không cho xóa ngân sách này vì còn dữ liệu liên quan (ví dụ lịch sử thay đổi). Hãy đặt hạn mức về 0 hoặc nhờ quản trị viên xử lý ràng buộc.');
    }
    throw error;
  }
  if (!data?.length) throw new BusinessRuleError('Không xóa được ngân sách (không tồn tại hoặc bạn không có quyền).');
}

export interface AuditFilters {
  budgetId: string;
  page: number;
}

/** Lịch sử điều chỉnh ngân sách. CHỈ ĐỌC: frontend không bao giờ INSERT/UPDATE/DELETE bảng này. */
export async function listBudgetAuditLogs(userId: string, f: AuditFilters): Promise<Paged<SsBudgetAuditLog>> {
  const [from, to] = pageRange(f.page);
  let q = supabase.from('ss_budget_audit_logs').select('*', { count: 'exact' }).eq('user_id', userId);
  if (f.budgetId) q = q.eq('budget_id', f.budgetId);
  const { data, error, count } = await q.order('changed_at', { ascending: false }).order('id', { ascending: false }).range(from, to).returns<SsBudgetAuditLog[]>();
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

/** Thông tin ngân sách (còn tồn tại) cho các dòng lịch sử, để hiển thị kỳ và danh mục. */
export async function listBudgetsByIds(ids: string[]): Promise<SsBudget[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('ss_budgets').select('*').in('id', ids).returns<SsBudget[]>();
  if (error) throw error;
  return data ?? [];
}
