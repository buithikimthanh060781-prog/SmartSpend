import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { CATEGORY_QUERY_ROOTS, invalidateRoots, MONEY_QUERY_ROOTS } from '@/hooks/useInvalidate';

function seeded() {
  const qc = new QueryClient();
  const keys = [
    ['dashboard', 'u1'],
    ['incomes', 'list', 'u1', { page: 1 }],
    ['incomes', 'totals', 'u1', {}],
    ['expenses', 'list', 'u1', { page: 1 }],
    ['expenses', 'total', 'u1', {}],
    ['plans', 'list', 'u1', {}],
    ['plans', 'linkable', 'u1', 'cat'],
    ['plans', 'detail', 'p1'],
    ['budgets', 'list', 'u1', {}],
    ['budgets', 'overview', 'u1', '2026-10-18'],
    ['budgets', 'audit', 'u1', {}],
    ['reports', 'u1'],
    ['categories', 'u1'],
    ['settings', 'u1'],
  ];
  for (const k of keys) qc.setQueryData(k, 1);
  const stale = (k: readonly unknown[]) => qc.getQueryState(k)?.isInvalidated === true;
  return { qc, stale };
}

describe('làm mới dữ liệu sau thao tác ghi', () => {
  it('thêm/sửa/xóa thu nhập, chi tiêu, kế hoạch làm mới Dashboard, danh sách, tổng, báo cáo', async () => {
    const { qc, stale } = seeded();
    await invalidateRoots(qc, MONEY_QUERY_ROOTS);
    for (const k of [
      ['dashboard', 'u1'],
      ['incomes', 'list', 'u1', { page: 1 }],
      ['incomes', 'totals', 'u1', {}],
      ['expenses', 'list', 'u1', { page: 1 }],
      ['expenses', 'total', 'u1', {}],
      ['plans', 'list', 'u1', {}],
      ['plans', 'linkable', 'u1', 'cat'],
      ['plans', 'detail', 'p1'],
      ['budgets', 'list', 'u1', {}], // chi tiêu đổi thì thực chi và cảnh báo ngân sách phải tính lại
      ['budgets', 'overview', 'u1', '2026-10-18'],
      ['reports', 'u1'],
    ]) {
      expect(stale(k), JSON.stringify(k)).toBe(true);
    }
    expect(stale(['settings', 'u1'])).toBe(false);
  });

  it('thay đổi danh mục làm mới thêm danh mục và Dashboard (tên hiển thị)', async () => {
    const { qc, stale } = seeded();
    await invalidateRoots(qc, CATEGORY_QUERY_ROOTS);
    expect(stale(['categories', 'u1'])).toBe(true);
    expect(stale(['dashboard', 'u1'])).toBe(true);
    expect(stale(['expenses', 'list', 'u1', { page: 1 }])).toBe(true);
  });
});
