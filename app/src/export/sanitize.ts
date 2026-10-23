/**
 * Chống CSV/Excel formula injection cho dữ liệu văn bản do người dùng nhập (mô tả, ghi chú, tên danh mục...).
 * Một ô văn bản bắt đầu bằng = + - @ (hoặc TAB / CR) có thể bị Excel/Sheets hiểu là công thức khi mở file.
 * Cách xử lý chuẩn (OWASP): thêm dấu nháy đơn ở đầu để ô luôn được coi là văn bản. Ký tự điều khiển bị loại bỏ.
 * Chỉ áp dụng cho ô VĂN BẢN; ô số (tiền, phần trăm) và ngày được ghi đúng kiểu nên không đi qua hàm này.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F]/g;
const FORMULA_START = /^[\s]*[=+\-@]/;

export function sanitizeText(value: string): string {
  const cleaned = value.replace(CONTROL_CHARS, '');
  if (FORMULA_START.test(cleaned) || /^[\t\r]/.test(cleaned)) return `'${cleaned}`;
  return cleaned;
}

/** Định dạng ngày ISO 'YYYY-MM-DD' thành dd/MM/yyyy mà không qua Date (không lệch múi giờ). */
export function formatDateVi(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
