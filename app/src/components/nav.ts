import {
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Tags,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/incomes', label: 'Thu nhập', icon: TrendingUp },
  { to: '/expenses', label: 'Chi tiêu', icon: Receipt },
  { to: '/plans', label: 'Kế hoạch chi tiêu', icon: CalendarClock },
  { to: '/budgets', label: 'Ngân sách', icon: PiggyBank },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3 },
  { to: '/categories', label: 'Danh mục', icon: Tags },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
];
