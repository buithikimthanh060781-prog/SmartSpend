import { formatMoney, subtractMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/** So sánh kế hoạch (planned_amount) với tổng thực chi từ các giao dịch liên kết. planned_amount không được cộng vào chi tiêu. */
export function PlanProgress({ planned, spent, currency }: { planned: number; spent: number; currency: string }) {
  const percent = planned > 0 ? (spent / planned) * 100 : spent > 0 ? 100 : 0;
  const over = spent > planned;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="text-slate-500">
          Thực chi <strong className="text-navy">{formatMoney(spent, currency)}</strong> / Kế hoạch {formatMoney(planned, currency)}
        </span>
        <span className={cn('font-semibold', over ? 'text-danger' : 'text-slate-500')}>
          {over ? `Vượt ${formatMoney(subtractMoney(spent, planned), currency)}` : `Còn ${formatMoney(subtractMoney(planned, spent), currency)}`}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(percent))}
        aria-label="Tiến độ chi so với kế hoạch"
      >
        <div className={cn('h-full rounded-full', over ? 'bg-danger' : percent >= 80 ? 'bg-accent' : 'bg-success')} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
    </div>
  );
}
