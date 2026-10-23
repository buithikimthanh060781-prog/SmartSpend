import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-navy placeholder:text-slate-400 disabled:opacity-60 aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-semibold text-navy', className)} {...props} />;
}
