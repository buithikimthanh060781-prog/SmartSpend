import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AccountGate } from '@/auth/AccountGate';
import { useAuth } from '@/auth/AuthProvider';
import { FullScreenLoader } from '@/components/LoadingSkeleton';

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  // Mọi phiên hợp lệ (đăng nhập mới, tải lại trang, mở tab mới) đều đi qua bước khởi tạo tài khoản.
  return (
    <AccountGate>
      <Outlet />
    </AccountGate>
  );
}
