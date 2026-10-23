import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { formatRatio, type Comparison } from '@/reports/comparison';

/** Mô tả bằng chữ mức thay đổi (dùng cho aria-label và cho test). Trung tính: không gán nhãn tốt/xấu. */
export function describeChange(c: Comparison, currency: string): string {
  const word = c.direction === 'up' ? 'tăng' : c.direction === 'down' ? 'giảm' : 'không đổi';
  if (c.direction === 'flat') return c.previousIsZero ? 'Không đổi (cả hai kỳ đều bằng 0)' : 'Không đổi so với kỳ trước';
  const amount = formatMoney(Math.abs(c.delta), currency);
  return c.previousIsZero ? `${word} ${amount} (kỳ trước bằng 0, không tính tỷ lệ)` : `${word} ${amount} (${formatRatio(Math.abs(c.changePercent ?? 0))})`;
}

/** Hiển thị thay đổi so với kỳ trước bằng màu trung tính (tăng chi tiêu không mặc nhiên là xấu). */
export function ChangeBadge({ change, currency, label = 'so với kỳ trước' }: { change: Comparison | null; currency: string; label?: string }) {
  if (!change) return <span className="text-xs text-slate-400">Chưa có dữ liệu {label}</span>;
  const Icon = change.direction === 'up' ? ArrowUpRight : change.direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-600" aria-label={`${describeChange(change, currency)} ${label}`}>
      <Icon className="h-3.5 w-3.5 text-navy" aria-hidden />
      {change.direction === 'flat' ? 'Không đổi' : `${change.direction === 'up' ? '+' : '−'}${formatMoney(Math.abs(change.delta), currency)}`}
      {change.changePercent !== null && change.direction !== 'flat' && <span className="font-medium text-slate-500">({formatRatio(Math.abs(change.changePercent))})</span>}
      {change.previousIsZero && change.direction !== 'flat' && <span className="font-medium text-slate-400">· kỳ trước = 0</span>}
      <span className="font-normal text-slate-400">{label}</span>
    </span>
  );
}
