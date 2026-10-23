import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { buildExportFile, type ExportFormat } from '@/export/builders';
import { downloadCsv, downloadXlsx } from '@/export/download';
import type { SheetSpec } from '@/export/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { todayIso, useSettings } from '@/hooks/useSettings';
import { toMutationMessage } from '@/lib/errors';

interface ExportMenuProps {
  /** Tên file, ví dụ "thu-nhap". */
  name: string;
  /**
   * Tạo dữ liệu xuất ĐÚNG THEO BỘ LỌC đang chọn và lấy TOÀN BỘ kết quả (không chỉ trang hiện tại).
   * Có thể ném lỗi (ví dụ RowLimitError) - lỗi được hiển thị cho người dùng.
   */
  produce: () => Promise<SheetSpec[]>;
  disabled?: boolean;
  /** Chỉ cho xuất Excel (ví dụ báo cáo nhiều sheet). Mặc định có cả CSV. */
  csv?: boolean;
}

/** Hai nút Xuất CSV / Xuất Excel có trạng thái đang tạo báo cáo và thông báo kết quả. */
export function ExportMenu({ name, produce, disabled, csv = true }: ExportMenuProps) {
  const toast = useToast();
  const { currency, timezone } = useSettings();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function run(format: ExportFormat) {
    if (busy) return;
    setBusy(format);
    try {
      const sheets = await produce();
      const file = await buildExportFile(sheets, format, { currency, name, today: todayIso(timezone) });
      if (file.format === 'csv') downloadCsv(file.filename, file.csv);
      else downloadXlsx(file.filename, file.buffer);
      toast.success(`Đã tạo file ${file.filename}.`);
    } catch (e) {
      toast.error(toMutationMessage(e, 'Không tạo được file xuất. Vui lòng thử lại.'));
    } finally {
      setBusy(null);
    }
  }

  const icon = (f: ExportFormat) => (busy === f ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : f === 'csv' ? <FileText className="h-4 w-4" aria-hidden /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Xuất dữ liệu">
      {csv && (
        <Button variant="outline" size="sm" disabled={disabled || busy !== null} onClick={() => void run('csv')}>
          {icon('csv')}
          {busy === 'csv' ? 'Đang tạo...' : 'Xuất CSV'}
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={disabled || busy !== null} onClick={() => void run('xlsx')}>
        {icon('xlsx')}
        {busy === 'xlsx' ? 'Đang tạo...' : 'Xuất Excel'}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {busy ? 'Đang tạo báo cáo' : ''}
      </span>
    </div>
  );
}
