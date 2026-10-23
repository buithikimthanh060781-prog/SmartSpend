// Kiểu dữ liệu khớp đúng cấu trúc thực tế của 7 bảng ss_* (không thêm cột nào khác).
// Cột `status`, `type`, `period_type`, `payment_method`, `action` là text; các giá trị
// hợp lệ (check constraint) CHƯA được xác minh, vì vậy được khai báo là string.

export interface SsSettings {
  user_id: string;
  currency: string;
  timezone: string;
  week_start: number;
  created_at: string;
  updated_at: string;
}

export interface SsCategory {
  id: string;
  user_id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SsIncome {
  id: string;
  user_id: string;
  category_id: string;
  amount: number | string;
  income_date: string;
  status: string;
  description: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SsExpense {
  id: string;
  user_id: string;
  category_id: string;
  plan_id: string | null;
  amount: number | string;
  expense_date: string;
  payment_method: string;
  description: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SsExpensePlan {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  planned_date: string;
  planned_amount: number | string;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SsBudget {
  id: string;
  user_id: string;
  category_id: string | null;
  period_type: string;
  period_start: string;
  period_end: string;
  amount: number | string;
  created_at: string;
  updated_at: string;
}

export interface SsBudgetAuditLog {
  id: number;
  user_id: string;
  budget_id: string;
  action: string;
  old_amount: number | string | null;
  new_amount: number | string | null;
  changed_at: string;
}
