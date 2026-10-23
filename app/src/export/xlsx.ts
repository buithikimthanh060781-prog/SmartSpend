import type { Workbook, Worksheet } from 'exceljs';
import { formatDateVi, sanitizeText } from '@/export/sanitize';
import type { CellValue, ColumnKind, KeyValueSheet, SheetSpec, TableSheet } from '@/export/types';

const NAVY = 'FF142B49';
const HEADER_ROW = 4; // 1: tiêu đề, 2: phụ đề, 3: trống, 4: tiêu đề cột
const FIRST_DATA_ROW = HEADER_ROW + 1;
const MAX_WIDTH = 60;

export interface WorkbookMeta {
  currency: string;
  created: Date;
}

/** Định dạng số tiền: VND không có phần thập phân; ngoại tệ khác hiển thị 2 chữ số thập phân. Giá trị lưu trong ô luôn là số chính xác. */
export function moneyFormat(currency: string): string {
  return currency === 'VND' ? '#,##0" ₫";-#,##0" ₫"' : `#,##0.00" ${currency}";-#,##0.00" ${currency}"`;
}

const FORMATS = { date: 'dd/mm/yyyy', percent: '0.0%', int: '0', text: '@' } as const;

/** Ngày ISO -> Date UTC lúc 00:00 để Excel ghi đúng số ngày (không lệch múi giờ). */
function isoToUtcDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

interface Typed {
  value: string | number | Date | null;
  numFmt?: string;
  isText: boolean;
}

/** Chuyển một giá trị theo kiểu cột thành giá trị ô Excel. Văn bản được chống formula injection; số/ngày ghi đúng kiểu. */
export function toExcelCell(value: CellValue, kind: ColumnKind, currency: string): Typed {
  if (value === null || value === undefined || value === '') return { value: null, isText: false };
  switch (kind) {
    case 'text':
      return { value: sanitizeText(String(value)), numFmt: FORMATS.text, isText: true };
    case 'date': {
      const d = isoToUtcDate(String(value));
      return d ? { value: d, numFmt: FORMATS.date, isText: false } : { value: sanitizeText(String(value)), isText: true };
    }
    case 'percent':
      return typeof value === 'number'
        ? { value: value / 100, numFmt: FORMATS.percent, isText: false } // Excel lưu phần trăm dạng phân số (32,5% = 0,325)
        : { value: sanitizeText(String(value)), isText: true };
    case 'money':
      return typeof value === 'number' ? { value, numFmt: moneyFormat(currency), isText: false } : { value: sanitizeText(String(value)), isText: true };
    case 'int':
      return typeof value === 'number' ? { value, numFmt: FORMATS.int, isText: false } : { value: sanitizeText(String(value)), isText: true };
  }
}

function styleTitle(ws: Worksheet, title: string, subtitle: string | undefined, lastCol: number): void {
  ws.mergeCells(1, 1, 1, Math.max(1, lastCol));
  const t = ws.getCell(1, 1);
  t.value = sanitizeText(title);
  t.font = { name: 'Be Vietnam Pro', size: 14, bold: true, color: { argb: NAVY } };
  t.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 24;
  if (subtitle) {
    ws.mergeCells(2, 1, 2, Math.max(1, lastCol));
    const s = ws.getCell(2, 1);
    s.value = sanitizeText(subtitle);
    s.font = { name: 'Be Vietnam Pro', size: 10, italic: true, color: { argb: 'FF64748B' } };
    s.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(2).height = 30;
  }
}

function styleHeader(ws: Worksheet, headers: string[]): void {
  const row = ws.getRow(HEADER_ROW);
  headers.forEach((h, i) => {
    const c = row.getCell(i + 1);
    c.value = sanitizeText(h);
    c.font = { name: 'Be Vietnam Pro', bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = { bottom: { style: 'thin', color: { argb: 'FFF58B2B' } } };
  });
  row.height = 28;
}

function setWidths(ws: Worksheet, headers: string[], widths: Array<number | undefined>, sample: string[][]): void {
  headers.forEach((h, i) => {
    const contentMax = sample.reduce((m, r) => Math.max(m, (r[i] ?? '').length), 0);
    ws.getColumn(i + 1).width = Math.min(MAX_WIDTH, widths[i] ?? Math.max(12, h.length + 4, contentMax + 2));
  });
}

function writeTable(ws: Worksheet, sheet: TableSheet<unknown>, currency: string): void {
  const cols = sheet.columns;
  styleTitle(ws, sheet.title, sheet.subtitle, cols.length);
  styleHeader(ws, cols.map((c) => c.header));

  const sample: string[][] = [];
  sheet.rows.forEach((row, r) => {
    const sheetRow = ws.getRow(FIRST_DATA_ROW + r);
    const texts: string[] = [];
    cols.forEach((c, i) => {
      const typed = toExcelCell(c.value(row), c.kind, currency);
      const cell = sheetRow.getCell(i + 1);
      cell.value = typed.value;
      if (typed.numFmt) cell.numFmt = typed.numFmt;
      if (typed.isText) cell.alignment = { wrapText: true, vertical: 'top' };
      texts.push(typed.value instanceof Date ? '10/10/2026' : String(typed.value ?? ''));
    });
    if (r < 200) sample.push(texts);
  });

  // Hàng tổng cộng (chỉ khi có ý nghĩa): in đậm, viền trên.
  const lastDataRow = FIRST_DATA_ROW + sheet.rows.length - 1;
  (sheet.totals ?? []).forEach((t, k) => {
    const row = ws.getRow(lastDataRow + 1 + k);
    cols.forEach((c, i) => {
      const typed = toExcelCell(t[i] ?? null, c.kind, currency);
      const cell = row.getCell(i + 1);
      cell.value = typed.value;
      if (typed.numFmt) cell.numFmt = typed.numFmt;
      cell.font = { name: 'Be Vietnam Pro', bold: true };
      cell.border = { top: { style: k === 0 ? 'thin' : undefined, color: { argb: NAVY } } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F8' } };
    });
  });

  setWidths(ws, cols.map((c) => c.header), cols.map((c) => c.width), sample);
  // Cố định dòng tiêu đề (các dòng 1-4 luôn hiển thị khi cuộn) và bật bộ lọc trên dòng tiêu đề.
  ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + Math.max(0, sheet.rows.length), column: cols.length } };
}

function writeKeyValue(ws: Worksheet, sheet: KeyValueSheet, currency: string): void {
  styleTitle(ws, sheet.title, sheet.subtitle, 3);
  styleHeader(ws, ['Chỉ tiêu', 'Giá trị', 'Ghi chú']);
  const sample: string[][] = [];
  sheet.rows.forEach((r, i) => {
    const row = ws.getRow(FIRST_DATA_ROW + i);
    row.getCell(1).value = sanitizeText(r.label);
    row.getCell(1).font = { name: 'Be Vietnam Pro', bold: true };
    const typed = toExcelCell(r.value, r.kind, currency);
    const v = row.getCell(2);
    v.value = typed.value;
    if (typed.numFmt) v.numFmt = typed.numFmt;
    v.alignment = { horizontal: 'right' };
    const n = row.getCell(3);
    n.value = r.note ? sanitizeText(r.note) : null;
    n.alignment = { wrapText: true, vertical: 'top' };
    n.font = { name: 'Be Vietnam Pro', color: { argb: 'FF64748B' } };
    sample.push([r.label, typed.value instanceof Date ? formatDateVi('2026-10-10') : String(typed.value ?? ''), r.note ?? '']);
  });
  setWidths(ws, ['Chỉ tiêu', 'Giá trị', 'Ghi chú'], [34, 24, 60], sample);
  ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + Math.max(0, sheet.rows.length), column: 3 } };
}

/**
 * Tạo workbook Excel từ danh sách sheet. ExcelJS được tải khi cần (dynamic import) để không làm nặng bản tải đầu tiên.
 * Không ghi gì lên Supabase hay nơi khác; kết quả chỉ nằm trong bộ nhớ của trình duyệt cho tới khi người dùng tải xuống.
 */
export async function buildWorkbook(sheets: readonly SheetSpec[], meta: WorkbookMeta): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Smart Spend';
  wb.created = meta.created;
  wb.modified = meta.created;
  for (const sheet of sheets) {
    // Tên sheet Excel tối đa 31 ký tự và không chứa : \ / ? * [ ]
    const ws = wb.addWorksheet(sheet.name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31));
    if (sheet.type === 'kv') writeKeyValue(ws, sheet, meta.currency);
    else writeTable(ws, sheet as TableSheet<unknown>, meta.currency);
  }
  return wb;
}

export async function workbookToBuffer(wb: Workbook): Promise<ArrayBuffer | Uint8Array> {
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer | Uint8Array;
}
