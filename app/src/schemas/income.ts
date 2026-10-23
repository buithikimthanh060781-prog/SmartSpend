import { z } from 'zod';
import { INCOME_STATUSES } from '@/lib/constants';
import { dateField, moneyField, optionalNote, uuidField } from '@/schemas/common';

export const incomeSchema = z.object({
  category_id: uuidField('Vui lòng chọn danh mục'),
  amount: moneyField,
  income_date: dateField,
  status: z.enum(INCOME_STATUSES, { errorMap: () => ({ message: 'Vui lòng chọn trạng thái' }) }),
  description: z.string().trim().max(200, 'Mô tả tối đa 200 ký tự'),
  note: optionalNote.optional(),
});
export type IncomeFormValues = z.infer<typeof incomeSchema>;
