import { forwardRef, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy disabled:opacity-60 aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[84px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-navy placeholder:text-slate-400 aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
