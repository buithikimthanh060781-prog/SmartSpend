import { ArrowDownRight, ArrowUpRight, CalendarCheck, CalendarX, Inbox, Percent, PiggyBank, Plus, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CategoryDonutCard } from '@/components/dashboard/CategoryDonutCard';
import { InsightsCard } from '@/components/dashboard/InsightsCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ChangeBadge } from '@/components/reports/ChangeBadge';
import { TimeSeriesView } from '@/components/reports/TimeSeriesView';
import { useMonthAnalytics } from '@/hooks/useMonthAnalytics';
import { formatRatio, percentOf } from '@/reports/comparison';
import type { Granularity } from '@/reports/series';
import { subtractMoney } from '@/lib/money';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { BudgetOverviewSection } from '@/components/budgets/BudgetOverviewSection';
import { BudgetProgress } from '@/components/BudgetProgress';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RECENT_LIMIT, useDashboard } from '@/features/dashboard/useDashboard';
import { formatDate } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();
  const [granularity, setGranularity] = useState<Granularity>('day');
  const analytics = useMonthAnalytics(granularity);
  const cmp = analytics.analytics?.comparison ?? null;
  const vsLabel = 'so với cùng kỳ tháng trước';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">Tổng quan</h1>
        <p className="text-sm text-slate-500">{data ? data.month.label : 'Tháng hiện tại'}</p>
      </div>

      <QuickActions />

      {isLoading && <LoadingSkeleton />}

      {error && !isLoading && (
        <ErrorState message={toUserMessage(error, 'Không tải được dữ liệu tổng quan. Vui lòng thử lại.')} onRetry={() => void refetch()} />
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Thu nhập thực nhận"
              value={formatMoney(data.income, data.currency)}
              icon={TrendingUp}
              tone="success"
              footer={cmp && <ChangeBadge change={cmp.receivedIncome} currency={data.currency} label={vsLabel} />}
            />
            <StatCard
              label="Tổng chi tiêu"
              value={formatMoney(data.expense, data.currency)}
              icon={TrendingDown}
              tone="danger"
              footer={cmp && <ChangeBadge change={cmp.actualExpense} currency={data.currency} label={vsLabel} />}
            />
            <StatCard
              label="Chênh lệch thu chi"
              value={formatMoney(subtractMoney(data.income, data.expense), data.currency)}
              hint="Thu nhập thực nhận − chi tiêu thực tế"
              icon={Scale}
              tone={data.expense > data.income ? 'danger' : 'success'}
              footer={cmp && <ChangeBadge change={cmp.netCashFlow} currency={data.currency} label={vsLabel} />}
            />
            <StatCard
              label="Tỷ lệ chi tiêu trên thu nhập"
              value={data.income > 0 ? formatRatio(percentOf(data.expense, data.income)) : 'Không áp dụng'}
              hint={data.income > 0 ? 'Chi tiêu / thu nhập thực nhận' : 'Chưa có thu nhập thực nhận trong tháng'}
              icon={Percent}
              tone="navy"
            />
            <StatCard
              label="Hạn mức tháng"
              value={data.budgetLimit === null ? 'Chưa thiết lập hạn mức' : formatMoney(data.budgetLimit, data.currency)}
              icon={PiggyBank}
              tone="navy"
            />
            <StatCard
              label="Ngân sách còn lại"
              value={data.remaining === null ? 'Chưa thiết lập hạn mức' : formatMoney(data.remaining, data.currency)}
              icon={PiggyBank}
              tone={data.remaining !== null && data.remaining < 0 ? 'danger' : 'accent'}
            />
            <StatCard label="Chi trong kế hoạch" value={formatMoney(data.plannedExpense, data.currency)} icon={CalendarCheck} tone="success" />
            <StatCard
              label="Chi ngoài kế hoạch"
              value={formatMoney(data.unplannedExpense, data.currency)}
              icon={CalendarX}
              tone="accent"
              footer={cmp && <ChangeBadge change={cmp.unplannedExpense} currency={data.currency} label={vsLabel} />}
            />
          </div>
          {cmp && (
            <p className="-mt-3 text-xs text-slate-500">
              Mức thay đổi so sánh {cmp.spec.days} ngày đầu tháng này với {cmp.spec.days} ngày đầu tháng trước (cùng số ngày). Chỉ mô tả thay đổi, không đánh giá tốt hay xấu.
            </p>
          )}

          {analytics.error && !analytics.isLoading && (
            <ErrorState title="Không tải được phân tích tháng" message={toUserMessage(analytics.error)} onRetry={() => void analytics.refetch()} />
          )}
          {analytics.analytics && (
            <>
              <InsightsCard insights={analytics.analytics.insights} />
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <TimeSeriesView
                    buckets={analytics.analytics.series}
                    currency={data.currency}
                    granularity={granularity}
                    allowed={['day', 'week']}
                    onGranularity={setGranularity}
                  />
                </div>
                <CategoryDonutCard report={analytics.analytics.categoryReport} currency={data.currency} />
              </div>
            </>
          )}

          <BudgetOverviewSection currency={data.currency} />

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Mức sử dụng hạn mức</CardTitle>
              </CardHeader>
              <CardContent>
                <BudgetProgress limit={data.budgetLimit} spent={data.expense} currency={data.currency} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trong / ngoài kế hoạch</CardTitle>
              </CardHeader>
              <CardContent>
                <PlanSplitChart planned={data.plannedExpense} unplanned={data.unplannedExpense} currency={data.currency} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Giao dịch gần đây</CardTitle>
              <span className="text-xs text-slate-500">{RECENT_LIMIT} giao dịch mới nhất, mọi thời điểm</span>
            </CardHeader>
            {data.recent.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Chưa có giao dịch nào"
                description="Bắt đầu bằng việc ghi lại khoản chi tiêu đầu tiên để Smart Spend giúp bạn theo dõi dòng tiền."
                action={
                  <Button asChild variant="accent">
                    <Link to="/expenses">
                      <Plus className="h-4 w-4" aria-hidden />
                      Thêm chi tiêu
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100 px-5 pb-2 pt-2">
                {data.recent.map((t) => (
                  <li key={`${t.kind}-${t.id}`} className="flex items-center gap-3 py-3">
                    <span
                      className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                        t.kind === 'income' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
                      )}
                    >
                      {t.kind === 'income' ? <ArrowDownRight className="h-5 w-5" aria-hidden /> : <ArrowUpRight className="h-5 w-5" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">{t.description || t.categoryName}</p>
                      <p className="truncate text-xs text-slate-500">
                        {t.categoryName} · {formatDate(t.date)}
                      </p>
                    </div>
                    <p className={cn('shrink-0 text-sm font-bold', t.kind === 'income' ? 'text-success' : 'text-danger')}>
                      {t.kind === 'income' ? '+' : '-'}
                      {formatMoney(t.amount, data.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function PlanSplitChart({ planned, unplanned, currency }: { planned: number; unplanned: number; currency: string }) {
  if (planned + unplanned === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Chưa có chi tiêu để phân tích.</p>;
  }
  const slices = [
    { name: 'Trong kế hoạch', value: planned, color: '#247D70' },
    { name: 'Ngoài kế hoạch', value: unplanned, color: '#F58B2B' },
  ];
  return (
    <div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatMoney(v, currency)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="text-slate-600">{s.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
