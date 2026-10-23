import { useMemo } from 'react';
import { useBudgetOverview } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { usePeriodData, useToday } from '@/hooks/useReportData';
import { useSettings } from '@/hooks/useSettings';
import { buildMonthAnalytics, monthWindow } from '@/reports/monthAnalytics';
import type { Granularity } from '@/reports/series';

/**
 * Phân tích tháng hiện tại cho Dashboard (so sánh tháng trước cùng số ngày, biểu đồ, nhận xét).
 * Dữ liệu đi qua usePeriodData (query key có user.id và cửa sổ ngày) nên được làm mới sau mọi thao tác ghi và
 * không bao giờ hiển thị cache của tài khoản khác.
 */
export function useMonthAnalytics(granularity: Granularity) {
  const today = useToday();
  const { currency } = useSettings();
  const { categories } = useCategories();
  const overview = useBudgetOverview();
  const { window } = monthWindow(today);
  const period = usePeriodData(window);

  const analytics = useMemo(
    () =>
      period.data
        ? buildMonthAnalytics(period.data.incomes, period.data.expenses, categories, today, overview.data?.byPeriod.monthly.total ?? null, currency, granularity)
        : null,
    [period.data, categories, today, overview.data, currency, granularity],
  );

  return { analytics, isLoading: period.isLoading, error: period.error, refetch: period.refetch };
}
