import { useCallback } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useToast } from '@/components/ui/toast';
import { useCategories } from '@/hooks/useCategories';
import { useSettings } from '@/hooks/useSettings';
import { getAlertSession } from '@/services/alertSession';
import { alertMessage, alertTitle, type BudgetAlert } from '@/services/budgetAlerts';
import { loadBudgetOverview } from '@/services/budgets';

/**
 * Toast cảnh báo ngân sách khi một thao tác ghi chi tiêu khiến ngân sách chạm ngưỡng hoặc vượt ngưỡng.
 * Dùng: `const before = await snapshot(date)` TRƯỚC khi ghi, rồi `await notify(before, date)` SAU khi ghi thành công.
 * Mọi lỗi ở đây chỉ được ghi log: tuyệt đối không chặn việc ghi nhận chi tiêu (người dùng vẫn được chi vượt ngân sách).
 */
export function useExpenseBudgetAlerts() {
  const { user } = useAuth();
  const toast = useToast();
  const { currency } = useSettings();
  const { byId } = useCategories();
  const userId = user?.id ?? '';

  const snapshot = useCallback(
    async (date: string): Promise<BudgetAlert[] | null> => {
      try {
        return (await loadBudgetOverview(userId, date)).alerts;
      } catch (e) {
        console.warn('[Smart Spend] Không tính được cảnh báo ngân sách trước khi ghi:', e);
        return null;
      }
    },
    [userId],
  );

  const notify = useCallback(
    async (before: BudgetAlert[] | null, date: string): Promise<void> => {
      if (before === null) return; // không có mốc "trước" thì không thể biết sự kiện mới, tránh báo sai
      try {
        const after = (await loadBudgetOverview(userId, date)).alerts;
        for (const alert of getAlertSession(userId).resolve(before, after)) {
          const text = `${alertTitle(alert, alert.categoryId ? byId.get(alert.categoryId)?.name : undefined)}: ${alertMessage(alert, currency)}`;
          if (alert.severity === 'danger') toast.error(text);
          else toast.warning(text);
        }
      } catch (e) {
        console.warn('[Smart Spend] Không tính được cảnh báo ngân sách sau khi ghi:', e);
      }
    },
    [userId, toast, currency, byId],
  );

  return { snapshot, notify };
}
