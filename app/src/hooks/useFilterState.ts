import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounced } from '@/hooks/useDebounced';

/**
 * Quản lý bộ lọc của trang danh sách: ô tìm kiếm có debounce, đổi bộ lọc luôn về trang 1.
 * `isFiltering` = có bộ lọc nào khác mặc định (dùng để phân biệt "chưa có dữ liệu" và "không có kết quả").
 */
export function useFilterState<T extends { search: string; page: number }>(initial: T, start: T = initial) {
  // `start` cho phép mở trang với bộ lọc có sẵn (ví dụ từ liên kết trong báo cáo) trong khi `initial` vẫn là mốc "chưa lọc".
  const [filters, setFilters] = useState<T>(start);
  const [searchInput, setSearchInput] = useState(start.search);
  const debounced = useDebounced(searchInput, 300);

  useEffect(() => {
    setFilters((f) => (f.search === debounced ? f : { ...f, search: debounced, page: 1 }));
  }, [debounced]);

  const patch = useCallback((p: Partial<T>) => {
    setFilters((f) => ({ ...f, ...p, page: 'page' in p && p.page !== undefined ? p.page : 1 }));
  }, []);

  const reset = useCallback(() => {
    setSearchInput(initial.search);
    setFilters(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFiltering = useMemo(
    () => (Object.keys(initial) as Array<keyof T>).some((k) => k !== 'page' && k !== 'sort' && filters[k] !== initial[k]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters],
  );

  return { filters, searchInput, setSearchInput, patch, reset, isFiltering };
}
