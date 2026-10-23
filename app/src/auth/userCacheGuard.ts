import type { QueryClient } from '@tanstack/react-query';
import { resetAlertSessions } from '@/services/alertSession';

/**
 * Cách ly dữ liệu giữa các tài khoản trong bộ nhớ đệm TanStack Query.
 * Mỗi khi trạng thái đăng nhập thay đổi, nếu người dùng KHÁC với người dùng trước đó (đăng xuất, hoặc đăng nhập
 * trực tiếp sang tài khoản khác), hủy mọi truy vấn đang chạy và xóa toàn bộ cache + mutation.
 * Làm mới token (cùng user.id) hoặc lần đăng nhập đầu tiên thì KHÔNG xóa cache.
 * Ngoài ra mọi query key đều chứa user.id, nên dữ liệu của A không thể được đọc bằng key của B.
 */
export class UserCacheGuard {
  /** undefined = chưa biết (khởi động), null = chưa đăng nhập, string = user.id hiện tại. */
  private currentUserId: string | null | undefined = undefined;

  constructor(private readonly queryClient: QueryClient) {}

  /** Trả về true nếu đã reset cache. Phải gọi TRƯỚC khi cập nhật state phiên của giao diện. */
  handle(event: string, userId: string | null): boolean {
    const previous = this.currentUserId;
    this.currentUserId = userId;

    const userChanged = previous !== undefined && previous !== null && previous !== userId;
    if (!userChanged && event !== 'SIGNED_OUT') return false;

    void this.queryClient.cancelQueries();
    this.queryClient.clear();
    resetAlertSessions();
    return true;
  }
}
