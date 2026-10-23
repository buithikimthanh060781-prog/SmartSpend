import {
  Banknote,
  Briefcase,
  Car,
  Gamepad2,
  GraduationCap,
  Gift,
  HeartPulse,
  Home,
  PiggyBank,
  Plane,
  Shirt,
  ShoppingCart,
  Tag,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { normalizeHex } from '@/lib/colors';

/** Icon danh mục dùng tên icon Lucide (không dùng emoji). Tên không có trong danh sách sẽ hiển thị icon mặc định. */
export const CATEGORY_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  wallet: { label: 'Ví', icon: Wallet },
  banknote: { label: 'Tiền mặt', icon: Banknote },
  briefcase: { label: 'Công việc', icon: Briefcase },
  'piggy-bank': { label: 'Tiết kiệm', icon: PiggyBank },
  utensils: { label: 'Ăn uống', icon: Utensils },
  'shopping-cart': { label: 'Mua sắm', icon: ShoppingCart },
  car: { label: 'Di chuyển', icon: Car },
  home: { label: 'Nhà ở', icon: Home },
  zap: { label: 'Điện nước', icon: Zap },
  'heart-pulse': { label: 'Sức khỏe', icon: HeartPulse },
  'graduation-cap': { label: 'Học tập', icon: GraduationCap },
  'gamepad-2': { label: 'Giải trí', icon: Gamepad2 },
  plane: { label: 'Du lịch', icon: Plane },
  gift: { label: 'Quà tặng', icon: Gift },
  shirt: { label: 'Thời trang', icon: Shirt },
  tag: { label: 'Khác', icon: Tag },
};

export function CategoryIcon({ icon, color, className }: { icon: string | null; color: string | null; className?: string }) {
  const Icon = (icon && CATEGORY_ICONS[icon]?.icon) || Tag;
  const bg = normalizeHex(color) ?? '#142B49';
  return (
    <span className={className ?? 'grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white'} style={{ backgroundColor: bg }}>
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}
