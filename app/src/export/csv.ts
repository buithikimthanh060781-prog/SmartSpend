import { formatDateVi, sanitizeText } from '@/export/sanitize';
import type { CellValue, ColumnKind, ExportColumn, KeyValueRow, TotalsRow } from '@/export/types';

/**
 * CSV theo RFC 4180: phân tách bằng dấu phẩy, xuống dòng CRLF, trường chứa dấu phẩy/nháy kép/xuống dòng được đặt trong nháy kép
 * (nháy kép bên trong được nhân đôi). Có BOM UTF-8 để Excel trên Windows hiển thị đúng tiếng Việt.
 * Số tiền ghi dạng số thuần với dấu chấm thập phân (ví dụ 1500000.5), không có ký hiệu tiền tệ hay phân cách nghìn,
 * để không mất chữ số và không phụ thuộc cấu hình vùng. Ngày ghi dd/MM/yyyy.
 */
export const CSV_BOM = '﻿';

export function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function formatCsvCell(value: CellValue, kind: ColumnKind): string {
  if (value === null || value === undefined || value === '') return '';
  switch (kind) {
    case 'text':
      return escapeCsvField(sanitizeText(String(value)));
    case 'date':
      return escapeCsvField(formatDateVi(String(value)));
    case 'percent':
      return typeof value === 'number' ? String(Math.round(value * 100) / 100) : escapeCsvField(sanitizeText(String(value)));
    case 'money':
    case 'int':
      // Ô số: nếu nhận chuỗi (nhãn như "Không áp dụng") thì coi là văn bản an toàn.
      return typeof value === 'number' ? String(value) : escapeCsvField(sanitizeText(String(value)));
  }
}

export function buildCsv<T>(columns: ExportColumn<T>[], rows: readonly T[], totals: TotalsRow[] = []): string {
  const lines: string[] = [columns.map((c) => escapeCsvField(sanitizeText(c.header))).join(',')];
  for (const row of rows) lines.push(columns.map((c) => formatCsvCell(c.value(row), c.kind)).join(','));
  for (const t of totals) lines.push(columns.map((c, i) => formatCsvCell(t[i] ?? null, c.kind)).join(','));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

/** CSV cho báo cáo dạng "chỉ tiêu - giá trị" (tổng quan). */
export function buildKeyValueCsv(rows: readonly KeyValueRow[]): string {
  const lines = ['Chỉ tiêu,Giá trị,Ghi chú'];
  for (const r of rows) lines.push([escapeCsvField(sanitizeText(r.label)), formatCsvCell(r.value, r.kind), r.note ? escapeCsvField(sanitizeText(r.note)) : ''].join(','));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}
