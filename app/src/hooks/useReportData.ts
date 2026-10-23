import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { todayIso, useSettings } from '@/hooks/useSettings';
import type { DateRange } from '@/reports/ranges';
import { fetchPeriodData, fetchPlanData } from '@/services/reports';

/** Hợp của hai khoảng ngày liền kề hoặc chồng lấn: cửa sổ nhỏ nhất chứa cả hai. */
export function unionWindow(a: DateRange, b: DateRange): DateRange {
  return { start: a.start < b.start ? a.start : b.start, endExclusive: a.endExclusive > b.endExclusive ? a.endExclusive : b.endExclusive };
}

/** Ngày hôm nay (YYYY-MM-DD) theo múi giờ của người dùng; dùng chung cho mọi báo cáo. */
export function useToday(): string {
  const { timezone } = useSettings();
  return todayIso(timezone);
}

/**
 * Thu/chi trong một cửa sổ ngày. Query key chứa user.id và cửa sổ nên không bao giờ hiển thị cache của tài khoản khác;
 * gốc 'reports' được làm mới sau mọi thao tác thu nhập/chi tiêu/kế hoạch/ngân sách.
 */
export function usePeriodData(window: DateRange | null) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: ['reports', 'period', userId, window?.start, window?.endExclusive],
    enabled: Boolean(userId && window),
    queryFn: () => fetchPeriodData(userId, window as DateRange),
    placeholderData: keepPreviousData,
  });
}

export function usePlanData(range: DateRange | null) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: ['reports', 'plans', userId, range?.start, range?.endExclusive],
    enabled: Boolean(userId && range),
    queryFn: () => fetchPlanData(userId, range as DateRange),
    placeholderData: keepPreviousData,
  });
}
