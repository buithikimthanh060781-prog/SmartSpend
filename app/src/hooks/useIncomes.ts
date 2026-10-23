import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { useInvalidateMoney } from '@/hooks/useInvalidate';
import {
  createIncome,
  deleteIncome,
  incomeTotals,
  listIncomes,
  updateIncome,
  type IncomeFilters,
  type IncomeInput,
} from '@/services/incomes';

export function useIncomes(filters: IncomeFilters) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: ['incomes', 'list', userId, filters],
    enabled: Boolean(userId),
    queryFn: () => listIncomes(userId, filters),
    placeholderData: keepPreviousData,
  });
}

export function useIncomeTotals(filters: IncomeFilters) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  // Tổng không phụ thuộc trang và bộ lọc trạng thái.
  const { page: _page, status: _status, ...rest } = filters;
  return useQuery({
    queryKey: ['incomes', 'totals', userId, rest],
    enabled: Boolean(userId),
    queryFn: () => incomeTotals(userId, filters),
  });
}

export function useIncomeMutations() {
  const { user } = useAuth();
  const invalidate = useInvalidateMoney();
  return {
    create: useMutation({ mutationFn: (i: IncomeInput) => createIncome(user?.id ?? '', i), onSuccess: invalidate }),
    update: useMutation({ mutationFn: (v: { id: string; input: IncomeInput }) => updateIncome(v.id, v.input), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => deleteIncome(id), onSuccess: invalidate }),
  };
}
