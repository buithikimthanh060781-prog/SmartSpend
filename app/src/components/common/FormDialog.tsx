import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

/** Nội dung (form) chỉ được mount khi hộp thoại mở, nên mỗi lần mở form có state mới. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
        <div className="mt-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function FormActions({ onCancel, submitting, submitLabel, error }: { onCancel: () => void; submitting: boolean; submitLabel: string; error?: string | null }) {
  return (
    <>
      {/* Lỗi lưu hiển thị cố định trong form (không chỉ là toast tự tắt) để người dùng luôn thấy vì sao chưa lưu được. */}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <FormButtons onCancel={onCancel} submitting={submitting} submitLabel={submitLabel} />
    </>
  );
}

function FormButtons({ onCancel, submitting, submitLabel }: { onCancel: () => void; submitting: boolean; submitLabel: string }) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-60"
      >
        Hủy
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="h-11 rounded-xl bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
      >
        {submitting ? 'Đang lưu...' : submitLabel}
      </button>
    </div>
  );
}
