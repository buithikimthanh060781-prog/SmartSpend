// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hồi quy: ô <select> bị `disabled` mà vẫn được đăng ký với React Hook Form trả về undefined, khiến form sửa
// không bao giờ hợp lệ và nút "Lưu thay đổi" không làm gì. Các test này render form thật và bấm nút Lưu.

const updateCategory = vi.fn().mockResolvedValue(undefined);
const createCategory = vi.fn().mockResolvedValue(undefined);
const updatePlan = vi.fn().mockResolvedValue(undefined);
const createPlan = vi.fn().mockResolvedValue(undefined);
const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

vi.mock('@/components/ui/toast', () => ({ useToast: () => toast }));
vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', isLoading: false }),
  todayIso: () => '2026-10-18',
}));
vi.mock('@/hooks/useCategories', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useCategories')>()),
  useCategoryMutations: () => ({ create: { mutateAsync: createCategory }, update: { mutateAsync: updateCategory } }),
}));
vi.mock('@/hooks/usePlans', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/usePlans')>()),
  usePlanMutations: () => ({ create: { mutateAsync: createPlan }, update: { mutateAsync: updatePlan }, setStatus: { mutateAsync: vi.fn(), isPending: false } }),
}));

import { CategoryForm } from '@/components/categories/CategoryFormDialog';
import { PlanForm } from '@/components/plans/PlanFormDialog';
import type { SsCategory, SsExpensePlan } from '@/types/db';

const cat = (over: Partial<SsCategory>): SsCategory => ({
  id: 'c1', user_id: 'u', name: 'Ăn uống', type: 'expense', icon: 'utensils', color: '#FF6B6B', is_active: true, is_default: false, created_at: '2026-01-01', updated_at: '', ...over,
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('form sửa danh mục', () => {
  const editing = cat({});
  const all = [editing, cat({ id: 'c2', name: 'Đi lại' })];
  const colors = new Map([['c1', '#FF6B6B'], ['c2', '#2BB3E8']]);

  it('đổi tên rồi bấm Lưu thay đổi thì thật sự gọi cập nhật với dữ liệu mới', async () => {
    const onClose = vi.fn();
    render(<CategoryForm editing={editing} defaultType="expense" all={all} colors={colors} onClose={onClose} />);
    const user = userEvent.setup();

    const name = screen.getByLabelText('Tên danh mục');
    await user.clear(name);
    await user.type(name, 'Ăn uống & cà phê');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalledTimes(1));
    expect(updateCategory).toHaveBeenCalledWith({ id: 'c1', input: { name: 'Ăn uống & cà phê', icon: 'utensils', color: '#FF6B6B' } });
    expect(createCategory).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật danh mục.');
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText(/Vui lòng chọn loại danh mục/)).toBeNull(); // không có lỗi ẩn ở ô "Loại"
  });

  it('chỉ đổi màu cũng lưu được', async () => {
    render(<CategoryForm editing={editing} defaultType="expense" all={all} colors={colors} onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Chọn màu #16B58A' }));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updateCategory).toHaveBeenCalled());
    expect(updateCategory.mock.calls[0][0].input.color).toBe('#16B58A');
  });

  it('ô Loại hiển thị đúng và không cho đổi', () => {
    render(<CategoryForm editing={editing} defaultType="expense" all={all} colors={colors} onClose={vi.fn()} />);
    const select = screen.getByLabelText('Loại') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.value).toBe('expense');
  });

  it('tên trùng với danh mục khác vẫn bị chặn và hiện lỗi', async () => {
    render(<CategoryForm editing={editing} defaultType="expense" all={all} colors={colors} onClose={vi.fn()} />);
    const user = userEvent.setup();
    const name = screen.getByLabelText('Tên danh mục');
    await user.clear(name);
    await user.type(name, 'đi lại');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText(/Đã có danh mục cùng tên/)).toBeTruthy();
    expect(updateCategory).not.toHaveBeenCalled();
  });

  it('thêm danh mục mới vẫn chọn được loại và lưu', async () => {
    render(<CategoryForm editing={null} defaultType="income" all={all} colors={colors} onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Tên danh mục'), 'Thưởng');
    await user.click(screen.getByRole('button', { name: 'Thêm danh mục' }));
    await waitFor(() => expect(createCategory).toHaveBeenCalled());
    expect(createCategory.mock.calls[0][0]).toMatchObject({ name: 'Thưởng', type: 'income' });
  });
});

describe('form sửa kế hoạch đã có giao dịch liên kết (danh mục bị khóa)', () => {
  const C1 = '123e4567-e89b-42d3-a456-426614174001';
  const C2 = '123e4567-e89b-42d3-a456-426614174002';
  const categories = [cat({ id: C1 }), cat({ id: C2, name: 'Đi lại' })];
  const plan: SsExpensePlan = { id: 'p1', user_id: 'u', category_id: C1, title: 'Du lịch', planned_date: '2026-12-01', planned_amount: 5000000, status: 'in_progress', note: null, created_at: '', updated_at: '' };

  it('đổi tên kế hoạch rồi Lưu thay đổi thì gọi cập nhật, giữ nguyên danh mục', async () => {
    const onClose = vi.fn();
    render(<PlanForm editing={plan} categories={categories} linkedCount={2} onClose={onClose} />);
    const user = userEvent.setup();

    expect((screen.getByLabelText('Danh mục') as HTMLSelectElement).disabled).toBe(true);
    const title = screen.getByLabelText('Tên kế hoạch');
    await user.clear(title);
    await user.type(title, 'Du lịch Đà Nẵng');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(updatePlan).toHaveBeenCalledTimes(1));
    expect(updatePlan).toHaveBeenCalledWith({
      id: 'p1',
      input: { category_id: C1, title: 'Du lịch Đà Nẵng', planned_date: '2026-12-01', planned_amount: 5000000, status: 'in_progress', note: null },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('kế hoạch chưa có giao dịch vẫn đổi được danh mục', async () => {
    render(<PlanForm editing={plan} categories={categories} linkedCount={0} onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Danh mục'), C2);
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updatePlan).toHaveBeenCalled());
    expect(updatePlan.mock.calls[0][0].input.category_id).toBe(C2);
  });

  it('không cho hủy kế hoạch đã có giao dịch', async () => {
    render(<PlanForm editing={plan} categories={categories} linkedCount={2} onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'cancelled');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText(/Không thể hủy: kế hoạch đã có 2 giao dịch/)).toBeTruthy();
    expect(updatePlan).not.toHaveBeenCalled();
  });
});
