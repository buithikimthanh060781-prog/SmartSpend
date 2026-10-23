import { describe, expect, it } from 'vitest';
import { findDuplicateCategory, findInvalidTypeCategories, selectableCategories } from '@/hooks/useCategories';
import { toMutationMessage } from '@/lib/errors';
import { sanitizeSearch } from '@/lib/search';
import type { SsCategory } from '@/types/db';

describe('sanitizeSearch', () => {
  it('loại ký tự đặc biệt của cú pháp filter PostgREST', () => {
    expect(sanitizeSearch('a,b)(c%d*e')).toBe('a b c d e');
    expect(sanitizeSearch('  cà   phê ')).toBe('cà phê');
  });
});

describe('toMutationMessage', () => {
  it('dịch lỗi ràng buộc database', () => {
    expect(toMutationMessage({ code: '23505' })).toMatch(/trùng/);
    expect(toMutationMessage({ code: '23503' })).toMatch(/liên kết/);
    expect(toMutationMessage({ code: '23514' })).toMatch(/ràng buộc/);
    expect(toMutationMessage({ code: '42501' })).toMatch(/quyền/);
  });
  it('giữ nội dung trigger (P0001) để người dùng biết quy tắc nào bị vi phạm', () => {
    expect(toMutationMessage({ code: 'P0001', message: 'plan has linked expenses' })).toContain('plan has linked expenses');
  });
});

function cat(over: Partial<SsCategory>): SsCategory {
  return {
    id: 'c1', user_id: 'u', name: 'Ăn uống', type: 'expense', icon: null, color: null,
    is_active: true, is_default: false, created_at: '', updated_at: '', ...over,
  };
}

describe('danh mục', () => {
  const all = [
    cat({ id: 'a', name: 'Ăn uống' }),
    cat({ id: 'b', name: 'Cũ', is_active: false }),
    cat({ id: 'c', name: 'Lương', type: 'income' }),
  ];

  it('chỉ danh mục active khi tạo giao dịch mới, giữ danh mục đã tắt khi sửa', () => {
    expect(selectableCategories(all, 'expense').map((c) => c.id)).toEqual(['a']);
    expect(selectableCategories(all, 'expense', 'b').map((c) => c.id)).toEqual(['a', 'b']);
    expect(selectableCategories(all, 'income').map((c) => c.id)).toEqual(['c']);
  });

  it('phát hiện BẤT KỲ danh mục nào có type không hợp lệ (không chỉ khi tất cả đều sai)', () => {
    expect(findInvalidTypeCategories(all)).toEqual([]);
    const mixed = [...all, cat({ id: 'z', name: 'Lạ', type: 'saving' })];
    expect(findInvalidTypeCategories(mixed).map((c) => c.id)).toEqual(['z']);
    expect(findInvalidTypeCategories([cat({ id: 'q', type: 'Income' })])).toHaveLength(1); // phân biệt hoa thường
  });

  it('chặn trùng tên cùng loại, không phân biệt hoa thường; khác loại thì được', () => {
    expect(findDuplicateCategory(all, 'expense', '  ĂN   UỐNG ')?.id).toBe('a');
    expect(findDuplicateCategory(all, 'income', 'Ăn uống')).toBeUndefined();
    expect(findDuplicateCategory(all, 'expense', 'Ăn uống', 'a')).toBeUndefined(); // đang sửa chính nó
  });
});
