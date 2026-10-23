import { describe, expect, it } from 'vitest';
import { assignDisplayColors, CATEGORY_PALETTE, normalizeHex, randomUnusedColor } from '@/lib/colors';

describe('normalizeHex', () => {
  it('chuẩn hóa các định dạng màu thường gặp', () => {
    expect(normalizeHex('#f58b2b')).toBe('#F58B2B');
    expect(normalizeHex('#fb0')).toBe('#FFBB00');
    expect(normalizeHex('rgb(245, 139, 43)')).toBe('#F58B2B');
  });
  it('không hợp lệ -> null', () => {
    for (const v of [null, undefined, '', 'red', '#12', '#GGGGGG', 'rgb(300,0,0)']) expect(normalizeHex(v)).toBeNull();
  });
});

describe('assignDisplayColors', () => {
  const mk = (n: number, color: string | null = null) => ({ id: `id-${String(n).padStart(2, '0')}`, color, created_at: `2026-01-${String(n + 1).padStart(2, '0')}` });

  it('15 danh mục chưa có màu nhận 15 màu khác nhau', () => {
    const items = Array.from({ length: 15 }, (_, i) => mk(i));
    const colors = [...assignDisplayColors(items).values()];
    expect(new Set(colors).size).toBe(15);
  });

  it('giữ màu đã lưu (kể cả #RGB) và ổn định khi thêm danh mục mới', () => {
    const base = [mk(0, '#abc'), mk(1), mk(2)];
    const before = assignDisplayColors(base);
    const after = assignDisplayColors([...base, mk(3)]);
    expect(before.get('id-00')).toBe('#AABBCC');
    for (const it of base) expect(after.get(it.id)).toBe(before.get(it.id));
  });

  it('bảng màu không có màu trùng', () => {
    expect(new Set(CATEGORY_PALETTE).size).toBe(CATEGORY_PALETTE.length);
  });
});

describe('randomUnusedColor', () => {
  it('không chọn màu đã dùng khi còn màu trống', () => {
    const used = CATEGORY_PALETTE.slice(0, CATEGORY_PALETTE.length - 1);
    expect(randomUnusedColor(used)).toBe(CATEGORY_PALETTE[CATEGORY_PALETTE.length - 1]);
  });
  it('hết màu trống vẫn trả về một màu trong bảng', () => {
    expect(CATEGORY_PALETTE).toContain(randomUnusedColor(CATEGORY_PALETTE));
  });
});
