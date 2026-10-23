import { describe, expect, it } from 'vitest';
import { categorySchema, normalizeCategoryName } from '@/schemas/category';
import { expenseSchema } from '@/schemas/expense';
import { incomeSchema } from '@/schemas/income';
import { planSchema } from '@/schemas/plan';

const uuid = '123e4567-e89b-42d3-a456-426614174000';

describe('incomeSchema', () => {
  const ok = { category_id: uuid, amount: '1.500.000', income_date: '2026-10-18', status: 'received', description: 'Lương', note: '' };

  it('chấp nhận expected và received', () => {
    expect(incomeSchema.safeParse(ok).success).toBe(true);
    expect(incomeSchema.safeParse({ ...ok, status: 'expected' }).success).toBe(true);
  });
  it('từ chối trạng thái không hợp lệ', () => {
    expect(incomeSchema.safeParse({ ...ok, status: 'pending' }).success).toBe(false);
  });
  it('từ chối số tiền 0, âm, rỗng, chữ', () => {
    for (const amount of ['0', '-5', '', 'abc', '1,234,5']) {
      expect(incomeSchema.safeParse({ ...ok, amount }).success).toBe(false);
    }
  });
  it('từ chối thiếu danh mục hoặc ngày sai', () => {
    expect(incomeSchema.safeParse({ ...ok, category_id: '' }).success).toBe(false);
    expect(incomeSchema.safeParse({ ...ok, income_date: '18/10/2026' }).success).toBe(false);
  });
});

describe('expenseSchema', () => {
  const ok = { category_id: uuid, plan_id: '', amount: '150000', expense_date: '2026-10-18', payment_method: 'cash', description: '', note: '' };

  it('plan_id rỗng = chi tiêu ngoài kế hoạch', () => {
    expect(expenseSchema.safeParse(ok).success).toBe(true);
  });
  it('chấp nhận plan_id là uuid', () => {
    expect(expenseSchema.safeParse({ ...ok, plan_id: uuid }).success).toBe(true);
    expect(expenseSchema.safeParse({ ...ok, plan_id: 'abc' }).success).toBe(false);
  });
  it('chỉ chấp nhận 5 phương thức thanh toán hợp lệ', () => {
    for (const m of ['cash', 'bank_transfer', 'card', 'e_wallet', 'other']) {
      expect(expenseSchema.safeParse({ ...ok, payment_method: m }).success).toBe(true);
    }
    expect(expenseSchema.safeParse({ ...ok, payment_method: 'crypto' }).success).toBe(false);
  });
});

describe('planSchema', () => {
  const ok = { category_id: uuid, title: 'Du lịch', planned_date: '2026-12-01', planned_amount: '5.000.000', status: 'planned', note: '' };

  it('chấp nhận 4 trạng thái', () => {
    for (const s of ['planned', 'in_progress', 'completed', 'cancelled']) {
      expect(planSchema.safeParse({ ...ok, status: s }).success).toBe(true);
    }
    expect(planSchema.safeParse({ ...ok, status: 'done' }).success).toBe(false);
  });
  it('bắt buộc tên', () => {
    expect(planSchema.safeParse({ ...ok, title: '   ' }).success).toBe(false);
  });
});

describe('categorySchema', () => {
  it('kiểm tra tên, loại và màu', () => {
    expect(categorySchema.safeParse({ name: 'Cà phê', type: 'expense', icon: 'tag', color: '#F58B2B' }).success).toBe(true);
    expect(categorySchema.safeParse({ name: '  ', type: 'expense' }).success).toBe(false);
    expect(categorySchema.safeParse({ name: 'A', type: 'other' }).success).toBe(false);
    expect(categorySchema.safeParse({ name: 'A', type: 'income', color: 'red' }).success).toBe(false);
  });
  it('chuẩn hóa tên để chặn trùng (hoa/thường, khoảng trắng)', () => {
    expect(normalizeCategoryName('  Ăn   Uống ')).toBe(normalizeCategoryName('ăn uống'));
  });
});
