import { BarChart3, CalendarClock, PiggyBank, Receipt, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';

const ACTIONS = [
  { to: '/incomes?new=1', label: 'Thêm thu nhập', icon: TrendingUp, tone: 'bg-success/10 text-success' },
  { to: '/expenses?new=1', label: 'Thêm chi tiêu', icon: Receipt, tone: 'bg-accent/15 text-accent-600' },
  { to: '/plans?new=1', label: 'Tạo kế hoạch', icon: CalendarClock, tone: 'bg-navy-50 text-navy' },
  { to: '/budgets?new=1', label: 'Thiết lập ngân sách', icon: PiggyBank, tone: 'bg-navy-50 text-navy' },
  { to: '/reports', label: 'Xem báo cáo', icon: BarChart3, tone: 'bg-navy-50 text-navy' },
] as const;

/** Thao tác nhanh. Nút đủ lớn để chạm trên điện thoại (cao tối thiểu 56px). */
export function QuickActions() {
  return (
    <section aria-label="Thao tác nhanh">
      <Card className="p-3">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ACTIONS.map(({ to, label, icon: Icon, tone }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex min-h-[56px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-navy transition-colors hover:border-accent hover:bg-canvas"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
