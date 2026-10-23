import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { PLAN_STATUS_LABEL, type PlanStatus } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { PlanReport } from '@/reports/plans';
import { rangeText } from '@/export/datasets';
import type { DateRange } from '@/reports/ranges';

interface Props {
  report: PlanReport;
  currency: string;
  range: DateRange;
  categoryName: (id: string) => string | undefined;
}

export function PlansReportView({ report: r, currency, range, categoryName }: Props) {
  const m = (v: number) => formatMoney(v, currency);
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-accent/10 px-4 py-2.5 text-sm text-navy" role="note">
        <strong>Phạm vi:</strong> kế hoạch có ngày dự kiến trong {rangeText(range)}. Thực chi gồm <em>mọi</em> giao dịch liên kết với các kế hoạch đó
        (không giới hạn theo ngày giao dịch), nên dự kiến và thực chi được so sánh trên cùng một tập kế hoạch. Số tiền dự kiến không được cộng vào chi tiêu thực tế.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng số kế hoạch" value={String(r.total)} icon={CalendarClock} tone="navy" hint={`Đã lên kế hoạch: ${r.byStatus.planned}`} />
        <StatCard label="Đang thực hiện" value={String(r.byStatus.in_progress)} icon={CalendarClock} tone="accent" />
        <StatCard label="Hoàn thành" value={String(r.byStatus.completed)} icon={CalendarClock} tone="success" />
        <StatCard label="Đã hủy" value={String(r.byStatus.cancelled)} icon={CalendarClock} tone="navy" />
        <StatCard label="Tổng tiền dự kiến" value={m(r.plannedAmount)} hint="Không gồm kế hoạch đã hủy" icon={CalendarClock} tone="navy" />
        <StatCard label="Tổng thực chi liên kết" value={m(r.actualLinked)} hint="Chỉ giao dịch thật có plan_id" icon={CalendarClock} tone="danger" />
        <StatCard label="Chênh lệch (thực chi − dự kiến)" value={m(r.variance)} hint={r.variance > 0 ? 'Chi nhiều hơn dự kiến' : r.variance < 0 ? 'Chi ít hơn dự kiến' : 'Bằng dự kiến'} icon={CalendarClock} tone={r.variance > 0 ? 'danger' : 'success'} />
        <StatCard label="Kế hoạch chi vượt dự kiến" value={String(r.overrunCount)} icon={CalendarClock} tone={r.overrunCount > 0 ? 'danger' : 'success'} />
      </div>

      <Card>
        <CardHeader><CardTitle>Chi tiết từng kế hoạch</CardTitle></CardHeader>
        {r.rows.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Chưa có kế hoạch trong khoảng này" description="Tạo kế hoạch hoặc chọn khoảng thời gian khác." />
        ) : (
          <div className="overflow-x-auto px-2 pb-3">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Kế hoạch</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2 text-right">Dự kiến</th>
                  <th className="px-3 py-2 text-right">Thực chi</th>
                  <th className="px-3 py-2 text-right">Chênh lệch</th>
                  <th className="px-3 py-2 text-right">Số GD</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.plan.id} className="border-t border-slate-100 hover:bg-canvas">
                    <td className="px-3 py-2">
                      <Link to={`/plans/${row.plan.id}`} className="font-semibold text-navy hover:text-accent-600">{row.plan.title}</Link>
                      <p className="text-xs text-slate-500">{categoryName(row.plan.category_id) ?? 'Chưa phân loại'} · {formatDate(row.plan.planned_date)}</p>
                    </td>
                    <td className="px-3 py-2"><Badge tone={row.plan.status === 'completed' ? 'success' : row.plan.status === 'cancelled' ? 'neutral' : 'accent'}>{PLAN_STATUS_LABEL[row.plan.status as PlanStatus] ?? row.plan.status}</Badge></td>
                    <td className="px-3 py-2 text-right">{m(row.planned)}</td>
                    <td className="px-3 py-2 text-right">{m(row.actual)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${row.overrun ? 'text-danger' : 'text-slate-600'}`}>{row.variance > 0 ? '+' : ''}{m(row.variance)}</td>
                    <td className="px-3 py-2 text-right">{row.linkedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
