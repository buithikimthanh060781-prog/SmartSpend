import { Skeleton } from '@/components/ui/skeleton';

export function LoadingSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Đang tải dữ liệu">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[92px]" />
        ))}
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-64" />
    </div>
  );
}

export function FullScreenLoader({ label = 'Đang tải' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-label={label}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy-50 border-t-accent" />
        {label !== 'Đang tải' && <p className="text-sm font-medium text-slate-500">{label}</p>}
      </div>
    </div>
  );
}
