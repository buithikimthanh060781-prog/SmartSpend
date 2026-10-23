import { buildCsv, buildKeyValueCsv } from '@/export/csv';
import type { SheetSpec } from '@/export/types';
import { buildWorkbook, workbookToBuffer } from '@/export/xlsx';

export type ExportFormat = 'csv' | 'xlsx';

export interface ExportContext {
  currency: string;
  /** Tên file (không đuôi, không ngày). */
  name: string;
  /** Ngày hôm nay YYYY-MM-DD theo múi giờ người dùng, dùng cho tên file và thời điểm tạo. */
  today: string;
}

export type ExportFile = { filename: string; format: 'csv'; csv: string } | { filename: string; format: 'xlsx'; buffer: ArrayBuffer | Uint8Array };

const filenameOf = (ctx: ExportContext, ext: ExportFormat) => `smartspend-${ctx.name}-${ctx.today.replace(/-/g, '')}.${ext}`;

/**
 * CSV chỉ có MỘT bảng: với báo cáo nhiều sheet, CSV là sheet đầu tiên (Tổng quan). Excel chứa đủ mọi sheet.
 * Toàn bộ dữ liệu được tạo trong bộ nhớ trình duyệt; không tải lên đâu cả.
 */
export async function buildExportFile(sheets: readonly SheetSpec[], format: ExportFormat, ctx: ExportContext): Promise<ExportFile> {
  if (sheets.length === 0) throw new Error('Không có dữ liệu để xuất.');
  if (format === 'csv') {
    const s = sheets[0];
    const csv = s.type === 'kv' ? buildKeyValueCsv(s.rows) : buildCsv(s.columns, s.rows, s.totals ?? []);
    return { filename: filenameOf(ctx, 'csv'), format: 'csv', csv };
  }
  const wb = await buildWorkbook(sheets, { currency: ctx.currency, created: new Date(`${ctx.today}T00:00:00Z`) });
  return { filename: filenameOf(ctx, 'xlsx'), format: 'xlsx', buffer: await workbookToBuffer(wb) };
}
