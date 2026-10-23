import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { CATEGORY_QUERY_ROOTS, invalidateRoots } from '@/hooks/useInvalidate';
import { CATEGORY_TYPES, type CategoryType } from '@/lib/constants';
import { normalizeCategoryName } from '@/schemas/category';
import {
  createCategory,
  deleteCategory,
  listCategories,
  setCategoryActive,
  updateCategory,
  type CategoryInput,
} from '@/services/categories';
import type { SsCategory } from '@/types/db';

export function useCategories() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const query = useQuery({
    queryKey: ['categories', userId],
    enabled: Boolean(userId),
    queryFn: () => listCategories(userId),
  });
  const categories = useMemo(() => query.data ?? [], [query.data]);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  return { ...query, categories, byId };
}

/** Danh mục dùng để TẠO giao dịch mới: chỉ active. Khi sửa, truyền thêm `keepId` để giữ danh mục hiện tại dù đã tắt. */
export function selectableCategories(all: SsCategory[], type: CategoryType, keepId?: string): SsCategory[] {
  return all.filter((c) => c.type === type && (c.is_active || c.id === keepId));
}

/** Danh mục có `type` không thuộc CATEGORY_TYPES (dữ liệu lạ hoặc giả định về giá trị type sai). */
export function findInvalidTypeCategories(all: SsCategory[]): SsCategory[] {
  return all.filter((c) => !(CATEGORY_TYPES as readonly string[]).includes(c.type));
}

/** Kiểm tra trùng tên cùng loại (không phân biệt hoa thường) trong danh mục của người dùng. */
export function findDuplicateCategory(all: SsCategory[], type: string, name: string, ignoreId?: string): SsCategory | undefined {
  const target = normalizeCategoryName(name);
  return all.find((c) => c.id !== ignoreId && c.type === type && normalizeCategoryName(c.name) === target);
}

export function useCategoryMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Tên/trạng thái danh mục xuất hiện ở Dashboard và các danh sách giao dịch nên phải làm mới cả chúng.
  const refresh = () => invalidateRoots(qc, CATEGORY_QUERY_ROOTS);

  return {
    create: useMutation({
      mutationFn: (input: CategoryInput) => createCategory(user?.id ?? '', input),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; input: Pick<CategoryInput, 'name' | 'icon' | 'color'> }) => updateCategory(user?.id ?? '', v.id, v.input),
      onSuccess: refresh,
    }),
    setActive: useMutation({
      mutationFn: (v: { id: string; isActive: boolean }) => setCategoryActive(v.id, v.isActive),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteCategory(id), onSuccess: refresh }),
  };
}
