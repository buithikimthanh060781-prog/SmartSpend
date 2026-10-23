import { CATEGORY_TYPE_LABEL, type CategoryType } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type { SsCategory, SsExpensePlan } from '@/types/db';

/** Vi phạm quy tắc nghiệp vụ, có thông điệp tiếng Việt hiển thị trực tiếp cho người dùng. */
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

/**
 * Các kiểm tra dưới đây đọc dữ liệu thật từ server (qua RLS) ngay trước khi ghi, chứ không tin vào state của form.
 * Chúng giúp báo lỗi rõ ràng, nhưng KHÔNG thay thế ràng buộc/trigger ở database: giữa lúc kiểm tra và lúc ghi vẫn
 * có thể có thay đổi khác. Ràng buộc cuối cùng phải nằm ở database (xem database/verify_sprint2_integrity.sql).
 */

/** Danh mục phải tồn tại, thuộc tài khoản hiện tại (RLS), đúng loại, và đang hoạt động khi `requireActive`. */
export async function assertCategoryUsable(categoryId: string, expectedType: CategoryType, requireActive: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('ss_categories')
    .select('id, name, type, is_active')
    .eq('id', categoryId)
    .maybeSingle<Pick<SsCategory, 'id' | 'name' | 'type' | 'is_active'>>();
  if (error) throw error;
  if (!data) throw new BusinessRuleError('Danh mục không tồn tại hoặc không thuộc tài khoản của bạn.');
  if (data.type !== expectedType) {
    throw new BusinessRuleError(`Danh mục "${data.name}" thuộc loại ${labelOf(data.type)}, không dùng được cho ${labelOf(expectedType).toLowerCase()}.`);
  }
  if (requireActive && !data.is_active) {
    throw new BusinessRuleError(`Danh mục "${data.name}" đã bị tắt. Hãy bật lại hoặc chọn danh mục khác.`);
  }
}

function labelOf(type: string): string {
  return (CATEGORY_TYPE_LABEL as Record<string, string>)[type] ?? `"${type}"`;
}

/** Danh mục hiện tại của một bản ghi (dùng để biết danh mục có bị đổi khi sửa hay không). */
export async function currentCategoryOf(table: 'ss_incomes' | 'ss_expenses' | 'ss_expense_plans', id: string): Promise<string> {
  const { data, error } = await supabase.from(table).select('category_id').eq('id', id).maybeSingle<{ category_id: string }>();
  if (error) throw error;
  if (!data) throw new BusinessRuleError('Không tìm thấy bản ghi hoặc bạn không có quyền truy cập.');
  return data.category_id;
}

/** Kế hoạch được liên kết phải: tồn tại, của chính người dùng, cùng danh mục với chi tiêu, và chưa bị hủy. */
export async function assertPlanLinkable(planId: string, categoryId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('ss_expense_plans')
    .select('id, user_id, category_id, status, title')
    .eq('id', planId)
    .maybeSingle<Pick<SsExpensePlan, 'id' | 'user_id' | 'category_id' | 'status' | 'title'>>();
  if (error) throw error;
  if (!data || data.user_id !== userId) throw new BusinessRuleError('Kế hoạch không tồn tại hoặc không thuộc tài khoản của bạn.');
  if (data.status === 'cancelled') throw new BusinessRuleError(`Kế hoạch "${data.title}" đã bị hủy, không thể liên kết chi tiêu.`);
  if (data.category_id !== categoryId) throw new BusinessRuleError(`Kế hoạch "${data.title}" thuộc danh mục khác với chi tiêu này.`);
}

export async function countPlanExpenses(planId: string): Promise<number> {
  const { count, error } = await supabase.from('ss_expenses').select('id', { count: 'exact', head: true }).eq('plan_id', planId);
  if (error) throw error;
  return count ?? 0;
}
