/**
 * Bảng màu tươi trẻ (đủ đậm để icon trắng vẫn rõ). Thứ tự đã được xáo trộn cố định để các màu liền kề khác hẳn nhau.
 */
export const CATEGORY_PALETTE = [
  '#FF6B6B', // đỏ san hô
  '#2BB3E8', // xanh da trời
  '#F39C12', // cam nắng
  '#16B58A', // xanh bạc hà
  '#A55EEA', // tím
  '#FF6B9D', // hồng
  '#4D7CFE', // xanh dương
  '#3FC060', // xanh lá
  '#EE5A24', // cam đỏ
  '#00B8B8', // ngọc
  '#F368E0', // hồng tím
  '#8E7CF3', // tím oải hương
  '#E8A200', // vàng mật
  '#0FA3B1', // xanh cổ vịt
  '#E84393', // hồng đậm
  '#5C7CFA', // chàm sáng
] as const;

/** Chuẩn hóa màu về '#RRGGBB' (chữ hoa). Nhận '#RGB', '#RRGGBB', 'rgb(r,g,b)'; không hợp lệ -> null. */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  let m = /^#([0-9a-fA-F]{3})$/.exec(v);
  if (m) return `#${m[1].split('').map((c) => c + c).join('')}`.toUpperCase();
  m = /^#([0-9a-fA-F]{6})$/.exec(v);
  if (m) return `#${m[1]}`.toUpperCase();
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(v);
  if (rgb) {
    const parts = rgb.slice(1, 4).map(Number);
    if (parts.every((n) => n >= 0 && n <= 255)) return `#${parts.map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }
  return null;
}

interface Colorable {
  id: string;
  color: string | null;
  created_at: string;
}

/**
 * Màu hiển thị cho mỗi danh mục: dùng màu đã lưu nếu hợp lệ, nếu không thì gán màu từ bảng màu theo thứ tự tạo
 * (created_at, id). Thứ tự này ổn định nên màu không đổi mỗi lần tải lại; không ghi gì vào database.
 */
export function assignDisplayColors(items: readonly Colorable[]): Map<string, string> {
  const ordered = [...items].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1));
  const result = new Map<string, string>();
  ordered.forEach((item, rank) => {
    result.set(item.id, normalizeHex(item.color) ?? CATEGORY_PALETTE[rank % CATEGORY_PALETTE.length]);
  });
  return result;
}

/** Màu ngẫu nhiên cho danh mục mới, ưu tiên màu chưa được dùng. */
export function randomUnusedColor(used: Iterable<string>, random: () => number = Math.random): string {
  const taken = new Set([...used].map((c) => normalizeHex(c)).filter((c): c is string => c !== null));
  const free = CATEGORY_PALETTE.filter((c) => !taken.has(c));
  const pool = free.length > 0 ? free : CATEGORY_PALETTE;
  return pool[Math.floor(random() * pool.length)];
}
