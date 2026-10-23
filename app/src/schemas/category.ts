import { z } from 'zod';
import { CATEGORY_TYPES } from '@/lib/constants';

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên danh mục').max(50, 'Tên tối đa 50 ký tự'),
  type: z.enum(CATEGORY_TYPES, { errorMap: () => ({ message: 'Vui lòng chọn loại danh mục' }) }),
  icon: z.string().max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Màu phải có dạng #RRGGBB')
    .optional()
    .or(z.literal('')),
});
export type CategoryFormValues = z.infer<typeof categorySchema>;

/** Tên so sánh không phân biệt hoa thường/khoảng trắng thừa, để chặn trùng tên cùng loại. */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
}
