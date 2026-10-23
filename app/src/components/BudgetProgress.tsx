import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

interface BudgetProgressProps {
  /** Hạn mức tháng; null nếu chưa thiết lập. */
  limit: number | null;
  spent: number;
  currency: string;
}

export function BudgetProgress({ limit, spent, currency }: BudgetProgressProps) {
  if (limit === null) {
    return (
      <div>
        <p className="font-semibold text-navy">Chưa thiết lập hạn mức</p>
        <p className="mt-1 text-sm text-slate-500">Đặt ngân sách tháng để theo dõi mức chi tiêu của bạn.</p>
      </div>
    );
  }

  const percent = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 100 : 0;
  const over = spent > limit;
  const color = over ? 'bg-danger' : percent >= 80 ? 'bg-accent' : 'bg-success';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold text-navy">{Math.round(percent)}% hạn mức</p>
        <p className="text-sm text-slate-500">
          {formatMoney(spent, currency)} / {formatMoney(limit, currency)}
        </p>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(percent))}
        aria-label="Mức sử dụng hạn mức tháng"
      >
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      {over && <p className="mt-2 text-sm font-semibold text-danger">Đã vượt hạn mức {formatMoney(spent - limit, currency)}</p>}
    </div>
  );
}
