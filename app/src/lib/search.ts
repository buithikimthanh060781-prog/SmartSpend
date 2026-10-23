/**
 * Làm sạch chuỗi tìm kiếm trước khi đưa vào bộ lọc PostgREST `.or()`/`ilike`.
 * Dấu phẩy, ngoặc, % và * có ý nghĩa đặc biệt trong cú pháp filter nên bị loại bỏ.
 */
export function sanitizeSearch(input: string): string {
  return input.replace(/[,()%*\\"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}
