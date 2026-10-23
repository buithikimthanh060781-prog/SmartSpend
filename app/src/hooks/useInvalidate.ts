import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/** Mọi thay đổi thu nhập/chi tiêu/kế hoạch phải làm mới Dashboard và báo cáo liên quan. */
export const MONEY_QUERY_ROOTS = ['incomes', 'expenses', 'plans', 'budgets', 'dashboard', 'reports'] as const;

/** Thay đổi danh mục ảnh hưởng tên/trạng thái hiển thị ở mọi nơi nên làm mới thêm 'categories'. */
export const CATEGORY_QUERY_ROOTS = ['categories', ...MONEY_QUERY_ROOTS] as const;

export function invalidateRoots(qc: QueryClient, roots: readonly string[]): Promise<unknown[]> {
  return Promise.all(roots.map((root) => qc.invalidateQueries({ queryKey: [root] })));
}

export function useInvalidateMoney() {
  const qc = useQueryClient();
  return useCallback(() => invalidateRoots(qc, MONEY_QUERY_ROOTS), [qc]);
}
