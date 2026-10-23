import type { BudgetAlert } from '@/services/budgetAlerts';

/**
 * Chống lặp thông báo (toast) trong một phiên thao tác của một người dùng.
 * Một "sự kiện" = (ngân sách, loại cảnh báo). Toast chỉ được bắn khi thao tác ghi vừa gây ra sự kiện đó,
 * không bao giờ bắn trong lúc render, và không bắn lại nếu sự kiện đã được báo mà điều kiện chưa hết.
 */
export class AlertSession {
  private readonly notified = new Set<string>();

  /**
   * @param before cảnh báo đang có TRƯỚC thao tác ghi
   * @param after cảnh báo có SAU thao tác ghi
   * @returns các cảnh báo mới cần hiển thị toast (đã đánh dấu là đã báo)
   */
  resolve(before: readonly BudgetAlert[], after: readonly BudgetAlert[]): BudgetAlert[] {
    const beforeKeys = new Set(before.map((a) => a.key));

    // Điều kiện đã hết trước thao tác này -> lần chạm ngưỡng tiếp theo là một sự kiện mới.
    for (const key of [...this.notified]) if (!beforeKeys.has(key)) this.notified.delete(key);

    const fresh = after.filter((a) => !beforeKeys.has(a.key) && !this.notified.has(a.key));
    for (const a of fresh) this.notified.add(a.key);
    return fresh;
  }

  reset(): void {
    this.notified.clear();
  }
}

const sessions = new Map<string, AlertSession>();

export function getAlertSession(userId: string): AlertSession {
  let s = sessions.get(userId);
  if (!s) {
    s = new AlertSession();
    sessions.set(userId, s);
  }
  return s;
}

/** Gọi khi đăng xuất/đổi tài khoản để không rò rỉ trạng thái cảnh báo giữa các tài khoản. */
export function resetAlertSessions(): void {
  sessions.clear();
}
