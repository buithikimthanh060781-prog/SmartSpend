import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { invalidateRoots } from '@/hooks/useInvalidate';
import { todayIso, useSettings } from '@/hooks/useSettings';
import { useQueryClient } from '@tanstack/react-query';
import {
  countBudgetAuditLogs,
  createBudget,
  deleteBudget,
  listBudgetAuditLogs,
  listBudgetEvaluations,
  listBudgetsByIds,
  loadBudgetOverview,
  updateBudgetAmount,
  type AuditFilters,
  type BudgetFilters,
  type BudgetInput,
} from '@/services/budgets';

/** Mọi thay đổi ngân sách phải làm mới danh sách, Dashboard, cảnh báo và lịch sử (do trigger database ghi). */
const BUDGET_ROOTS = ['budgets', 'dashboard', 'reports'] as const;

export function useBudgetList(filters: BudgetFilters) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: ['budgets', 'list', userId, filters],
    enabled: Boolean(userId),
    queryFn: () => listBudgetEvaluations(userId, filters),
    placeholderData: keepPreviousData,
  });
}

/**
 * Ngân sách ngày/tuần/tháng đang áp dụng cho `date` (mặc định hôm nay theo múi giờ người dùng) + cảnh báo.
 * Query key chứa user.id và ngày tham chiếu.
 */
export function useBudgetOverview(date?: string, enabled = true) {
  const { user } = useAuth();
  const { timezone } = useSettings();
  const userId = user?.id ?? '';
  const day = date ?? todayIso(timezone);
  return useQuery({
    queryKey: ['budgets', 'overview', userId, day],
    enabled: Boolean(userId) && enabled,
    queryFn: () => loadBudgetOverview(userId, day),
  });
}

export function useBudgetAuditLogs(filters: AuditFilters) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: ['budgets', 'audit', userId, filters],
    enabled: Boolean(userId),
    queryFn: async () => {
      const page = await listBudgetAuditLogs(userId, filters);
      const budgets = await listBudgetsByIds([...new Set(page.rows.map((r) => r.budget_id))]);
      return { ...page, budgets: new Map(budgets.map((b) => [b.id, b])) };
    },
    placeholderData: keepPreviousData,
  });
}

export function useBudgetAuditCount(budgetId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['budgets', 'audit-count', budgetId],
    enabled: enabled && Boolean(budgetId),
    queryFn: () => countBudgetAuditLogs(budgetId),
  });
}

export function useBudgetMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const refresh = () => invalidateRoots(qc, BUDGET_ROOTS);
  return {
    create: useMutation({ mutationFn: (i: BudgetInput) => createBudget(user?.id ?? '', i), onSuccess: refresh }),
    updateAmount: useMutation({ mutationFn: (v: { id: string; amount: number }) => updateBudgetAmount(v.id, v.amount), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => deleteBudget(id), onSuccess: refresh }),
  };
}
