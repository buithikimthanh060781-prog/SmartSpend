import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_PALETTE, normalizeHex } from '@/lib/colors';
import { formatMoney } from '@/lib/money';
import { formatRatio } from '@/reports/comparison';
import type { CategoryReport } from '@/reports/categories';

const MAX = 6;

/** Phân bổ chi tiêu theo danh mục trong tháng (donut tương tác). Chi tiết đầy đủ ở trang Báo cáo. */
export function CategoryDonutCard({ report, currency }: { report: CategoryReport; currency: string }) {
  const rows = report.rows.filter((r) => r.total > 0);
  const top = rows.slice(0, MAX).map((r, i) => ({ name: r.name, value: r.total, share: r.sharePercent, color: normalizeHex(r.color) ?? CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }));
  const rest = rows.slice(MAX);
  const restTotal = Math.round(rest.reduce((s, r) => s + r.total, 0) * 100) / 100;
  const slices = restTotal > 0 ? [...top, { name: `Khác (${rest.length})`, value: restTotal, share: null, color: '#94A3B8' }] : top;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chi tiêu theo danh mục</CardTitle>
        <Link to="/reports" className="text-xs font-semibold text-accent-600 hover:underline">Xem báo cáo</Link>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Chưa có chi tiêu trong tháng này.</p>
        ) : (
          <>
            <div className="h-48" role="img" aria-label="Biểu đồ donut phân bổ chi tiêu theo danh mục trong tháng">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
                    {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatMoney(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {slices.map((s) => (
                <li key={s.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-slate-600">{s.name}</span>
                  <span className="shrink-0 font-semibold text-navy">{formatMoney(s.value, currency)}</span>
                  {s.share !== null && <span className="w-12 shrink-0 text-right text-xs text-slate-500">{formatRatio(s.share)}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
