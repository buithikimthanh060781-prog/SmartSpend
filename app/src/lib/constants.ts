// Giá trị hợp lệ theo CHECK constraint / migration V1 (Sprint 2 đã xác nhận).
export const INCOME_STATUSES = ['expected', 'received'] as const;
export type IncomeStatus = (typeof INCOME_STATUSES)[number];
export const INCOME_STATUS_LABEL: Record<IncomeStatus, string> = { expected: 'Dự kiến', received: 'Đã nhận' };

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'e_wallet', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ',
  e_wallet: 'Ví điện tử',
  other: 'Khác',
};

export const PLAN_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  planned: 'Đã lên kế hoạch',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

/**
 * Giá trị ss_categories.type. CHƯA được xác minh bằng CHECK constraint (xem database/verify_sprint1.sql mục 1).
 * Đây là nơi DUY NHẤT khai báo; trang Danh mục sẽ báo lỗi rõ ràng nếu dữ liệu thực tế không khớp.
 */
export const CATEGORY_TYPES = ['income', 'expense'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];
export const CATEGORY_TYPE_LABEL: Record<CategoryType, string> = { income: 'Thu nhập', expense: 'Chi tiêu' };

export const PAGE_SIZE = 10;
