import { AlertOctagon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { alertMessage, alertTitle, type BudgetAlert } from '@/services/budgetAlerts';

/** Danh sách cảnh báo ngân sách, tính từ dữ liệu thật. Không gửi email/SMS/push (chưa có hệ thống tương ứng). */
export function AlertList({ alerts, currency, categoryName }: { alerts: BudgetAlert[]; currency: string; categoryName: (id: string) => string | undefined }) {
  if (alerts.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Cảnh báo ngân sách">
      {alerts.map((a) => {
        const danger = a.severity === 'danger';
        const Icon = danger ? AlertOctagon : AlertTriangle;
        return (
          <li
            key={a.key}
            role={danger ? 'alert' : 'status'}
            className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', danger ? 'border-danger/30 bg-danger/5' : 'border-accent/40 bg-accent/10')}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', danger ? 'text-danger' : 'text-accent-600')} aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold text-navy">{alertTitle(a, a.categoryId ? categoryName(a.categoryId) : undefined)}</p>
              <p className="text-slate-600">{alertMessage(a, currency)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
