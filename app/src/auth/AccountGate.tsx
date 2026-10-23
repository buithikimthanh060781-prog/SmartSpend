import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorState } from '@/components/ErrorState';
import { FullScreenLoader } from '@/components/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { initializeAccount } from '@/lib/account';
import { isTransientError, toUserMessage } from '@/lib/errors';

/**
 * Chặn nội dung bên trong cho tới khi tài khoản Smart Spend được khởi tạo.
 * - Chạy đúng một lần cho mỗi người dùng trong phiên (cache vô hạn, key theo user.id), không chạy lại mỗi render.
 * - Lỗi tạm thời (mạng/5xx) tự thử lại tối đa 2 lần; lỗi khác hiển thị để người dùng bấm "Thử lại".
 * - KHÔNG tự đăng xuất khi RPC lỗi: người dùng có thể thử lại hoặc chủ động đăng xuất.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  const init = useQuery({
    queryKey: ['account-init', user?.id],
    queryFn: initializeAccount,
    enabled: Boolean(user),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: (failureCount, error) => failureCount < 2 && isTransientError(error),
    retryDelay: (attempt) => 800 * 2 ** attempt,
  });

  if (init.isError) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="w-full max-w-md space-y-4">
          <ErrorState
            title="Không khởi tạo được tài khoản"
            message={toUserMessage(init.error, 'Không khởi tạo được tài khoản Smart Spend. Vui lòng thử lại.')}
            onRetry={() => void init.refetch()}
          />
          <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
            Đăng xuất
          </Button>
        </div>
      </div>
    );
  }

  if (!init.isSuccess) return <FullScreenLoader label="Đang chuẩn bị tài khoản của bạn..." />;

  return <>{children}</>;
}
