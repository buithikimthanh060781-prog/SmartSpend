import { Wallet } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/components/nav';
import { useBudgetOverview } from '@/hooks/useBudgets';
import { cn } from '@/lib/utils';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  // Số ngân sách đang cảnh báo (kỳ hiện tại). Lỗi tải thì không hiện badge, không chặn điều hướng.
  const alertCount = useBudgetOverview().data?.alerts.length ?? 0;

  return (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent">
          <Wallet className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-lg font-extrabold tracking-tight">Smart Spend</span>
      </div>
      <nav aria-label="Điều hướng chính" className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white',
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span className="flex-1">{label}</span>
            {to === '/budgets' && alertCount > 0 && (
              <span
                className="grid min-w-[22px] place-items-center rounded-full bg-danger px-1.5 text-xs font-bold text-white"
                aria-label={`${alertCount} ngân sách đang cảnh báo`}
              >
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
