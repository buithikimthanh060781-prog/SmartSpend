import type { CategoryType } from '@/lib/constants';
import { fetchAllRows } from '@/lib/paginate';
import { supabase } from '@/lib/supabase';
import { normalizeCategoryName } from '@/schemas/category';
import { BusinessRuleError } from '@/services/guards';
import type { SsCategory } from '@/types/db';

export interface CategoryInput {
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
}

export function listCategories(userId: string): Promise<SsCategory[]> {
  return fetchAllRows<SsCategory>((from, to) =>
    supabase
      .from('ss_categories')
      .select('*')
      .eq('user_id', userId)
      .order('type')
      .order('name')
      .order('id')
      .range(from, to)
      .returns<SsCategory[]>(),
  );
}

/**
 * Kiểm tra trùng tên cùng loại trên dữ liệu MỚI NHẤT từ server (không dùng cache của giao diện), không phân biệt
 * hoa thường và khoảng trắng. Chỉ là kiểm tra phía ứng dụng; chặn tuyệt đối cần unique index ở database.
 */
export async function assertNoDuplicateCategory(userId: string, type: string, name: string, ignoreId?: string): Promise<void> {
  const { data, error } = await supabase
    .from('ss_categories')
    .select('id, name')
    .eq('user_id', userId)
    .eq('type', type)
    .returns<Pick<SsCategory, 'id' | 'name'>[]>();
  if (error) throw error;
  const target = normalizeCategoryName(name);
  const dup = (data ?? []).find((c) => c.id !== ignoreId && normalizeCategoryName(c.name) === target);
  if (dup) throw new DuplicateCategoryError(dup.name);
}

export class DuplicateCategoryError extends Error {
  constructor(public readonly existingName: string) {
    super(`Đã có danh mục "${existingName}" cùng loại (không phân biệt hoa thường).`);
    this.name = 'DuplicateCategoryError';
  }
}

export async function createCategory(userId: string, input: CategoryInput): Promise<void> {
  await assertNoDuplicateCategory(userId, input.type, input.name);
  const { error } = await supabase.from('ss_categories').insert({
    user_id: userId,
    name: input.name,
    type: input.type,
    icon: input.icon,
    color: input.color,
    is_active: true,
    is_default: false,
  });
  if (error) throw error;
}

/** Sửa tên, màu, icon. Không đổi `type` vì sẽ làm sai lịch sử giao dịch đã gắn danh mục. */
export async function updateCategory(userId: string, id: string, input: Pick<CategoryInput, 'name' | 'icon' | 'color'>): Promise<void> {
  const current = await supabase.from('ss_categories').select('type').eq('id', id).maybeSingle<Pick<SsCategory, 'type'>>();
  if (current.error) throw current.error;
  if (!current.data) throw new Error('Không tìm thấy danh mục hoặc bạn không có quyền sửa.');
  await assertNoDuplicateCategory(userId, current.data.type, input.name, id);

  const { data, error } = await supabase
    .from('ss_categories')
    .update({ name: input.name, icon: input.icon, color: input.color, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Không tìm thấy danh mục hoặc bạn không có quyền sửa.');
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('ss_categories')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Không tìm thấy danh mục hoặc bạn không có quyền sửa.');
}

/** Tổng số bản ghi (thu nhập, chi tiêu, kế hoạch, ngân sách) đang dùng danh mục này. */
export async function countCategoryUsage(id: string): Promise<number> {
  const tables = ['ss_incomes', 'ss_expenses', 'ss_expense_plans', 'ss_budgets'] as const;
  const results = await Promise.all(
    tables.map((t) => supabase.from(t).select('id', { count: 'exact', head: true }).eq('category_id', id)),
  );
  let total = 0;
  for (const r of results) {
    if (r.error) throw r.error;
    total += r.count ?? 0;
  }
  return total;
}

/** Chỉ xóa khi chưa có giao dịch nào dùng danh mục (kiểm tra ở đây và bằng FK của database). */
export async function deleteCategory(id: string): Promise<void> {
  const row = await supabase.from('ss_categories').select('is_default').eq('id', id).maybeSingle<Pick<SsCategory, 'is_default'>>();
  if (row.error) throw row.error;
  if (!row.data) throw new Error('Không tìm thấy danh mục hoặc bạn không có quyền xóa.');
  if (row.data.is_default) throw new BusinessRuleError('Danh mục mặc định không thể xóa. Hãy tắt nó nếu không muốn dùng.');
  const used = await countCategoryUsage(id);
  if (used > 0) throw new CategoryInUseError(used);
  const { data, error } = await supabase.from('ss_categories').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Không xóa được danh mục (không tồn tại hoặc không có quyền).');
}

export class CategoryInUseError extends Error {
  constructor(public readonly usage: number) {
    super(`Danh mục đang được dùng bởi ${usage} bản ghi. Hãy tắt danh mục thay vì xóa để giữ lịch sử.`);
    this.name = 'CategoryInUseError';
  }
}
