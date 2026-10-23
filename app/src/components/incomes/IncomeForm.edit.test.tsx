// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const update = vi.fn().mockResolvedValue(undefined);
const create = vi.fn().mockResolvedValue(undefined);
const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

vi.mock('@/components/ui/toast', () => ({ useToast: () => toast }));
vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', isLoading: false }),
  todayIso: () => '2026-10-18',
}));
vi.mock('@/hooks/useIncomes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useIncomes')>()),
  useIncomeMutations: () => ({ create: { mutateAsync: create }, update: { mutateAsync: update }, remove: { mutateAsync: vi.fn() } }),
}));

import { IncomeForm } from '@/components/incomes/IncomeFormDialog';
import type { SsCategory, SsIncome } from '@/types/db';

const CAT = '123e4567-e89b-42d3-a456-426614174001';
const CAT2 = '123e4567-e89b-42d3-a456-426614174002';
const OFF = '123e4567-e89b-42d3-a456-426614174003';
const cat = (id: string, name: string, over: Partial<SsCategory> = {}): SsCategory => ({
  id, user_id: 'u', name, type: 'income', icon: null, color: null, is_active: true, is_default: false, created_at: '', updated_at: '', ...over,
});
const categories = [cat(CAT, 'Lương'), cat(CAT2, 'Thưởng'), cat(OFF, 'Đã tắt', { is_active: false })];

const income = (over: Partial<SsIncome> = {}): SsIncome => ({
  id: 'i1', user_id: 'u', category_id: CAT, amount: 20_000_000, income_date: '2026-10-05', status: 'received', description: 'Lương tháng 10', note: null, created_at: '', updated_at: '', ...over,
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

async function saveEdited(editing: SsIncome, change: (user: ReturnType<typeof userEvent.setup>) => Promise<void>) {
  const onClose = vi.fn();
  render(<IncomeForm editing={editing} categories={categories} onClose={onClose} />);
  const user = userEvent.setup();
  await change(user);
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
  return onClose;
}

describe('form sửa thu nhập: bấm Lưu thay đổi phải cập nhật dữ liệu', () => {
  it('đổi mô tả rồi lưu', async () => {
    const onClose = await saveEdited(income(), async (user) => {
      const d = screen.getByLabelText('Mô tả');
      await user.clear(d);
      await user.type(d, 'Lương + thưởng');
    });
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith({
      id: 'i1',
      input: { category_id: CAT, amount: 20_000_000, income_date: '2026-10-05', status: 'received', description: 'Lương + thưởng', note: null },
    });
    expect(create).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật thu nhập.');
    expect(onClose).toHaveBeenCalled();
  });

  it('đổi số tiền (nhập kiểu 25.000.000) và trạng thái', async () => {
    await saveEdited(income(), async (user) => {
      const a = screen.getByLabelText('Số tiền');
      await user.clear(a);
      await user.type(a, '25.000.000');
      await user.selectOptions(screen.getByLabelText('Trạng thái'), 'expected');
    });
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0].input).toMatchObject({ amount: 25_000_000, status: 'expected' });
  });

  it.each([
    ['số nguyên', 1_500_000],
    ['số thập phân', 1_500_000.5],
    ['chuỗi numeric từ PostgreSQL', '1500000.00'],
    ['chuỗi có phần thập phân', '1500000.50'],
  ])('mở form với số tiền là %s thì hiển thị đúng và lưu được ngay khi chưa sửa gì', async (_n, amount) => {
    await saveEdited(income({ amount }), async () => undefined);
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0].input.amount).toBe(Number(amount));
  });

  it('ghi chú có sẵn được giữ, ghi chú rỗng được lưu thành null', async () => {
    await saveEdited(income({ note: 'ghi chú cũ' }), async () => undefined);
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0].input.note).toBe('ghi chú cũ');

    update.mockClear();
    cleanup();
    await saveEdited(income({ note: 'x' }), async (user) => {
      await user.clear(screen.getByLabelText(/Ghi chú/));
    });
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0].input.note).toBeNull();
  });

  it('khoản thu nhập thuộc danh mục đã tắt vẫn sửa và lưu được', async () => {
    await saveEdited(income({ category_id: OFF }), async (user) => {
      const d = screen.getByLabelText('Mô tả');
      await user.type(d, '!');
    });
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0].input.category_id).toBe(OFF);
  });

  it('mô tả rỗng (null trong database) vẫn lưu được', async () => {
    await saveEdited(income({ description: null as unknown as string }), async () => undefined);
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0].input.description).toBe('');
  });

  it('khi thao tác cập nhật thất bại, người dùng thấy thông báo lỗi và form không đóng', async () => {
    update.mockRejectedValueOnce({ code: '42501', message: 'rls' });
    const onClose = await saveEdited(income(), async () => undefined);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Bạn không có quyền thực hiện thao tác này.'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lỗi lạ từ database hiện cố định trong form kèm mã và nội dung gốc (không bị che bằng câu chung chung)', async () => {
    update.mockRejectedValueOnce({ code: 'PGRST204', message: "Could not find the 'x' column of 'ss_incomes' in the schema cache" });
    await saveEdited(income(), async () => undefined);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('PGRST204');
    expect(alert.textContent).toContain("Could not find the 'x' column");
  });

  it('lỗi cũ biến mất khi lưu lại thành công', async () => {
    update.mockRejectedValueOnce({ code: '23514', message: 'check' });
    const onClose = await saveEdited(income(), async () => undefined);
    expect(await screen.findByText(/không thỏa ràng buộc/)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByText(/không thỏa ràng buộc/)).toBeNull();
  });

  it('dữ liệu sai thì hiện lỗi ngay tại ô và KHÔNG gọi cập nhật', async () => {
    await saveEdited(income(), async (user) => {
      const a = screen.getByLabelText('Số tiền');
      await user.clear(a);
      await user.type(a, 'abc');
    });
    expect(await screen.findByText(/Số tiền không hợp lệ/)).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });
});
