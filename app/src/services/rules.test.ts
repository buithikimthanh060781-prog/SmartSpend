import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

// Supabase giả lập trong bộ nhớ: đủ cho select/eq/neq/maybeSingle/count/insert/update/delete.
const fake = vi.hoisted(() => {
  const db: Record<string, Row[]> = {};
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];

  function from(table: string) {
    const rows = () => db[table] ?? [];
    const filters: Array<(r: Row) => boolean> = [];
    let head = false;
    let op: 'select' | 'update' | 'delete' = 'select';
    let payload: Row | undefined;

    const matched = () => rows().filter((r) => filters.every((f) => f(r)));
    const api: Record<string, unknown> = {
      select(_cols?: string, opts?: { head?: boolean }) {
        head = Boolean(opts?.head);
        return api;
      },
      eq(col: string, v: unknown) { filters.push((r) => r[col] === v); return api; },
      neq(col: string, v: unknown) { filters.push((r) => r[col] !== v); return api; },
      returns() { return api; },
      maybeSingle() { return Promise.resolve({ data: matched()[0] ?? null, error: null }); },
      insert(row: Row) {
        calls.push({ table, op: 'insert', payload: row });
        return Promise.resolve({ error: null });
      },
      update(p: Row) { op = 'update'; payload = p; return api; },
      delete() { op = 'delete'; return api; },
      then(resolve: (v: unknown) => unknown) {
        const hit = matched();
        if (op !== 'select') calls.push({ table, op, payload });
        return Promise.resolve({ data: head ? null : hit, count: hit.length, error: null }).then(resolve);
      },
    };
    return api;
  }
  return { db, calls, supabase: { from } };
});

vi.mock('@/lib/supabase', () => ({ supabase: fake.supabase }));

import { createCategory, deleteCategory, setCategoryActive, updateCategory } from '@/services/categories';
import { assertCategoryUsable, assertPlanLinkable, BusinessRuleError } from '@/services/guards';
import { createExpense, updateExpense } from '@/services/expenses';
import { createIncome } from '@/services/incomes';
import { createPlan, updatePlan, updatePlanStatus } from '@/services/plans';

const U = 'user-a';
const OTHER = 'user-b';

function seed() {
  fake.calls.length = 0;
  fake.db.ss_categories = [
    { id: 'inc', user_id: U, name: 'Lương', type: 'income', is_active: true, is_default: true },
    { id: 'exp', user_id: U, name: 'Ăn uống', type: 'expense', is_active: true, is_default: true },
    { id: 'exp2', user_id: U, name: 'Đi lại', type: 'expense', is_active: true, is_default: false },
    { id: 'off', user_id: U, name: 'Cũ', type: 'expense', is_active: false, is_default: false },
    { id: 'custom', user_id: U, name: 'Cà phê', type: 'expense', is_active: true, is_default: false },
  ];
  fake.db.ss_expense_plans = [
    { id: 'p-ok', user_id: U, category_id: 'exp', status: 'planned', title: 'Tiệc' },
    { id: 'p-cancelled', user_id: U, category_id: 'exp', status: 'cancelled', title: 'Đã hủy' },
    { id: 'p-other-cat', user_id: U, category_id: 'exp2', status: 'planned', title: 'Xe' },
    { id: 'p-foreign', user_id: OTHER, category_id: 'exp', status: 'planned', title: 'Của người khác' },
    { id: 'p-linked', user_id: U, category_id: 'exp', status: 'in_progress', title: 'Đã có chi' },
  ];
  fake.db.ss_expenses = [
    { id: 'e1', plan_id: 'p-linked', category_id: 'exp' },
    { id: 'e2', plan_id: 'p-linked', category_id: 'exp' },
    { id: 'e3', plan_id: null, category_id: 'exp' },
  ];
  fake.db.ss_incomes = [{ id: 'i1', category_id: 'inc' }];
}

const expenseInput = { category_id: 'exp', plan_id: null, amount: 100, expense_date: '2026-10-01', payment_method: 'cash' as const, description: '', note: null };
const planInput = { category_id: 'exp', title: 'KH', planned_date: '2026-11-01', planned_amount: 500, status: 'planned' as const, note: null };
const incomeInput = { category_id: 'inc', amount: 100, income_date: '2026-10-01', status: 'received' as const, description: '', note: null };

beforeEach(seed);

describe('assertCategoryUsable', () => {
  it('chấp nhận danh mục đúng loại và đang hoạt động', async () => {
    await expect(assertCategoryUsable('exp', 'expense', true)).resolves.toBeUndefined();
  });
  it('từ chối danh mục sai loại (thu nhập dùng danh mục chi tiêu và ngược lại)', async () => {
    await expect(assertCategoryUsable('exp', 'income', true)).rejects.toThrow(BusinessRuleError);
    await expect(assertCategoryUsable('inc', 'expense', true)).rejects.toThrow(/thuộc loại Thu nhập/);
  });
  it('từ chối danh mục đã tắt khi tạo mới, cho phép khi không bắt buộc (sửa giữ nguyên danh mục)', async () => {
    await expect(assertCategoryUsable('off', 'expense', true)).rejects.toThrow(/đã bị tắt/);
    await expect(assertCategoryUsable('off', 'expense', false)).resolves.toBeUndefined();
  });
  it('từ chối danh mục không tồn tại / không thấy được (RLS)', async () => {
    await expect(assertCategoryUsable('nope', 'expense', true)).rejects.toThrow(/không tồn tại/);
  });
});

describe('assertPlanLinkable', () => {
  it('chấp nhận kế hoạch của mình, cùng danh mục, chưa hủy', async () => {
    await expect(assertPlanLinkable('p-ok', 'exp', U)).resolves.toBeUndefined();
  });
  it('từ chối kế hoạch đã hủy', async () => {
    await expect(assertPlanLinkable('p-cancelled', 'exp', U)).rejects.toThrow(/đã bị hủy/);
  });
  it('từ chối kế hoạch khác danh mục', async () => {
    await expect(assertPlanLinkable('p-other-cat', 'exp', U)).rejects.toThrow(/danh mục khác/);
  });
  it('từ chối kế hoạch của người dùng khác', async () => {
    await expect(assertPlanLinkable('p-foreign', 'exp', U)).rejects.toThrow(/không thuộc tài khoản/);
  });
});

describe('chi tiêu', () => {
  it('chi tiêu ngoài kế hoạch (plan_id null) được tạo', async () => {
    await createExpense(U, expenseInput);
    expect(fake.calls.filter((c) => c.op === 'insert')).toHaveLength(1);
  });
  it('liên kết nhiều chi tiêu vào cùng một kế hoạch hợp lệ', async () => {
    await createExpense(U, { ...expenseInput, plan_id: 'p-ok' });
    await createExpense(U, { ...expenseInput, plan_id: 'p-ok' });
    expect(fake.calls.filter((c) => c.op === 'insert')).toHaveLength(2);
  });
  it('KHÔNG ghi khi chọn danh mục thu nhập cho chi tiêu', async () => {
    await expect(createExpense(U, { ...expenseInput, category_id: 'inc' })).rejects.toThrow(BusinessRuleError);
    expect(fake.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });
  it('KHÔNG ghi khi liên kết kế hoạch sai danh mục / đã hủy / của người khác', async () => {
    for (const plan_id of ['p-other-cat', 'p-cancelled', 'p-foreign']) {
      await expect(createExpense(U, { ...expenseInput, plan_id })).rejects.toThrow(BusinessRuleError);
    }
    expect(fake.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });
  it('sửa chi tiêu: đổi danh mục mà vẫn giữ kế hoạch cũ bị từ chối', async () => {
    fake.db.ss_expenses.push({ id: 'e9', plan_id: 'p-ok', category_id: 'exp' });
    await expect(updateExpense(U, 'e9', { ...expenseInput, category_id: 'exp2', plan_id: 'p-ok' })).rejects.toThrow(/danh mục khác/);
    expect(fake.calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });
});

describe('danh mục', () => {
  const input = { name: 'x', type: 'expense' as const, icon: null, color: null };

  it('chặn tạo trùng tên cùng loại (hoa thường, khoảng trắng) dựa trên dữ liệu server', async () => {
    await expect(createCategory(U, { ...input, name: '  ĂN   uống ' })).rejects.toThrow(/Đã có danh mục/);
    expect(fake.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });
  it('cho phép trùng tên khác loại', async () => {
    await createCategory(U, { ...input, name: 'Lương', type: 'expense' });
    expect(fake.calls.filter((c) => c.op === 'insert')).toHaveLength(1);
  });
  it('sửa tên thành tên đã có (cùng loại) bị từ chối, giữ nguyên tên của chính nó thì được', async () => {
    await expect(updateCategory(U, 'exp2', { name: 'ăn uống', icon: null, color: null })).rejects.toThrow(/Đã có danh mục/);
    await updateCategory(U, 'exp2', { name: 'Đi lại', icon: null, color: '#FF6B6B' });
    expect(fake.calls.filter((c) => c.op === 'update')).toHaveLength(1);
  });
  it('không xóa danh mục mặc định', async () => {
    await expect(deleteCategory('exp')).rejects.toThrow(/mặc định/);
    expect(fake.calls.filter((c) => c.op === 'delete')).toHaveLength(0);
  });
  it('không xóa danh mục đang được sử dụng', async () => {
    fake.db.ss_expenses.push({ id: 'e-custom', plan_id: null, category_id: 'custom' });
    await expect(deleteCategory('custom')).rejects.toThrow(/đang được dùng bởi 1 bản ghi/);
    expect(fake.calls.filter((c) => c.op === 'delete')).toHaveLength(0);
  });
  it('xóa được danh mục tùy chỉnh chưa dùng', async () => {
    await deleteCategory('off');
    expect(fake.calls.filter((c) => c.op === 'delete')).toHaveLength(1);
  });
  it('tắt danh mục chỉ đổi is_active, không xóa gì (giữ lịch sử)', async () => {
    await setCategoryActive('exp', false);
    expect(fake.calls.map((c) => c.op)).toEqual(['update']);
    expect(fake.calls[0].payload).toMatchObject({ is_active: false });
  });
});

describe('thu nhập', () => {
  it('KHÔNG ghi khi dùng danh mục chi tiêu cho thu nhập', async () => {
    await expect(createIncome(U, { ...incomeInput, category_id: 'exp' })).rejects.toThrow(BusinessRuleError);
    expect(fake.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });
  it('tạo thu nhập đúng loại', async () => {
    await createIncome(U, incomeInput);
    expect(fake.calls.filter((c) => c.op === 'insert')).toHaveLength(1);
  });
});

describe('kế hoạch', () => {
  it('tạo kế hoạch bằng danh mục thu nhập bị từ chối', async () => {
    await expect(createPlan(U, { ...planInput, category_id: 'inc' })).rejects.toThrow(BusinessRuleError);
  });
  it('không đổi danh mục của kế hoạch đã có giao dịch liên kết', async () => {
    await expect(updatePlan('p-linked', { ...planInput, category_id: 'exp2', status: 'in_progress' })).rejects.toThrow(/Không thể đổi danh mục.*2 giao dịch/);
    expect(fake.calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });
  it('đổi danh mục kế hoạch chưa có giao dịch thì được phép', async () => {
    await updatePlan('p-ok', { ...planInput, category_id: 'exp2' });
    expect(fake.calls.filter((c) => c.op === 'update')).toHaveLength(1);
  });
  it('không hủy kế hoạch đã có giao dịch (qua form sửa và qua đổi trạng thái)', async () => {
    await expect(updatePlan('p-linked', { ...planInput, status: 'cancelled' })).rejects.toThrow(/Không thể hủy/);
    await expect(updatePlanStatus('p-linked', 'cancelled')).rejects.toThrow(/Không thể hủy/);
    expect(fake.calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });
  it('hủy kế hoạch chưa có giao dịch thì được', async () => {
    await updatePlanStatus('p-ok', 'cancelled');
    expect(fake.calls.filter((c) => c.op === 'update')).toHaveLength(1);
  });
});
