import { describe, expect, it } from 'vitest';
import { budgetAmountSchema, budgetSchema } from '@/schemas/budget';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const ok = { period_type: 'monthly', anchor: '2026-10-18', scope: 'total', category_id: '', amount: '5.000.000' };

describe('budgetSchema', () => {
  it('chấp nhận ngân sách tổng và theo danh mục', () => {
    expect(budgetSchema.safeParse(ok).success).toBe(true);
    expect(budgetSchema.safeParse({ ...ok, scope: 'category', category_id: uuid }).success).toBe(true);
  });
  it('chỉ nhận daily, weekly, monthly', () => {
    for (const t of ['daily', 'weekly', 'monthly']) expect(budgetSchema.safeParse({ ...ok, period_type: t }).success).toBe(true);
    for (const t of ['day', 'week', 'month', 'yearly', '']) expect(budgetSchema.safeParse({ ...ok, period_type: t }).success).toBe(false);
  });
  it('phạm vi danh mục bắt buộc chọn danh mục', () => {
    expect(budgetSchema.safeParse({ ...ok, scope: 'category', category_id: '' }).success).toBe(false);
  });
  it('cho phép hạn mức 0, từ chối số âm, rỗng, chữ, quá lớn', () => {
    expect(budgetSchema.safeParse({ ...ok, amount: '0' }).success).toBe(true);
    for (const amount of ['-1', '', 'abc', '1,234,5', '1.000.000.000.000']) {
      expect(budgetSchema.safeParse({ ...ok, amount }).success, amount).toBe(false);
    }
  });
  it('ngày không hợp lệ bị từ chối', () => {
    expect(budgetSchema.safeParse({ ...ok, anchor: '18/10/2026' }).success).toBe(false);
  });
});

describe('budgetAmountSchema (sửa hạn mức)', () => {
  it('0 hợp lệ, âm không hợp lệ', () => {
    expect(budgetAmountSchema.safeParse({ amount: '0' }).success).toBe(true);
    expect(budgetAmountSchema.safeParse({ amount: '-5' }).success).toBe(false);
  });
});
