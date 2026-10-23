import { z } from 'zod';
import { PAYMENT_METHODS } from '@/lib/constants';
import { dateField, moneyField, optionalNote, uuidField } from '@/schemas/common';

export const expenseSchema = z.object({
  category_id: uuidField('Vui lòng chọn danh mục'),
  /** '' = không liên kết kế hoạch (chi tiêu ngoài kế hoạch). */
  plan_id: z.union([z.literal(''), z.string().uuid('Kế hoạch không hợp lệ'), z.undefined()]),
  amount: moneyField,
  expense_date: dateField,
  payment_method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: 'Vui lòng chọn phương thức thanh toán' }) }),
  description: z.string().trim().max(200, 'Mô tả tối đa 200 ký tự'),
  note: optionalNote.optional(),
});
export type ExpenseFormValues = z.infer<typeof expenseSchema>;
