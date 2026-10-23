import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/money';
import { formatPercent, STATUS_LABEL, type BudgetEvaluation, type BudgetStatus } from '@/services/budgetCalculation';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<BudgetStatus, 'success' | 'accent' | 'danger'> = {
  safe: 'success',
  warning: 'accent',
  exhausted: 'accent',
  exceeded: 'danger',
};

const BAR_COLOR: Record<BudgetStatus, string> = {
  safe: 'bg-success',
  warning: 'bg-accent',
  exhausted: 'bg-accent-600',
  exceeded: 'bg-danger',
};

export function StatusBadge({ status, zeroBudget }: { status: BudgetStatus; zeroBudget?: boolean }) {
  // Ngân sách bằng 0 chưa chi: hết hạn mức nhưng CHƯA vượt.
  const label = zeroBudget && status === 'exhausted' ? 'Hạn mức 0 · chưa vượt' : STATUS_LABEL[status];
  return <Badge tone={STATUS_TONE[status]}>{label}</Badge>;
}

/** Thanh tiến độ sử dụng. Độ rộng chỉ để hiển thị; màu/trạng thái đến từ so sánh chính xác trong engine. */
export function UsageBar({ ev, currency, showNumbers = true }: { ev: BudgetEvaluation; currency: string; showNumbers?: boolean }) {
  const width = ev.usagePercent === null ? (ev.spent > 0 ? 100 : 0) : Math.min(100, ev.usagePercent);
  return (
    <div>
      {showNumbers && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
          <span className="text-slate-500">
            Đã chi <strong className="text-navy">{formatMoney(ev.spent, currency)}</strong> / {formatMoney(ev.amount, currency)}
          </span>
          <span className={cn('font-semibold', ev.status === 'exceeded' ? 'text-danger' : 'text-slate-500')}>
            {ev.remaining < 0 ? `Vượt ${formatMoney(ev.overspent, currency)}` : `Còn ${formatMoney(ev.remaining, currency)}`}
            {ev.usagePercent !== null && ` · ${formatPercent(ev.usagePercent)}`}
          </span>
        </div>
      )}
      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-valuetext={ev.usagePercent === null ? 'Hạn mức bằng 0' : `Đã dùng ${formatPercent(ev.usagePercent)}`}
        aria-label="Mức sử dụng ngân sách"
      >
        <div className={cn('h-full rounded-full transition-all', BAR_COLOR[ev.status])} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
