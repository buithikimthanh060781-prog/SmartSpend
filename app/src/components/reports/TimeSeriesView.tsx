import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { GRANULARITY_LABEL, type Bucket, type Granularity } from '@/reports/series';

const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
const INCOME_COLOR = '#247D70';
const EXPENSE_COLOR = '#F58B2B';
const NET_COLOR = '#142B49';

interface Props {
  buckets: Bucket[];
  currency: string;
  granularity: Granularity;
  allowed: Granularity[];
  onGranularity: (g: Granularity) => void;
}

/** Thu và chi theo thời gian: cột so sánh hoặc đường xu hướng. Mọi mốc đều có mặt (mốc trống = 0). */
export function TimeSeriesView({ buckets, currency, granularity, allowed, onGranularity }: Props) {
  const [type, setType] = useState<'bar' | 'line'>('bar');
  const fullLabel = (label: unknown) => {
    const b = buckets.find((x) => x.label === label);
    if (!b) return String(label);
    return granularity === 'day' ? formatDate(b.start) : granularity === 'week' ? `Tuần từ ${formatDate(b.start)}` : `Tháng ${b.label}`;
  };
  const tick = { fontSize: 12 };
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="label" tick={tick} minTickGap={16} />
      <YAxis tickFormatter={(v: number) => compact.format(v)} width={52} tick={tick} />
      <Tooltip formatter={(v: number) => formatMoney(v, currency)} labelFormatter={fullLabel} />
      <Legend />
    </>
  );

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle>Thu nhập và chi tiêu theo thời gian</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Độ chi tiết" className="h-9 w-auto text-sm" value={granularity} onChange={(e) => onGranularity(e.target.value as Granularity)}>
            {allowed.map((g) => (
              <option key={g} value={g}>
                {GRANULARITY_LABEL[g]}
              </option>
            ))}
          </Select>
          <div role="tablist" aria-label="Loại biểu đồ" className="inline-flex rounded-xl bg-canvas p-1">
            {([['bar', 'Cột'], ['line', 'Đường']] as const).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={type === k}
                onClick={() => setType(k)}
                className={cn('rounded-lg px-3 py-1 text-sm font-semibold', type === k ? 'bg-navy text-white' : 'text-slate-600')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72" role="img" aria-label={`Biểu đồ ${type === 'bar' ? 'cột' : 'đường'} thu nhập thực nhận và chi tiêu ${GRANULARITY_LABEL[granularity].toLowerCase()}`}>
          <ResponsiveContainer width="100%" height="100%">
            {type === 'bar' ? (
              <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                {common}
                <Bar dataKey="income" name="Thu nhập thực nhận" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Chi tiêu" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                {common}
                <Line type="monotone" dataKey="income" name="Thu nhập thực nhận" stroke={INCOME_COLOR} strokeWidth={2} dot={buckets.length <= 31} />
                <Line type="monotone" dataKey="expense" name="Chi tiêu" stroke={EXPENSE_COLOR} strokeWidth={2} dot={buckets.length <= 31} />
                <Line type="monotone" dataKey="net" name="Chênh lệch" stroke={NET_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-navy">Xem bảng số liệu ({buckets.length} mốc)</summary>
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="sticky top-0 bg-navy-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Mốc</th>
                  <th className="px-3 py-2 text-right">Thu nhập</th>
                  <th className="px-3 py-2 text-right">Chi tiêu</th>
                  <th className="px-3 py-2 text-right">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.start} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">{fullLabel(b.label)}</td>
                    <td className="px-3 py-1.5 text-right">{formatMoney(b.income, currency)}</td>
                    <td className="px-3 py-1.5 text-right">{formatMoney(b.expense, currency)}</td>
                    <td className="px-3 py-1.5 text-right">{formatMoney(b.net, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
