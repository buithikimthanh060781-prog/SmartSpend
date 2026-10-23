import { PAGE_SIZE } from '@/lib/constants';import { sanitizeSearch } from '@/lib/search';

/** Giao diện tối thiểu của PostgREST filter builder, đủ để dùng chung bộ lọc cho truy vấn danh sách và truy vấn tổng. */
export interface FilterBuilder {
  eq(column: string, value: string): FilterBuilder;
  neq(column: string, value: string): FilterBuilder;
  gt(column: string, value: string): FilterBuilder;
  gte(column: string, value: string): FilterBuilder;
  lt(column: string, value: string): FilterBuilder;
  lte(column: string, value: string): FilterBuilder;
  in(column: string, values: string[]): FilterBuilder;
  is(column: string, value: null): FilterBuilder;
  not(column: string, operator: string, value: null): FilterBuilder;
  or(filters: string): FilterBuilder;
}

export function withFilters<T>(query: T, apply: (q: FilterBuilder) => FilterBuilder): T {
  return apply(query as unknown as FilterBuilder) as unknown as T;
}

/** Tìm kiếm không phân biệt hoa thường trên các cột văn bản. Chuỗi rỗng thì không lọc. */
export function applySearch(q: FilterBuilder, search: string | undefined, columns: string[]): FilterBuilder {
  const term = sanitizeSearch(search ?? '');
  if (!term) return q;
  return q.or(columns.map((c) => `${c}.ilike.%${term}%`).join(','));
}

export function pageRange(page: number): [number, number] {
  const from = (Math.max(1, page) - 1) * PAGE_SIZE;
  return [from, from + PAGE_SIZE - 1];
}

export interface Paged<T> {
  rows: T[];
  total: number;
}
