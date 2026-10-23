import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: 'navy' | 'success' | 'danger' | 'accent';
  /** Phần phụ bên dưới (ví dụ mức thay đổi so với kỳ trước). */
  footer?: ReactNode;
}

const tones = {
  navy: 'bg-navy-50 text-navy',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  accent: 'bg-accent/15 text-accent-600',
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'navy', footer }: StatCardProps) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', tones[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold text-navy">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        {footer && <div className="mt-1.5">{footer}</div>}
      </div>
    </Card>
  );
}
