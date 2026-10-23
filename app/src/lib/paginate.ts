import type { PostgrestError } from '@supabase/supabase-js';

const PAGE_SIZE = 1000; // giới hạn mặc định của PostgREST; vượt quá sẽ bị cắt âm thầm nếu không phân trang

type PageResult<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

/**
 * Lấy toàn bộ dòng của một truy vấn bằng cách phân trang. Cần thiết khi cộng tiền: nếu chỉ lấy trang đầu,
 * tổng sẽ sai mà không báo lỗi. Truy vấn phải có order ổn định (ví dụ order theo id) để các trang không chồng lấn.
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => PageResult<T>, maxRows?: number): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    // Giới hạn rõ ràng thay vì cắt âm thầm: dùng cho xuất dữ liệu lớn.
    if (maxRows !== undefined && all.length > maxRows) throw new RowLimitError(maxRows);
    if (rows.length < PAGE_SIZE) return all;
  }
}

export class RowLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`Dữ liệu vượt quá ${limit.toLocaleString('vi-VN')} dòng. Hãy thu hẹp bộ lọc (khoảng thời gian, danh mục...) rồi thử lại.`);
    this.name = 'RowLimitError';
  }
}

/** Chia mảng thành các nhóm nhỏ (ví dụ để tránh URL quá dài khi dùng `.in(...)` với nhiều id). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
