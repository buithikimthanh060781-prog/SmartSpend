import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ErrorState';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChangeBadge } from '@/components/reports/ChangeBadge';
import { rangeText } from '@/export/datasets';
import { unionWindow, usePeriodData, useToday } from '@/hooks/useReportData';
import { useCategories } from '@/hooks/useCategories';
import { toUserMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { Comparison } from '@/reports/comparison';
import { formatRatio } from '@/reports/comparison';
import { buildPeriodComparison } from '@/reports/periodComparison';
import { resolveComparison, type ComparisonBasis, type ComparisonKind, type CustomRange } from '@/reports/ranges';

const KINDS: Array<[ComparisonKind, string]> = [
  ['day', 'Hôm nay so với hôm qua'],
  ['week', 'Tuần này so với tuần trước'],
  ['month', 'Tháng này so với tháng trước'],
  ['custom', 'Kỳ tùy chọn'],
];

const SENTENCE: Record<'up' | 'down' | 'flat', string> = { up: 'cao hơn', down: 'thấp hơn', flat: 'bằng' };

export function CompareView({ currency }: { currency: string }) {
  const today = useToday();
  const { categories } = useCategories();
  const [kind, setKind] = useState<ComparisonKind>('month');
  const [basis, setBasis] = useState<ComparisonBasis>('toDate');
  const [custom, setCustom] = useState<CustomRange>({ from: '', to: '' });

  const spec = useMemo(() => resolveComparison(kind, basis, today, custom), [kind, basis, today, custom]);
  const window = spec ? unionWindow(spec.current, spec.previous) : null;
  const data = usePeriodData(window);

  const result = useMemo(
    () => (spec && data.data ? buildPeriodComparison(spec, data.data.incomes, data.data.expenses, categories, today) : null),
    [spec, data.data, categories, today],
  );

  const metrics: Array<[string, Comparison]> = result
    ? [
        ['Thu nhập thực nhận', result.receivedIncome],
        ['Tổng chi tiêu thực tế', result.actualExpense],
        ['Chênh lệch thu chi', result.netCashFlow],
        ['Chi trong kế hoạch', result.plannedExpense],
        ['Chi ngoài kế hoạch', result.unplannedExpense],
        ...(result.avgExpensePerDay ? ([['Chi tiêu trung bình mỗi ngày', result.avgExpensePerDay]] as Array<[string, Comparison]>) : []),
      ]
    : [];

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div role="tablist" aria-label="Loại so sánh" className="flex flex-wrap gap-2">
          {KINDS.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={cn('rounded-xl px-3.5 py-2 text-sm font-semibold', kind === k ? 'bg-navy text-white' : 'bg-canvas text-slate-600 hover:bg-slate-100')}
            >
              {label}
            </button>
          ))}
        </div>
        {kind === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" aria-label="Từ ngày" className="w-auto" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <span className="text-slate-400">–</span>
            <Input type="date" aria-label="Đến ngày" className="w-auto" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </div>
        ) : (
          <div role="radiogroup" aria-label="Cách so sánh" className="flex flex-wrap gap-4 text-sm">
            {([['toDate', 'Đến hết hôm nay (cùng số ngày đã trôi qua)'], ['complete', 'Kỳ đã kết thúc gần nhất']] as const).map(([b, label]) => (
              <label key={b} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="basis" checked={basis === b} onChange={() => setBasis(b)} />
                {label}
              </label>
            ))}
          </div>
        )}
        {kind === 'custom' && !spec && <p role="alert" className="text-sm font-semibold text-danger">Hãy chọn khoảng ngày hợp lệ đã bắt đầu (không hoàn toàn ở tương lai).</p>}
      </Card>

      {spec && (
        <p className="text-sm text-slate-600" role="note">
          <strong>{spec.currentLabel}:</strong> {rangeText(spec.current)} &nbsp;·&nbsp; <strong>{spec.previousLabel}:</strong> {rangeText(spec.previous)} &nbsp;·&nbsp; {spec.days} ngày mỗi bên.
          {spec.partial && ' Kỳ hiện tại đang diễn ra nên chỉ so sánh số ngày đã trôi qua với đúng bấy nhiêu ngày đầu của kỳ trước.'}
        </p>
      )}

      {data.isLoading && spec && <Skeleton className="h-64" role="status" aria-label="Đang tải dữ liệu so sánh" />}
      {data.error && <ErrorState message={toUserMessage(data.error)} onRetry={() => void data.refetch()} />}

      {result && (
        <Card>
          <CardHeader><CardTitle>So sánh các chỉ tiêu</CardTitle></CardHeader>
          <div className="overflow-x-auto px-2 pb-3">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Chỉ tiêu</th>
                  <th className="px-3 py-2 text-right">{spec?.currentLabel}</th>
                  <th className="px-3 py-2 text-right">{spec?.previousLabel}</th>
                  <th className="px-3 py-2 text-right">Chênh lệch</th>
                  <th className="px-3 py-2 text-right">Thay đổi</th>
                  <th className="px-3 py-2">Chiều hướng</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map(([label, c]) => (
                  <tr key={label} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-navy">{label}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(c.current, currency)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(c.previous, currency)}</td>
                    <td className="px-3 py-2 text-right">{c.delta > 0 ? '+' : ''}{formatMoney(c.delta, currency)}</td>
                    <td className="px-3 py-2 text-right">{c.changePercent === null ? <span className="text-slate-400">Không tính (kỳ trước = 0)</span> : `${c.changePercent > 0 ? '+' : ''}${formatRatio(c.changePercent)}`}</td>
                    <td className="px-3 py-2 text-slate-600">{SENTENCE[c.direction]} kỳ trước</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CardContent className="pt-0 text-xs text-slate-500">
            Đây chỉ là so sánh số liệu, không phải đánh giá tốt hay xấu: chi tiêu tăng hay giảm có thể hoàn toàn hợp lý tùy hoàn cảnh của bạn.
          </CardContent>
        </Card>
      )}

      {result && result.categories.rows.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Thay đổi theo danh mục</CardTitle></CardHeader>
          <ul className="divide-y divide-slate-100 px-5 pb-3">
            {result.categories.rows.filter((r) => r.change && (r.change.current > 0 || r.change.previous > 0)).slice(0, 12).map((r) => (
              <li key={r.categoryId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm font-semibold text-navy">{r.name}</span>
                <span className="text-sm text-slate-500">{formatMoney(r.change?.previous ?? 0, currency)} → <strong className="text-navy">{formatMoney(r.change?.current ?? 0, currency)}</strong></span>
                <ChangeBadge change={r.change} currency={currency} label="" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
