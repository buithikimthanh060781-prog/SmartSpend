import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { UserCacheGuard } from '@/auth/userCacheGuard';
import { getAlertSession } from '@/services/alertSession';

function setup() {
  const qc = new QueryClient();
  return { qc, guard: new UserCacheGuard(qc) };
}

describe('UserCacheGuard - cách ly cache giữa tài khoản', () => {
  it('đăng nhập lần đầu / khởi động không xóa cache', () => {
    const { qc, guard } = setup();
    qc.setQueryData(['x'], 1);
    expect(guard.handle('INITIAL_SESSION', 'A')).toBe(false);
    expect(qc.getQueryData(['x'])).toBe(1);
  });

  it('làm mới token cùng user.id không xóa cache', () => {
    const { qc, guard } = setup();
    guard.handle('SIGNED_IN', 'A');
    qc.setQueryData(['dashboard', 'A'], { income: 100 });
    expect(guard.handle('TOKEN_REFRESHED', 'A')).toBe(false);
    expect(qc.getQueryData(['dashboard', 'A'])).toEqual({ income: 100 });
  });

  it('đăng xuất xóa toàn bộ cache', () => {
    const { qc, guard } = setup();
    guard.handle('SIGNED_IN', 'A');
    qc.setQueryData(['dashboard', 'A'], { income: 100 });
    expect(guard.handle('SIGNED_OUT', null)).toBe(true);
    expect(qc.getQueryData(['dashboard', 'A'])).toBeUndefined();
  });

  it('đăng xuất rồi đăng nhập lại cùng tài khoản: cache trống, không có dữ liệu cũ', () => {
    const { qc, guard } = setup();
    guard.handle('SIGNED_IN', 'A');
    qc.setQueryData(['dashboard', 'A'], { income: 100 });
    guard.handle('SIGNED_OUT', null);
    guard.handle('SIGNED_IN', 'A');
    expect(qc.getQueryData(['dashboard', 'A'])).toBeUndefined();
  });

  it('chuyển trực tiếp A -> B (không đăng xuất) xóa cache của A', () => {
    const { qc, guard } = setup();
    guard.handle('SIGNED_IN', 'A');
    qc.setQueryData(['dashboard', 'A'], { income: 100 });
    qc.setQueryData(['account-init', 'A'], true);
    qc.setQueryData(['categories', 'A'], ['Ăn uống']);

    expect(guard.handle('SIGNED_IN', 'B')).toBe(true);

    expect(qc.getQueryData(['dashboard', 'A'])).toBeUndefined();
    expect(qc.getQueryData(['account-init', 'A'])).toBeUndefined();
    expect(qc.getQueryData(['categories', 'A'])).toBeUndefined();
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
  });

  it('hủy truy vấn đang chạy của tài khoản cũ khi chuyển sang tài khoản khác', async () => {
    const { qc, guard } = setup();
    guard.handle('SIGNED_IN', 'A');
    const inFlight = qc.fetchQuery({
      queryKey: ['dashboard', 'A'],
      queryFn: () => new Promise<never>(() => undefined), // không bao giờ tự hoàn thành
      retry: false,
    });
    inFlight.catch(() => undefined);

    guard.handle('SIGNED_IN', 'B');

    await expect(inFlight).rejects.toBeDefined(); // bị hủy, không treo vô hạn
    expect(qc.getQueryData(['dashboard', 'A'])).toBeUndefined();
  });

  it('cache ngân sách và trạng thái cảnh báo của A không lọt sang B', () => {
    const { qc, guard } = setup();
    guard.handle('SIGNED_IN', 'A');
    qc.setQueryData(['budgets', 'overview', 'A', '2026-10-18'], { alerts: [1, 2, 3] });
    qc.setQueryData(['budgets', 'list', 'A', {}], [1]);
    const sessionA = getAlertSession('A');
    const near = { key: 'b1:near_limit' } as never;
    expect(sessionA.resolve([], [near])).toHaveLength(1); // A đã được báo
    expect(getAlertSession('A')).toBe(sessionA);

    guard.handle('SIGNED_IN', 'B');

    expect(qc.getQueryData(['budgets', 'overview', 'A', '2026-10-18'])).toBeUndefined();
    expect(qc.getQueryData(['budgets', 'list', 'A', {}])).toBeUndefined();
    // trạng thái chống lặp của phiên cũ bị bỏ: không rò rỉ sang tài khoản kế tiếp
    expect(getAlertSession('A')).not.toBe(sessionA);
  });

  it('kết quả trả về muộn của tài khoản cũ không lọt vào cache mới', async () => {
    const { qc, guard } = setup();
    guard.handle('SIGNED_IN', 'A');
    let resolveLate: (v: string) => void = () => undefined;
    const late = qc.fetchQuery({
      queryKey: ['incomes', 'A'],
      queryFn: () => new Promise<string>((r) => { resolveLate = r; }),
      retry: false,
    });
    late.catch(() => undefined);

    guard.handle('SIGNED_IN', 'B');
    resolveLate('DỮ LIỆU CỦA A');
    await Promise.resolve();

    expect(qc.getQueryData(['incomes', 'A'])).toBeUndefined();
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
  });
});
