import type { IncomeStatus } from '@/lib/constants';
import { sumMoney } from '@/lib/money';
import { fetchAllRows } from '@/lib/paginate';
import { supabase } from '@/lib/supabase';
import { assertCategoryUsable, currentCategoryOf } from '@/services/guards';
import { applySearch, pageRange, withFilters, type Paged } from '@/services/query';
import type { SsIncome } from '@/types/db';

export interface IncomeFilters {
  search: string;
  status: '' | IncomeStatus;
  categoryId: string;
  from: string;
  to: string;
  page: number;
}

export interface IncomeInput {
  category_id: string;
  amount: number;
  income_date: string;
  status: IncomeStatus;
  description: string;
  note: string | null;
}

/** Bộ lọc dùng chung cho danh sách và tổng. `withStatus=false` để tổng dự kiến/thực nhận không phụ thuộc bộ lọc trạng thái. */
function filtered<T>(query: T, f: IncomeFilters, withStatus: boolean): T {
  return withFilters(query, (q) => {
    let r = applySearch(q, f.search, ['description', 'note']);
    if (withStatus && f.status) r = r.eq('status', f.status);
    if (f.categoryId) r = r.eq('category_id', f.categoryId);
    if (f.from) r = r.gte('income_date', f.from);
    if (f.to) r = r.lte('income_date', f.to);
    return r;
  });
}

export async function listIncomes(userId: string, f: IncomeFilters): Promise<Paged<SsIncome>> {
  const [from, to] = pageRange(f.page);
  const base = supabase.from('ss_incomes').select('*', { count: 'exact' }).eq('user_id', userId);
  const { data, error, count } = await filtered(base, f, true)
    .order('income_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, to)
    .returns<SsIncome[]>();
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export interface IncomeTotals {
  expected: number;
  received: number;
}

/** Tổng dự kiến và tổng thực nhận RIÊNG BIỆT trên toàn bộ kết quả lọc (không chỉ trang hiện tại). */
export async function incomeTotals(userId: string, f: IncomeFilters): Promise<IncomeTotals> {
  type Row = Pick<SsIncome, 'amount' | 'status'>;
  const rows = await fetchAllRows<Row>((from, to) =>
    filtered(supabase.from('ss_incomes').select('amount, status').eq('user_id', userId), f, false)
      .order('id')
      .range(from, to)
      .returns<Row[]>(),
  );
  return {
    expected: sumMoney(rows.filter((r) => r.status === 'expected'), (r) => r.amount),
    received: sumMoney(rows.filter((r) => r.status === 'received'), (r) => r.amount),
  };
}

export async function createIncome(userId: string, input: IncomeInput): Promise<void> {
  await assertCategoryUsable(input.category_id, 'income', true);
  const { error } = await supabase.from('ss_incomes').insert({ user_id: userId, ...input });
  if (error) throw error;
}

export async function updateIncome(id: string, input: IncomeInput): Promise<void> {
  // Danh mục phải đúng loại; chỉ bắt buộc đang hoạt động khi người dùng ĐỔI sang danh mục khác.
  const previous = await currentCategoryOf('ss_incomes', id);
  await assertCategoryUsable(input.category_id, 'income', input.category_id !== previous);
  const { data, error } = await supabase
    .from('ss_incomes')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Không tìm thấy khoản thu nhập hoặc bạn không có quyền sửa.');
}

export async function deleteIncome(id: string): Promise<void> {
  const { data, error } = await supabase.from('ss_incomes').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Không xóa được khoản thu nhập (không tồn tại hoặc không có quyền).');
}

/** Giới hạn số dòng khi xuất dữ liệu; vượt quá thì báo lỗi rõ ràng (RowLimitError) thay vì cắt âm thầm. */
export const EXPORT_MAX_ROWS = 50_000;

/** TOÀN BỘ kết quả khớp bộ lọc (không phải chỉ trang hiện tại), dùng để xuất file. */
export function listAllIncomes(userId: string, f: IncomeFilters): Promise<SsIncome[]> {
  return fetchAllRows<SsIncome>(
    (from, to) =>
      filtered(supabase.from('ss_incomes').select('*').eq('user_id', userId), f, true)
        .order('income_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to)
        .returns<SsIncome[]>(),
    EXPORT_MAX_ROWS,
  );
}
