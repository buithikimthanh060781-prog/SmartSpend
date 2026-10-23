import { z } from 'zod';
import { parseMoneyInput } from '@/lib/money';

/** Số tiền nhập dạng chuỗi (hỗ trợ "1.500.000"), phải > 0 và nhỏ hơn 1 nghìn tỷ. */
export const moneyField = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập số tiền')
  .refine((v) => parseMoneyInput(v) !== null, 'Số tiền không hợp lệ (tối đa 2 chữ số thập phân)')
  .refine((v) => (parseMoneyInput(v) ?? 0) > 0, 'Số tiền phải lớn hơn 0')
  .refine((v) => (parseMoneyInput(v) ?? 0) < 1_000_000_000_000, 'Số tiền quá lớn');

export const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Vui lòng chọn ngày')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Ngày không hợp lệ');

export const uuidField = (message: string) => z.string().uuid(message);

export const optionalNote = z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự');

/** Chuỗi rỗng -> null để lưu vào cột nullable. */
export function emptyToNull(value: string | undefined): string | null {
  const v = (value ?? '').trim();
  return v === '' ? null : v;
}
