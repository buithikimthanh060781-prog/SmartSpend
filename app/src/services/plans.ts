import type { PlanStatus } from '@/lib/constants';
import { sumMoney } from '@/lib/money';
import { chunk, fetchAllRows } from '@/lib/paginate';
import { supabase } from '@/lib/supabase';
import { assertCategoryUsable, BusinessRuleError, countPlanExpenses } from '@/services/guards';
import { EXPORT_MAX_ROWS } from '@/services/incomes';
import { applySearch, pageRange, withFilters, type Paged } from '@/services/query';
import type { SsExpense, SsExpensePlan } from '@/types/db';

export interface PlanFilters {
  search: string;
  status: '' | PlanStatus;
  categoryId: string;
  page: number;
}

export interface PlanInput {
  category_id: string;
  title: string;
  planned_date: string;
  planned_amount: number;
  status: PlanStatus;
  note: string | null;
}

export async function listPlans(userId: string, f: PlanFilters): Promise<Paged<SsExpensePlan>> {
  const [from, to] = pageRange(f.page);
  const base = supabase.from('ss_expense_plans').select('*', { count: 'exact' }).eq('user_id', userId);
  const { data, error, count } = await withFilters(base, (q) => {
    let r = applySearch(q, f.search, ['title', 'note']);
    if (f.status) r = r.eq('status', f.status);
    if (f.categoryId) r = r.eq('category_id', f.categoryId);
    return r;
  })
    .order('planned_date', { ascending: false })
    .order('id')
    .range(from, to)
    .returns<SsExpensePlan[]>();
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getPlan(id: string): Promise<SsExpensePlan | null> {
  const { data, error } = await supabase.from('ss_expense_plans').select('*').eq('id', id).maybeSingle<SsExpensePlan>();
  if (error) throw error;
  return data;
}

export interface PlanSpent {
  spent: number;
  count: number;
}

/** Giao dịch liên kết với các kế hoạch cho trước. Chia nhóm id để URL không quá dài; mỗi nhóm phân trang đủ dòng. */
export async function fetchLinkedExpenses(planIds: string[], maxRows?: number): Promise<Array<Pick<SsExpense, 'plan_id' | 'amount'>>> {
  type Row = Pick<SsExpense, 'plan_id' | 'amount'>;
  const groups = await Promise.all(
    chunk(planIds, 100).map((ids) =>
      fetchAllRows<Row>(
        (from, to) => supabase.from('ss_expenses').select('plan_id, amount').in('plan_id', ids).order('id').range(from, to).returns<Row[]>(),
        maxRows,
      ),
    ),
  );
  return groups.flat();
}

/** TOÀN BỘ kế hoạch khớp bộ lọc (không phân trang), dùng để xuất file. */
export function listAllPlans(userId: string, f: PlanFilters): Promise<SsExpensePlan[]> {
  return fetchAllRows<SsExpensePlan>(
    (from, to) =>
      withFilters(supabase.from('ss_expense_plans').select('*').eq('user_id', userId), (q) => {
        let r = applySearch(q, f.search, ['title', 'note']);
        if (f.status) r = r.eq('status', f.status);
        if (f.categoryId) r = r.eq('category_id', f.categoryId);
        return r;
      })
        .order('planned_date', { ascending: false })
        .order('id')
        .range(from, to)
        .returns<SsExpensePlan[]>(),
    EXPORT_MAX_ROWS,
  );
}

/** Tên kế hoạch theo id (cho cột "Tên kế hoạch" khi xuất chi tiêu). */
export async function planTitlesByIds(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const part of chunk(ids, 100)) {
    const { data, error } = await supabase.from('ss_expense_plans').select('id, title').in('id', part).returns<Array<{ id: string; title: string }>>();
    if (error) throw error;
    for (const r of data ?? []) out.set(r.id, r.title);
  }
  return out;
}

/** Tổng thực chi và số giao dịch liên kết cho từng kế hoạch. planned_amount KHÔNG được cộng vào đây. */
export async function planSpentMap(planIds: string[]): Promise<Record<string, PlanSpent>> {
  if (planIds.length === 0) return {};
  const rows = await fetchLinkedExpenses(planIds);
  const result: Record<string, PlanSpent> = {};
  for (const id of planIds) {
    const own = rows.filter((r) => r.plan_id === id);
    result[id] = { spent: sumMoney(own, (r) => r.amount), count: own.length };
  }
  return result;
}

export function listPlanExpenses(planId: string): Promise<SsExpense[]> {
  return fetchAllRows<SsExpense>((from, to) =>
    supabase
      .from('ss_expenses')
      .select('*')
      .eq('plan_id', planId)
      .order('expense_date', { ascending: false })
      .order('id')
      .range(from, to)
      .returns<SsExpense[]>(),
  );
}

/** Kế hoạch có thể liên kết với chi tiêu: của người dùng, cùng danh mục, chưa hủy. */
export async function listLinkablePlans(userId: string, categoryId: string): Promise<SsExpensePlan[]> {
  if (!categoryId) return [];
  return fetchAllRows<SsExpensePlan>((from, to) =>
    supabase
      .from('ss_expense_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .neq('status', 'cancelled')
      .order('planned_date', { ascending: false })
      .order('id')
      .range(from, to)
      .returns<SsExpensePlan[]>(),
  );
}

export async function createPlan(userId: string, input: PlanInput): Promise<void> {
  await assertCategoryUsable(input.category_id, 'expense', true);
  const { error } = await supabase.from('ss_expense_plans').insert({ user_id: userId, ...input });
  if (error) throw error;
}

/** Quy tắc khi đã có giao dịch liên kết: không đổi danh mục (sẽ làm sai dữ liệu) và không hủy kế hoạch. */
async function assertPlanChangeAllowed(id: string, next: { category_id?: string; status?: PlanStatus }): Promise<void> {
  const current = await getPlan(id);
  if (!current) throw new BusinessRuleError('Không tìm thấy kế hoạch hoặc bạn không có quyền truy cập.');

  const categoryChanged = next.category_id !== undefined && next.category_id !== current.category_id;
  const becomesCancelled = next.status === 'cancelled' && current.status !== 'cancelled';

  if (categoryChanged) await assertCategoryUsable(next.category_id as string, 'expense', true);
  if (categoryChanged || becomesCancelled) {
    const linked = await countPlanExpenses(id);
    if (linked > 0) {
      throw new BusinessRuleError(
        categoryChanged
          ? `Không thể đổi danh mục: kế hoạch đã có ${linked} giao dịch liên kết (sẽ làm sai dữ liệu).`
          : `Không thể hủy: kế hoạch đã có ${linked} giao dịch liên kết.`,
      );
    }
  }
}

export async function updatePlan(id: string, input: PlanInput): Promise<void> {
  await assertPlanChangeAllowed(id, { category_id: input.category_id, status: input.status });
  const { data, error } = await supabase
    .from('ss_expense_plans')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Không tìm thấy kế hoạch hoặc bạn không có quyền sửa.');
}

export async function updatePlanStatus(id: string, status: PlanStatus): Promise<void> {
  await assertPlanChangeAllowed(id, { status });
  const { data, error } = await supabase
    .from('ss_expense_plans')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Không tìm thấy kế hoạch hoặc bạn không có quyền sửa.');
}
