import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Không tải được dữ liệu', message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-danger/30 bg-danger/5 px-6 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      <h3 className="mt-3 text-base font-bold text-navy">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
      {onRetry && (
        <Button className="mt-5" variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}
