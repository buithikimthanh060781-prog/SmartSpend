import { z } from 'zod';
import { PLAN_STATUSES } from '@/lib/constants';
import { dateField, moneyField, optionalNote, uuidField } from '@/schemas/common';

export const planSchema = z.object({
  category_id: uuidField('Vui lòng chọn danh mục'),
  title: z.string().trim().min(1, 'Vui lòng nhập tên kế hoạch').max(120, 'Tên tối đa 120 ký tự'),
  planned_date: dateField,
  planned_amount: moneyField,
  status: z.enum(PLAN_STATUSES, { errorMap: () => ({ message: 'Vui lòng chọn trạng thái' }) }),
  note: optionalNote.optional(),
});
export type PlanFormValues = z.infer<typeof planSchema>;
