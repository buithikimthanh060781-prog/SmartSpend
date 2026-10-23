import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { useInvalidateMoney } from '@/hooks/useInvalidate';
import {
  createExpense,
  deleteExpense,
  expenseTotal,
  listExpenses,
  updateExpense,
  type ExpenseFilters,
  type ExpenseInput,
} from '@/services/expenses';
import { listLinkablePlans } from '@/services/plans';

export function useExpenses(filters: ExpenseFilters) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: ['expenses', 'list', userId, filters],
    enabled: Boolean(userId),
    queryFn: () => listExpenses(userId, filters),
    placeholderData: keepPreviousData,
  });
}

export function useExpenseTotal(filters: ExpenseFilters) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { page: _page, sort: _sort, ...rest } = filters;
  return useQuery({
    queryKey: ['expenses', 'total', userId, rest],
    enabled: Boolean(userId),
    queryFn: () => expenseTotal(userId, filters),
  });
}

/** Kế hoạch có thể liên kết: của người dùng, cùng danh mục, chưa hủy. */
export function useLinkablePlans(categoryId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: ['plans', 'linkable', userId, categoryId],
    enabled: Boolean(userId && categoryId),
    queryFn: () => listLinkablePlans(userId, categoryId),
  });
}

export function useExpenseMutations() {
  const { user } = useAuth();
  const invalidate = useInvalidateMoney();
  return {
    create: useMutation({ mutationFn: (i: ExpenseInput) => createExpense(user?.id ?? '', i), onSuccess: invalidate }),
    update: useMutation({ mutationFn: (v: { id: string; input: ExpenseInput }) => updateExpense(user?.id ?? '', v.id, v.input), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => deleteExpense(id), onSuccess: invalidate }),
  };
}
