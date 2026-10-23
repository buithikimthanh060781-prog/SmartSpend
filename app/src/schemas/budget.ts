import { z } from 'zod';
import { PERIOD_TYPES } from '@/lib/budget';
import { parseMoneyInput } from '@/lib/money';
import { dateField } from '@/schemas/common';

/** Hạn mức: cho phép 0 (CHECK amount >= 0), không âm, không quá lớn. */
export const budgetAmountField = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập hạn mức (có thể nhập 0)')
  .refine((v) => parseMoneyInput(v) !== null, 'Hạn mức không hợp lệ: chỉ nhập số không âm (tối đa 2 chữ số thập phân)')
  .refine((v) => (parseMoneyInput(v) ?? 0) < 1_000_000_000_000, 'Hạn mức quá lớn');

export const budgetSchema = z
  .object({
    period_type: z.enum(PERIOD_TYPES, { errorMap: () => ({ message: 'Vui lòng chọn loại ngân sách' }) }),
    anchor: dateField,
    scope: z.enum(['total', 'category']),
    category_id: z.string(),
    amount: budgetAmountField,
  })
  .superRefine((v, ctx) => {
    if (v.scope === 'category' && !z.string().uuid().safeParse(v.category_id).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['category_id'], message: 'Vui lòng chọn danh mục chi tiêu' });
    }
  });
export type BudgetFormValues = z.infer<typeof budgetSchema>;

export const budgetAmountSchema = z.object({ amount: budgetAmountField });
export type BudgetAmountValues = z.infer<typeof budgetAmountSchema>;
