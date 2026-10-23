import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  accent: 'bg-accent/15 text-accent-600',
  navy: 'bg-navy-50 text-navy',
};

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)} {...props} />;
}
