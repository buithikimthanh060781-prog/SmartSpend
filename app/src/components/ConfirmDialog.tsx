import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Xác nhận',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="mt-6 flex justify-end gap-3">
          <DialogClose asChild>
            <Button variant="outline" disabled={loading}>
              Hủy
            </Button>
          </DialogClose>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? 'Đang xử lý...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
