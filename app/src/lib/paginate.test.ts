import { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { fetchAllRows } from '@/lib/paginate';

function fakeTable(total: number) {
  const calls: Array<[number, number]> = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const rows = Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => from + i);
    return { data: rows, error: null };
  };
  return { page, calls };
}

describe('fetchAllRows', () => {
  it('lấy đủ hơn 1000 dòng (không bị cắt ở trang đầu)', async () => {
    const t = fakeTable(2500);
    const rows = await fetchAllRows<number>(t.page);
    expect(rows).toHaveLength(2500);
    expect(t.calls).toHaveLength(3);
  });

  it('đúng 1000 dòng vẫn dừng đúng sau trang rỗng kế tiếp', async () => {
    const t = fakeTable(1000);
    expect(await fetchAllRows<number>(t.page)).toHaveLength(1000);
  });

  it('bảng rỗng', async () => {
    expect(await fetchAllRows<number>(fakeTable(0).page)).toEqual([]);
  });

  it('ném lỗi khi truy vấn lỗi', async () => {
    const err = new PostgrestError({ message: 'boom', details: '', hint: '', code: 'X' });
    await expect(fetchAllRows<number>(async () => ({ data: null, error: err }))).rejects.toBe(err);
  });
});
