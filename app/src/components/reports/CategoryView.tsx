import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/EmptyState';
import { ChangeBadge } from '@/components/reports/ChangeBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_PALETTE, normalizeHex } from '@/lib/colors';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { formatAmount, formatMoney } from '@/lib/money';
import { formatRatio } from '@/reports/comparison';
import type { CategoryReport, CategoryReportRow } from '@/reports/categories';
import type { DateRange } from '@/reports/ranges';
import type { ReportExpense } from '@/services/reports';
import { PieChart as PieIcon } from 'lucide-react';
import { addDays } from '@/lib/dates';

const OTHER_COLOR = '#94A3B8';
const MAX_SLICES = 8;
const DRILL_LIMIT = 200;

const colorOf = (row: CategoryReportRow, index: number): string => normalizeHex(row.color) ?? CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });

interface Props {
  report: CategoryReport;
  currency: string;
  range: DateRange;
  /** Chi tiêu của kỳ (đã lọc đúng khoảng), dùng để xem giao dịch khi bấm vào một danh mục. */
  expenses: ReportExpense[];
  showComparison: boolean;
}

/** Chi tiêu theo danh mục: biểu đồ donut, cột và bảng chi tiết. Danh mục đã ngừng hoạt động vẫn hiển thị. */
export function CategoryView({ report, currency, range, expenses, showComparison }: Props) {
  const [selected, setSelected] = useState<CategoryReportRow | null>(null);
  const rows = report.rows.filter((r) => r.total > 0 || r.count > 0);

  // Donut: các danh mục lớn nhất + "Khác" để biểu đồ vẫn đọc được. Bảng bên dưới luôn liệt kê đầy đủ.
  const slices = useMemo(() => {
    const top = rows.slice(0, MAX_SLICES).map((r, i) => ({ name: r.name, value: r.total, color: colorOf(r, i) }));
    const rest = rows.slice(MAX_SLICES);
    const restTotal = rest.reduce((s, r) => s + r.total, 0);
    return restTotal > 0 ? [...top, { name: `Khác (${rest.length} danh mục)`, value: Math.round(restTotal * 100) / 100, color: OTHER_COLOR }] : top;
  }, [rows]);

  if (rows.length === 0) {
    return <Card><EmptyState icon={PieIcon} title="Chưa có chi tiêu trong khoảng này" description="Thêm chi tiêu hoặc chọn khoảng thời gian khác để xem phân bổ theo danh mục." /></Card>;
  }

  const barRows = rows.slice(0, 10).map((r, i) => ({ name: r.name, total: r.total, color: colorOf(r, i) }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Phân bổ chi tiêu</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64" role="img" aria-label="Biểu đồ donut tỷ trọng chi tiêu theo danh mục">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={2} stroke="none">
                    {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {slices.map((s) => (
                <li key={s.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="truncate text-slate-600">{s.name}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top danh mục chi nhiều nhất</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72" role="img" aria-label="Biểu đồ cột chi tiêu theo danh mục">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barRows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <XAxis type="number" tickFormatter={(v: number) => compact.format(v)} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatMoney(v, currency)} />
                  <Bar dataKey="total" name="Tổng chi" radius={[0, 4, 4, 0]}>
                    {barRows.map((b) => <Cell key={b.name} fill={b.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Chi tiết theo danh mục</CardTitle></CardHeader>
        <div className="overflow-x-auto px-2 pb-3">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Danh mục</th>
                <th className="px-3 py-2 text-right">Tổng chi</th>
                <th className="px-3 py-2 text-right">Số GD</th>
                <th className="px-3 py-2 text-right">Tỷ trọng</th>
                <th className="px-3 py-2 text-right">TB / giao dịch</th>
                {showComparison && <th className="px-3 py-2">So với kỳ trước</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.categoryId} className="border-t border-slate-100 hover:bg-canvas">
                  <td className="px-3 py-2">
                    <button className="flex items-center gap-2 text-left font-semibold text-navy hover:text-accent-600" onClick={() => setSelected(r)} aria-label={`Xem giao dịch của ${r.name}`}>
                      <CategoryIcon icon={r.icon} color={colorOf(r, i)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white" />
                      {r.name}
                      {!r.isActive && r.known && <Badge>Đã tắt</Badge>}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{formatMoney(r.total, currency)}</td>
                  <td className="px-3 py-2 text-right">{r.count}</td>
                  <td className="px-3 py-2 text-right">{formatRatio(r.sharePercent)}</td>
                  <td className="px-3 py-2 text-right">{r.avgPerTransaction === null ? '—' : formatMoney(r.avgPerTransaction, currency)}</td>
                  {showComparison && <td className="px-3 py-2"><ChangeBadge change={r.change} currency={currency} label="" /></td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-bold text-navy">
                <td className="px-3 py-2">Tổng cộng</td>
                <td className="px-3 py-2 text-right">{formatMoney(report.total, currency)}</td>
                <td className="px-3 py-2 text-right">{report.count}</td>
                <td className="px-3 py-2 text-right">100%</td>
                <td colSpan={showComparison ? 2 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {selected && <Drilldown row={selected} expenses={expenses} range={range} currency={currency} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Drilldown({ row, expenses, range, currency }: { row: CategoryReportRow; expenses: ReportExpense[]; range: DateRange; currency: string }) {
  const list = expenses.filter((e) => e.category_id === row.categoryId).sort((a, b) => (a.expense_date < b.expense_date ? 1 : a.expense_date > b.expense_date ? -1 : 0));
  const shown = list.slice(0, DRILL_LIMIT);
  const params = new URLSearchParams({ category: row.categoryId, from: range.start, to: addDays(range.endExclusive, -1) });
  return (
    <>
      <DialogTitle>{row.name}</DialogTitle>
      <DialogDescription>
        {list.length} giao dịch · {formatMoney(row.total, currency)} trong khoảng đã chọn
      </DialogDescription>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Không có giao dịch nào của danh mục này trong khoảng đã chọn.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {shown.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy">{e.description || row.name}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(e.expense_date)} · {PAYMENT_METHOD_LABEL[e.payment_method as PaymentMethod] ?? e.payment_method} · {e.plan_id ? 'Trong kế hoạch' : 'Ngoài kế hoạch'}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-danger">-{formatAmount(e.amount, currency)}</p>
            </li>
          ))}
        </ul>
      )}
      {list.length > DRILL_LIMIT && <p className="mt-2 text-xs text-slate-500">Chỉ hiển thị {DRILL_LIMIT} giao dịch mới nhất. Xem đầy đủ ở trang Chi tiêu.</p>}
      <div className="mt-5 flex justify-end gap-3">
        <DialogClose asChild><Button variant="outline">Đóng</Button></DialogClose>
        <Button asChild variant="accent"><Link to={`/expenses?${params.toString()}`}>Xem trong trang Chi tiêu</Link></Button>
      </div>
    </>
  );
}
