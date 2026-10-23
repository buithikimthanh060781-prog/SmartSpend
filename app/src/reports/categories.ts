import { compareValues, percentOf, type Comparison } from '@/reports/comparison';
import { round2, sumMoney } from '@/lib/money';
import type { ExpenseRow } from '@/reports/summary';

export interface CategoryRef {
  id: string;
  name: string;
  is_active: boolean;
  color: string | null;
  icon: string | null;
}

export interface CategoryReportRow {
  categoryId: string;
  name: string;
  isActive: boolean;
  /** false khi danh mục không còn trong danh sách (dữ liệu lịch sử vẫn được hiển thị). */
  known: boolean;
  color: string | null;
  icon: string | null;
  total: number;
  count: number;
  /** total / tổng chi * 100; null khi tổng chi = 0. */
  sharePercent: number | null;
  /** total / count; null khi count = 0. */
  avgPerTransaction: number | null;
  /** So với kỳ trước (null nếu không có dữ liệu kỳ trước để so sánh). */
  change: Comparison | null;
}

export interface CategoryReport {
  rows: CategoryReportRow[];
  total: number;
  count: number;
}

export const UNKNOWN_CATEGORY_NAME = 'Chưa phân loại';

/**
 * Cột "so với kỳ trước" phải so sánh hai bên có CÙNG SỐ NGÀY. Khi kỳ hiện tại chưa kết thúc (hoặc dài hơn kỳ trước),
 * tổng hiển thị của danh mục vẫn là toàn bộ kỳ, nhưng phần thay đổi được tính từ `currentComparable` (cùng số ngày với `previous`).
 */
export function withComparableChanges(
  report: CategoryReport,
  currentComparable: readonly ExpenseRow[],
  previous: readonly ExpenseRow[],
): CategoryReport {
  const sumBy = (rows: readonly ExpenseRow[], id: string) => sumMoney(rows.filter((r) => r.category_id === id), (r) => r.amount);
  return {
    ...report,
    rows: report.rows.map((row) => ({ ...row, change: compareValues(sumBy(currentComparable, row.categoryId), sumBy(previous, row.categoryId)) })),
  };
}

/**
 * Chi tiêu theo danh mục. Danh mục ĐÃ NGỪNG HOẠT ĐỘNG vẫn được hiển thị (báo cáo lịch sử) kèm cờ isActive.
 * Danh mục chỉ có chi tiêu ở kỳ trước cũng được liệt kê (kỳ này = 0) để thấy sự giảm.
 * `previous` là chi tiêu của kỳ so sánh (đã lọc đúng khoảng ngày); bỏ qua nếu không so sánh.
 */
export function buildCategoryReport(expenses: readonly ExpenseRow[], categories: readonly CategoryRef[], previous?: readonly ExpenseRow[]): CategoryReport {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const group = (rows: readonly ExpenseRow[]) => {
    const m = new Map<string, ExpenseRow[]>();
    for (const r of rows) (m.get(r.category_id) ?? m.set(r.category_id, []).get(r.category_id)!).push(r);
    return m;
  };
  const cur = group(expenses);
  const prev = previous ? group(previous) : null;
  const total = sumMoney(expenses, (r) => r.amount);

  const ids = new Set([...cur.keys(), ...(prev ? prev.keys() : [])]);
  const rows: CategoryReportRow[] = [...ids].map((id) => {
    const list = cur.get(id) ?? [];
    const ref = byId.get(id);
    const t = sumMoney(list, (r) => r.amount);
    return {
      categoryId: id,
      name: ref?.name ?? UNKNOWN_CATEGORY_NAME,
      isActive: ref?.is_active ?? false,
      known: Boolean(ref),
      color: ref?.color ?? null,
      icon: ref?.icon ?? null,
      total: t,
      count: list.length,
      sharePercent: percentOf(t, total),
      avgPerTransaction: list.length > 0 ? round2(t / list.length) : null,
      change: prev ? compareValues(t, sumMoney(prev.get(id) ?? [], (r) => r.amount)) : null,
    };
  });

  rows.sort((a, b) => b.total - a.total || b.count - a.count || a.name.localeCompare(b.name, 'vi'));
  return { rows, total, count: expenses.length };
}
