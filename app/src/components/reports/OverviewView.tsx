import { CalendarCheck, CalendarDays, CalendarX, Percent, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { ChangeBadge } from '@/components/reports/ChangeBadge';
import { formatMoney } from '@/lib/money';
import { formatRatio } from '@/reports/comparison';
import type { PeriodComparison } from '@/reports/periodComparison';
import { rangeText } from '@/export/datasets';
import type { FinancialSummary } from '@/reports/summary';

interface Props {
  summary: FinancialSummary;
  comparison: PeriodComparison | null;
  currency: string;
}

/** Báo cáo tổng quan. Mẫu số bằng 0 hiển thị "Không áp dụng" kèm lý do, không bao giờ chia cho 0. */
export function OverviewView({ summary: s, comparison, currency }: Props) {
  const m = (v: number) => formatMoney(v, currency);
  return (
    <div className="space-y-4">
      {comparison && (
        <p className="text-sm text-slate-500">
          Mức thay đổi so với {rangeText(comparison.spec.previous)} ({comparison.spec.days} ngày
          {comparison.spec.partial ? ', cùng số ngày đã trôi qua của kỳ hiện tại' : ''}).
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Thu nhập thực nhận"
          value={m(s.receivedIncome)}
          hint={s.expectedIncome > 0 ? `Thu nhập dự kiến chưa tính: ${m(s.expectedIncome)}` : 'Chỉ tính thu nhập đã nhận'}
          icon={TrendingUp}
          tone="success"
          footer={comparison && <ChangeBadge change={comparison.receivedIncome} currency={currency} />}
        />
        <StatCard
          label="Tổng chi tiêu thực tế"
          value={m(s.actualExpense)}
          hint={`${s.expenseCount} giao dịch · kế hoạch chưa thực hiện không được tính`}
          icon={TrendingDown}
          tone="danger"
          footer={comparison && <ChangeBadge change={comparison.actualExpense} currency={currency} />}
        />
        <StatCard
          label="Chênh lệch thu chi"
          value={m(s.netCashFlow)}
          hint="Thu nhập thực nhận − chi tiêu thực tế"
          icon={Scale}
          tone={s.netCashFlow < 0 ? 'danger' : 'success'}
          footer={comparison && <ChangeBadge change={comparison.netCashFlow} currency={currency} />}
        />
        <StatCard
          label="Tỷ lệ chi tiêu trên thu nhập"
          value={s.expenseToIncomeRatio === null ? 'Không áp dụng' : formatRatio(s.expenseToIncomeRatio)}
          hint={s.expenseToIncomeRatio === null ? 'Chưa có thu nhập thực nhận trong kỳ' : 'Chi tiêu thực tế / thu nhập thực nhận'}
          icon={Percent}
          tone="navy"
        />
        <StatCard label="Chi trong kế hoạch" value={m(s.plannedExpense)} hint="Giao dịch có liên kết kế hoạch" icon={CalendarCheck} tone="success" footer={comparison && <ChangeBadge change={comparison.plannedExpense} currency={currency} />} />
        <StatCard label="Chi ngoài kế hoạch" value={m(s.unplannedExpense)} hint="Giao dịch không liên kết kế hoạch" icon={CalendarX} tone="accent" footer={comparison && <ChangeBadge change={comparison.unplannedExpense} currency={currency} />} />
        <StatCard
          label="Tỷ trọng chi ngoài kế hoạch"
          value={s.unplannedExpenseRatio === null ? 'Không áp dụng' : formatRatio(s.unplannedExpenseRatio)}
          hint={s.unplannedExpenseRatio === null ? 'Chưa có chi tiêu trong kỳ' : 'Chi ngoài kế hoạch / tổng chi'}
          icon={Percent}
          tone="accent"
        />
        <StatCard label="Số ngày có chi tiêu" value={`${s.daysWithExpense} / ${s.elapsedDays} ngày`} hint="Trên số ngày đã trôi qua trong kỳ" icon={CalendarDays} tone="navy" />
        <StatCard
          label="Chi tiêu trung bình mỗi ngày"
          value={s.avgExpensePerDay === null ? '—' : m(s.avgExpensePerDay)}
          hint={s.avgExpensePerDay === null ? 'Kỳ chưa bắt đầu' : `Tổng chi / ${s.elapsedDays} ngày đã trôi qua`}
          icon={Wallet}
          tone="navy"
          footer={comparison && <ChangeBadge change={comparison.avgExpensePerDay} currency={currency} />}
        />
      </div>
    </div>
  );
}
