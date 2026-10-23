import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { useInvalidateMoney } from '@/hooks/useInvalidate';
import type { PlanStatus } from '@/lib/constants';
import {
  createPlan,
  getPlan,
  listPlanExpenses,
  listPlans,
  planSpentMap,
  updatePlan,
  updatePlanStatus,
  type PlanFilters,
  type PlanInput,
} from '@/services/plans';

export function usePlans(filters: PlanFilters) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: ['plans', 'list', userId, filters],
    enabled: Boolean(userId),
    queryFn: async () => {
      const page = await listPlans(userId, filters);
      const spent = await planSpentMap(page.rows.map((p) => p.id));
      return { ...page, spent };
    },
    placeholderData: keepPreviousData,
  });
}

export function usePlanDetail(id: string) {
  return useQuery({
    queryKey: ['plans', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const plan = await getPlan(id);
      if (!plan) return null;
      const [expenses, spent] = await Promise.all([listPlanExpenses(id), planSpentMap([id])]);
      return { plan, expenses, spent: spent[id] ?? { spent: 0, count: 0 } };
    },
  });
}

export function usePlanMutations() {
  const { user } = useAuth();
  const invalidate = useInvalidateMoney();
  return {
    create: useMutation({ mutationFn: (i: PlanInput) => createPlan(user?.id ?? '', i), onSuccess: invalidate }),
    update: useMutation({ mutationFn: (v: { id: string; input: PlanInput }) => updatePlan(v.id, v.input), onSuccess: invalidate }),
    setStatus: useMutation({
      mutationFn: (v: { id: string; status: PlanStatus }) => updatePlanStatus(v.id, v.status),
      onSuccess: invalidate,
    }),
  };
}
