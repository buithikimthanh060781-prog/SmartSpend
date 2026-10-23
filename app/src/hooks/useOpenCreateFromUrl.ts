import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Thao tác nhanh từ Dashboard: đường dẫn `?new=1` mở sẵn form tạo mới của trang, rồi xóa tham số khỏi URL
 * để tải lại trang hoặc quay lại không mở form lần nữa.
 */
export function useOpenCreateFromUrl(open: () => void): void {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') !== '1') return;
    open();
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
    // Chỉ chạy một lần khi vào trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
