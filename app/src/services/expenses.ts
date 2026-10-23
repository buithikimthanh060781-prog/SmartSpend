import type { PaymentMethod } from '@/lib/constants';
import { sumMoney } from '@/lib/money';
import { fetchAllRows } from '@/lib/paginate';
import { EXPORT_MAX_ROWS } from '@/services/incomes';
import { supabase } from '@/lib/supabase';
import { assertCategoryUsable, assertPlanLinkable, currentCategoryOf } from '@/services/guards';
import { applySearch, pageRange, withFilters, type Paged } from '@/services/query';
import type { SsExpense } from '@/types/db';

export type ExpenseSort = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export interface ExpenseFilters {
  search: string;
  categoryId: string;
  paymentMethod: '' | PaymentMethod;
  /** '' = tất cả, 'linked' = trong kế hoạch, 'unlinked' = ngoài kế hoạch. */
  plan: '' | 'linked' | 'unlinked';
  from: string;
  to: string;
  sort: ExpenseSort;
  page: number;
}

export interface ExpenseInput {
  category_id: string;
  plan_id: string | null;
  amount: number;
  expense_date: string;
  payment_method: PaymentMethod;
  description: string;
  note: string | null;
}

function filtered<T>(query: T, f: ExpenseFilters): T {
  return withFilters(query, (q) => {
    let r = applySearch(q, f.search, ['description', 'note']);
    if (f.categoryId) r = r.eq('category_id', f.categoryId);
    if (f.paymentMethod) r = r.eq('payment_method', f.paymentMethod);
    if (f.plan === 'linked') r = r.not('plan_id', 'is', null);
    if (f.plan === 'unlinked') r = r.is('plan_id', null);
    if (f.from) r = r.gte('expense_date', f.from);
    if (f.to) r = r.lte('expense_date', f.to);
    return r;
  });
}

export async function listExpenses(userId: string, f: ExpenseFilters): Promise<Paged<SsExpense>> {
  const [from, to] = pageRange(f.page);
  const base = filtered(supabase.from('ss_expenses').select('*', { count: 'exact' }).eq('user_id', userId), f);
  const ordered =
    f.sort === 'amount_desc'
      ? base.order('amount', { ascending: false })
      : f.sort === 'amount_asc'
        ? base.order('amount', { ascending: true })
        : f.sort === 'date_asc'
          ? base.order('expense_date', { ascending: true })
          : base.order('expense_date', { ascending: false });
  const { data, error, count } = await ordered
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, to)
    .returns<SsExpense[]>();
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

/** TOÀN BỘ kết quả khớp bộ lọc và thứ tự sắp xếp hiện tại (không chỉ trang hiện tại), dùng để xuất file. */
export function listAllExpenses(userId: string, f: ExpenseFilters): Promise<SsExpense[]> {
  const sort = (q: ReturnType<typeof listSortBase>) =>
    f.sort === 'amount_desc'
      ? q.order('amount', { ascending: false })
      : f.sort === 'amount_asc'
        ? q.order('amount', { ascending: true })
        : f.sort === 'date_asc'
          ? q.order('expense_date', { ascending: true })
          : q.order('expense_date', { ascending: false });
  return fetchAllRows<SsExpense>(
    (from, to) =>
      sort(listSortBase(userId, f))
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to)
        .returns<SsExpense[]>(),
    EXPORT_MAX_ROWS,
  );
}

function listSortBase(userId: string, f: ExpenseFilters) {
  return filtered(supabase.from('ss_expenses').select('*').eq('user_id', userId), f);
}

/** Tổng chi trên toàn bộ kết quả lọc (không chỉ trang hiện tại). */
export async function expenseTotal(userId: string, f: ExpenseFilters): Promise<number> {
  type Row = Pick<SsExpense, 'amount'>;
  const rows = await fetchAllRows<Row>((from, to) =>
    filtered(supabase.from('ss_expenses').select('amount').eq('user_id', userId), f)
      .order('id')
      .range(from, to)
      .returns<Row[]>(),
  );
  return sumMoney(rows, (r) => r.amount);
}

export async function createExpense(userId: string, input: ExpenseInput): Promise<void> {
  await assertCategoryUsable(input.category_id, 'expense', true);
  if (input.plan_id) await assertPlanLinkable(input.plan_id, input.category_id, userId);
  const { error } = await supabase.from('ss_expenses').insert({ user_id: userId, ...input });
  if (error) throw error;
}

export async function updateExpense(userId: string, id: string, input: ExpenseInput): Promise<void> {
  const previous = await currentCategoryOf('ss_expenses', id);
  await assertCategoryUsable(input.category_id, 'expense', input.category_id !== previous);
  // Luôn kiểm tra lại kế hoạch: đổi danh mục mà vẫn giữ kế hoạch cũ sẽ làm sai dữ liệu.
  if (input.plan_id) await assertPlanLinkable(input.plan_id, input.category_id, userId);
  const { data, error } = await supabase
    .from('ss_expenses')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Không tìm thấy khoản chi tiêu hoặc bạn không có quyền sửa.');
}

export async function deleteExpense(id: string): Promise<void> {
  const { data, error } = await supabase.from('ss_expenses').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Không xóa được khoản chi tiêu (không tồn tại hoặc không có quyền).');
}
