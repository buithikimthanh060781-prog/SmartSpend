import { PiggyBank } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AlertList } from '@/components/budgets/AlertList';
import { StatusBadge, UsageBar } from '@/components/budgets/BudgetStatus';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERIOD_TYPES, PERIOD_TYPE_LABEL } from '@/lib/budget';
import { toUserMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { periodLabel } from '@/lib/periods';
import type { BudgetEvaluation } from '@/services/budgetCalculation';
import type { BudgetOverview } from '@/services/budgets';

interface Props {
  overview: BudgetOverview | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  date: string;
  onDate: (d: string) => void;
  currency: string;
  categoryName: (id: string) => string | undefined;
}

/**
 * Báo cáo ngân sách của các kỳ ngày/tuần/tháng chứa một ngày tham chiếu. Các hạn mức độc lập: KHÔNG cộng ngân sách khác kỳ
 * với nhau, và KHÔNG cộng ngân sách tổng với ngân sách danh mục để tạo ra một "tổng ngân sách" giả.
 */
export function BudgetsReportView({ overview, isLoading, error, onRetry, date, onDate, currency, categoryName }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="budget-ref" className="mb-1.5 block text-sm font-semibold text-navy">Ngày tham chiếu</label>
          <Input id="budget-ref" type="date" className="w-auto" value={date} onChange={(e) => e.target.value && onDate(e.target.value)} />
        </div>
        <p className="max-w-xl text-xs text-slate-500">
          Hiển thị ngân sách của ngày, tuần ISO và tháng chứa ngày này. Các hạn mức độc lập, không cộng gộp với nhau.
        </p>
      </div>

      {isLoading && <Skeleton className="h-64" role="status" aria-label="Đang tải ngân sách" />}
      {error != null && !isLoading && <ErrorState message={toUserMessage(error)} onRetry={onRetry} />}

      {overview && overview.evaluations.length === 0 && (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title="Chưa thiết lập ngân sách cho kỳ này"
            description="Chưa có ngân sách thì sẽ không có cảnh báo vượt hạn mức."
            action={<Button asChild variant="accent"><Link to="/budgets?new=1">Thiết lập ngân sách</Link></Button>}
          />
        </Card>
      )}

      {overview && overview.alerts.length > 0 && <AlertList alerts={overview.alerts} currency={currency} categoryName={categoryName} />}

      {overview && overview.evaluations.length > 0 &&
        PERIOD_TYPES.map((t) => {
          const p = overview.byPeriod[t];
          const all: Array<{ ev: BudgetEvaluation; label: string }> = [
            ...(p.total ? [{ ev: p.total, label: 'Tổng chi tiêu' }] : []),
            ...p.categories.map((ev) => ({ ev, label: categoryName(ev.budget.category_id as string) ?? 'Danh mục' })),
          ];
          return (
            <Card key={t}>
              <CardHeader>
                <CardTitle>Ngân sách {PERIOD_TYPE_LABEL[t].toLowerCase()} · {periodLabel(p.period)}</CardTitle>
              </CardHeader>
              {all.length === 0 ? (
                <p className="px-5 pb-5 text-sm font-semibold text-slate-500">Chưa thiết lập ngân sách {PERIOD_TYPE_LABEL[t].toLowerCase()} cho kỳ này.</p>
              ) : (
                <ul className="divide-y divide-slate-100 px-5 pb-2">
                  {all.map(({ ev, label }) => (
                    <li key={ev.budget.id} className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-navy">{label}</p>
                        <StatusBadge status={ev.status} zeroBudget={ev.amount === 0} />
                      </div>
                      <p className="text-xs text-slate-500">
                        Hạn mức {formatMoney(ev.amount, currency)} · {ev.remaining < 0 ? `Vượt ${formatMoney(ev.overspent, currency)}` : `Còn lại ${formatMoney(ev.remaining, currency)}`}
                      </p>
                      <UsageBar ev={ev} currency={currency} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
    </div>
  );
}
