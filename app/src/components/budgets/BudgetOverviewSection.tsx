import { PiggyBank, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertList } from '@/components/budgets/AlertList';
import { StatusBadge, UsageBar } from '@/components/budgets/BudgetStatus';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBudgetOverview } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { PERIOD_TYPES, PERIOD_TYPE_LABEL, type PeriodType } from '@/lib/budget';
import { toUserMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { periodLabel } from '@/lib/periods';
import { cn } from '@/lib/utils';
import type { BudgetEvaluation } from '@/services/budgetCalculation';

const PERIOD_TITLE: Record<PeriodType, string> = { daily: 'Hôm nay', weekly: 'Tuần này', monthly: 'Tháng này' };
const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });

/** Phân tích ngân sách trên Dashboard: ngân sách ngày/tuần/tháng hiện tại, danh mục sắp vượt/đã vượt, biểu đồ và cảnh báo. */
export function BudgetOverviewSection({ currency }: { currency: string }) {
  const overview = useBudgetOverview();
  const { byId } = useCategories();
  const [type, setType] = useState<PeriodType>('monthly');
  const categoryName = (id: string) => byId.get(id)?.name;

  if (overview.isLoading) return <Skeleton className="h-64" role="status" aria-label="Đang tải ngân sách" />;
  if (overview.error) return <ErrorState title="Không tải được ngân sách" message={toUserMessage(overview.error)} onRetry={() => void overview.refetch()} />;
  const data = overview.data;
  if (!data) return null;

  if (data.evaluations.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={PiggyBank}
          title="Chưa thiết lập ngân sách"
          description="Đặt hạn mức theo ngày, tuần hoặc tháng để theo dõi mức chi tiêu và nhận cảnh báo khi sắp vượt."
          action={
            <Button asChild variant="accent">
              <Link to="/budgets">
                <Plus className="h-4 w-4" aria-hidden />
                Thiết lập ngân sách
              </Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const selected = data.byPeriod[type];
  const nearLimit = selected.categories.filter((c) => c.status === 'warning' || c.status === 'exhausted');
  const exceeded = selected.categories.filter((c) => c.status === 'exceeded');
  const chartRows = [
    ...(selected.total ? [{ name: 'Tổng', budget: selected.total.amount, spent: selected.total.spent }] : []),
    ...selected.categories.map((c) => ({ name: categoryName(c.budget.category_id as string) ?? 'Danh mục', budget: c.amount, spent: c.spent })),
  ];

  return (
    <section aria-label="Phân tích ngân sách" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-navy">
          Ngân sách {data.alerts.length > 0 && <Badge tone="danger">{data.alerts.length} cảnh báo</Badge>}
        </h2>
        <Button asChild variant="outline" size="sm">
          <Link to="/budgets">Quản lý ngân sách</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PERIOD_TYPES.map((t) => {
          const p = data.byPeriod[t];
          return (
            <Card key={t} className={cn('p-5', t === type && 'ring-2 ring-accent/60')}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-navy">Ngân sách {PERIOD_TYPE_LABEL[t].toLowerCase()} · {PERIOD_TITLE[t]}</p>
                {p.total && <StatusBadge status={p.total.status} zeroBudget={p.total.amount === 0} />}
              </div>
              <p className="text-xs text-slate-500">{periodLabel(p.period)}</p>
              {p.total ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xl font-bold text-navy">{p.total.remaining < 0 ? `Vượt ${formatMoney(p.total.overspent, currency)}` : `Còn ${formatMoney(p.total.remaining, currency)}`}</p>
                  <UsageBar ev={p.total} currency={currency} />
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  Chưa thiết lập ·{' '}
                  <Link to="/budgets" className="text-accent-600 underline">Thiết lập ngân sách</Link>
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <div role="tablist" aria-label="Lọc theo kỳ" className="inline-flex rounded-xl bg-white p-1 shadow-card">
        {PERIOD_TYPES.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={cn('rounded-lg px-4 py-1.5 text-sm font-semibold', type === t ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-50')}
          >
            {PERIOD_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ngân sách và thực chi · {PERIOD_TYPE_LABEL[type].toLowerCase()}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartRows.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">Chưa có ngân sách {PERIOD_TYPE_LABEL[type].toLowerCase()} cho kỳ này.</p>
            ) : (
              <div className="h-64" role="img" aria-label={`Biểu đồ ngân sách và thực chi ${PERIOD_TYPE_LABEL[type].toLowerCase()}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v: number) => compact.format(v)} width={48} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => formatMoney(v, currency)} />
                    <Legend />
                    <Bar dataKey="budget" name="Hạn mức" fill="#142B49" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spent" name="Thực chi" fill="#F58B2B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh mục cần chú ý</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryGroup title="Đã vượt" items={exceeded} categoryName={categoryName} currency={currency} />
            <CategoryGroup title="Sắp vượt" items={nearLimit} categoryName={categoryName} currency={currency} />
            {exceeded.length === 0 && nearLimit.length === 0 && <p className="text-sm text-slate-500">Chưa có danh mục nào sắp vượt hoặc đã vượt ngân sách {PERIOD_TYPE_LABEL[type].toLowerCase()}.</p>}
          </CardContent>
        </Card>
      </div>

      {data.alerts.length > 0 && <AlertList alerts={data.alerts} currency={currency} categoryName={categoryName} />}
    </section>
  );
}

function CategoryGroup({ title, items, categoryName, currency }: { title: string; items: BudgetEvaluation[]; categoryName: (id: string) => string | undefined; currency: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="space-y-3">
        {items.map((ev) => (
          <li key={ev.budget.id}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-navy">{categoryName(ev.budget.category_id as string) ?? 'Danh mục'}</span>
              <StatusBadge status={ev.status} zeroBudget={ev.amount === 0} />
            </div>
            <UsageBar ev={ev} currency={currency} />
          </li>
        ))}
      </ul>
    </div>
  );
}
