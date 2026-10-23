import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number; // bắt đầu từ 1
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3" aria-label="Phân trang">
      <p className="text-sm text-slate-500">
        Trang {page}/{pages} · {total} bản ghi
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Trước
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Sau
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
