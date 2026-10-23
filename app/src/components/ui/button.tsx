import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        default: 'bg-navy text-white hover:bg-navy-700',
        accent: 'bg-accent text-white hover:bg-accent-600 shadow-card',
        outline: 'border border-slate-300 bg-white text-navy hover:bg-slate-50',
        ghost: 'text-navy hover:bg-navy-50',
        danger: 'bg-danger text-white hover:bg-danger/90',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-3',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';
