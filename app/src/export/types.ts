/** Kiểu dữ liệu của một cột xuất. Quyết định cách ghi: ô số, ngày, phần trăm hay văn bản (văn bản được chống formula injection). */
export type ColumnKind = 'text' | 'money' | 'date' | 'percent' | 'int';

export type CellValue = string | number | null;

export interface ExportColumn<T> {
  header: string;
  kind: ColumnKind;
  /** Độ rộng cột (ký tự) cho Excel; bỏ trống để tự tính. */
  width?: number;
  value: (row: T) => CellValue;
}

/** Hàng tổng cộng: mảng giá trị theo thứ tự cột (null = ô trống). */
export type TotalsRow = CellValue[];

export interface TableSheet<T = unknown> {
  type: 'table';
  name: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  totals?: TotalsRow[];
}

export interface KeyValueRow {
  label: string;
  value: CellValue;
  kind: ColumnKind;
  note?: string;
}

export interface KeyValueSheet {
  type: 'kv';
  name: string;
  title: string;
  subtitle?: string;
  rows: KeyValueRow[];
}

// `any` có chủ đích: mỗi sheet có kiểu dòng riêng (thu nhập, chi tiêu, kế hoạch...), danh sách sheet là tập hợp không đồng nhất.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SheetSpec = TableSheet<any> | KeyValueSheet;
