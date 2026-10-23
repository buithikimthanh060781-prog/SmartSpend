import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', async () => {
  const { sharedFake } = await import('@/test/fakeSupabase');
  return { supabase: sharedFake.supabase };
});

import { sharedFake as fake } from '@/test/fakeSupabase';
import { BusinessRuleError } from '@/services/guards';
import { createBudget, deleteBudget, DuplicateBudgetError, listBudgetAuditLogs, listBudgets, loadBudgetOverview, updateBudgetAmount } from '@/services/budgets';
import { toMutationMessage } from '@/lib/errors';

const U = 'user-a';
const OTHER = 'user-b';

function seed() {
  fake.calls.length = 0;
  fake.db.ss_categories = [
    { id: 'food', user_id: U, name: 'Ăn uống', type: 'expense', is_active: true },
    { id: 'taxi', user_id: U, name: 'Đi lại', type: 'expense', is_active: true },
    { id: 'off', user_id: U, name: 'Cũ', type: 'expense', is_active: false },
    { id: 'inc', user_id: U, name: 'Lương', type: 'income', is_active: true },
  ];
  fake.db.ss_budgets = [];
  fake.db.ss_expenses = [
    { id: 'e1', user_id: U, category_id: 'food', plan_id: null, amount: 100, expense_date: '2026-10-28' },
    { id: 'e2', user_id: U, category_id: 'food', plan_id: 'p1', amount: 200, expense_date: '2026-10-26' },
    { id: 'e3', user_id: U, category_id: 'taxi', plan_id: null, amount: 50, expense_date: '2026-11-01' },
  ];
  fake.db.ss_budget_audit_logs = [
    { id: 2, user_id: U, budget_id: 'b-old', action: 'UPDATE', old_amount: 1000, new_amount: 1500, changed_at: '2026-10-02T00:00:00Z' },
    { id: 1, user_id: U, budget_id: 'b-old', action: 'INSERT', old_amount: null, new_amount: 1000, changed_at: '2026-10-01T00:00:00Z' },
    { id: 3, user_id: OTHER, budget_id: 'b-x', action: 'INSERT', old_amount: null, new_amount: 7, changed_at: '2026-10-01T00:00:00Z' },
  ];
}

const ops = (table: string, op: string) => fake.calls.filter((c) => c.table === table && c.op === op);
const baseInput = { period_type: 'monthly' as const, anchor: '2026-10-15', category_id: null, amount: 5_000_000 };

beforeEach(seed);

describe('tạo ngân sách', () => {
  it('period_start/end do hệ thống tính đúng quy ước, không lấy từ người dùng', async () => {
    await createBudget(U, baseInput);
    await createBudget(U, { ...baseInput, period_type: 'weekly', anchor: '2026-10-28' }); // Thứ Tư
    await createBudget(U, { ...baseInput, period_type: 'daily', anchor: '2026-10-28' });
    const rows = fake.db.ss_budgets;
    expect(rows.map((r) => [r.period_type, r.period_start, r.period_end])).toEqual([
      ['monthly', '2026-10-01', '2026-11-01'],
      ['weekly', '2026-10-26', '2026-11-02'],
      ['daily', '2026-10-28', '2026-10-29'],
    ]);
    expect(rows.every((r) => r.user_id === U)).toBe(true);
  });

  it('cho phép hạn mức bằng 0', async () => {
    await createBudget(U, { ...baseInput, amount: 0 });
    expect(fake.db.ss_budgets[0].amount).toBe(0);
  });

  it('từ chối số âm và không phải số, không ghi gì', async () => {
    await expect(createBudget(U, { ...baseInput, amount: -1 })).rejects.toThrow(/không được âm/);
    await expect(createBudget(U, { ...baseInput, amount: Number.NaN })).rejects.toThrow(BusinessRuleError);
    expect(ops('ss_budgets', 'insert')).toHaveLength(0);
  });

  it('chặn trùng cùng user + loại kỳ + ngày bắt đầu + danh mục (kiểm tra ở frontend)', async () => {
    await createBudget(U, baseInput);
    await expect(createBudget(U, { ...baseInput, anchor: '2026-10-31' })).rejects.toThrow(DuplicateBudgetError); // cùng kỳ tháng
    expect(ops('ss_budgets', 'insert')).toHaveLength(1);
  });

  it('trùng với ngân sách danh mục chỉ khi cùng danh mục', async () => {
    await createBudget(U, { ...baseInput, category_id: 'food' });
    await expect(createBudget(U, { ...baseInput, category_id: 'food' })).rejects.toThrow(DuplicateBudgetError);
    await createBudget(U, { ...baseInput, category_id: 'taxi' }); // danh mục khác: được
    await createBudget(U, baseInput); // tổng: được (khác phạm vi)
    expect(fake.db.ss_budgets).toHaveLength(3);
  });

  it('khác loại kỳ hoặc khác ngày bắt đầu thì không trùng; hai tuần liền kề không trùng', async () => {
    await createBudget(U, { ...baseInput, period_type: 'weekly', anchor: '2026-10-26' });
    await createBudget(U, { ...baseInput, period_type: 'weekly', anchor: '2026-11-02' });
    await createBudget(U, { ...baseInput, period_type: 'daily', anchor: '2026-10-26' });
    expect(fake.db.ss_budgets).toHaveLength(3);
    // cùng tuần (Thứ Hai và Chủ Nhật) là TRÙNG vì cùng period_start
    await expect(createBudget(U, { ...baseInput, period_type: 'weekly', anchor: '2026-11-01' })).rejects.toThrow(DuplicateBudgetError);
  });

  it('không tính là trùng với ngân sách của người dùng khác', async () => {
    fake.db.ss_budgets.push({ id: 'x', user_id: OTHER, category_id: null, period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01', amount: 1 });
    await createBudget(U, baseInput);
    expect(ops('ss_budgets', 'insert')).toHaveLength(1);
  });

  it('unique constraint của DATABASE là lớp chặn cuối khi hai tab cùng tạo (lỗi 23505)', async () => {
    fake.failNext('ss_budgets', 'insert', { code: '23505', message: 'duplicate key value' });
    await expect(createBudget(U, baseInput)).rejects.toThrow(DuplicateBudgetError);
  });

  it('danh mục phải là danh mục chi tiêu đang hoạt động', async () => {
    await expect(createBudget(U, { ...baseInput, category_id: 'inc' })).rejects.toThrow(/thuộc loại Thu nhập/);
    await expect(createBudget(U, { ...baseInput, category_id: 'off' })).rejects.toThrow(/đã bị tắt/);
    expect(ops('ss_budgets', 'insert')).toHaveLength(0);
  });
});

describe('sửa ngân sách', () => {
  beforeEach(() => {
    fake.db.ss_budgets = [{ id: 'b1', user_id: U, category_id: 'food', period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01', amount: 1000 }];
  });

  it('chỉ cập nhật amount (+ updated_at), không đổi kỳ/ngày/danh mục', async () => {
    await updateBudgetAmount('b1', 2500.5);
    const [call] = ops('ss_budgets', 'update');
    expect(Object.keys(call.payload as object).sort()).toEqual(['amount', 'updated_at']);
    expect(fake.db.ss_budgets[0]).toMatchObject({ amount: 2500.5, period_type: 'monthly', period_start: '2026-10-01', category_id: 'food' });
  });

  it('cho phép sửa về 0, từ chối số âm', async () => {
    await updateBudgetAmount('b1', 0);
    expect(fake.db.ss_budgets[0].amount).toBe(0);
    await expect(updateBudgetAmount('b1', -5)).rejects.toThrow(/không được âm/);
  });

  it('ngân sách không tồn tại / không có quyền (RLS trả 0 dòng) báo lỗi rõ ràng', async () => {
    await expect(updateBudgetAmount('nope', 1)).rejects.toThrow(/Không tìm thấy ngân sách/);
  });

  it('lỗi CHECK của database được dịch sang tiếng Việt', async () => {
    fake.failNext('ss_budgets', 'update', { code: '23514', message: 'check violation' });
    await expect(updateBudgetAmount('b1', 1)).rejects.toMatchObject({ code: '23514' });
    expect(toMutationMessage({ code: '23514' })).toMatch(/ràng buộc/);
  });
});

describe('xóa ngân sách không ảnh hưởng giao dịch', () => {
  beforeEach(() => {
    fake.db.ss_budgets = [{ id: 'b1', user_id: U, category_id: 'food', period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01', amount: 1000 }];
  });

  it('chỉ xóa dòng ss_budgets; chi tiêu và audit log giữ nguyên; frontend không ghi audit log', async () => {
    const expensesBefore = JSON.stringify(fake.db.ss_expenses);
    const auditBefore = JSON.stringify(fake.db.ss_budget_audit_logs);
    await deleteBudget('b1');
    expect(fake.db.ss_budgets).toHaveLength(0);
    expect(JSON.stringify(fake.db.ss_expenses)).toBe(expensesBefore);
    expect(JSON.stringify(fake.db.ss_budget_audit_logs)).toBe(auditBefore);
    expect(fake.calls.map((c) => `${c.table}:${c.op}`)).toEqual(['ss_budgets:delete']);
  });

  it('thực chi vẫn tính được sau khi xóa ngân sách', async () => {
    await deleteBudget('b1');
    expect((await loadBudgetOverview(U, '2026-10-28')).evaluations).toEqual([]);
    // tạo lại ngân sách mới cho cùng kỳ: chi tiêu cũ vẫn được tính nguyên vẹn
    await createBudget(U, { period_type: 'monthly', anchor: '2026-10-05', category_id: 'food', amount: 100 });
    const overview = await loadBudgetOverview(U, '2026-10-28');
    expect(overview.byPeriod.monthly.categories[0].spent).toBe(300);
  });

  it('database từ chối do khóa ngoại (23503): thông báo rõ ràng, không tự sửa gì', async () => {
    fake.failNext('ss_budgets', 'delete', { code: '23503', message: 'violates foreign key constraint' });
    await expect(deleteBudget('b1')).rejects.toThrow(BusinessRuleError);
    expect(fake.db.ss_budgets).toHaveLength(1);
    fake.failNext('ss_budgets', 'delete', { code: '23503', message: 'fk' });
    await deleteBudget('b1').catch((e) => expect(toMutationMessage(e)).toMatch(/lịch sử thay đổi/));
  });

  it('xóa ngân sách không tồn tại / không có quyền báo lỗi', async () => {
    await expect(deleteBudget('nope')).rejects.toThrow(/Không xóa được/);
  });
});

describe('lọc danh sách ngân sách', () => {
  beforeEach(() => {
    fake.db.ss_budgets = [
      { id: 'm-total', user_id: U, category_id: null, period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01', amount: 1 },
      { id: 'm-food', user_id: U, category_id: 'food', period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01', amount: 1 },
      { id: 'w1', user_id: U, category_id: null, period_type: 'weekly', period_start: '2026-10-26', period_end: '2026-11-02', amount: 1 },
      { id: 'd1', user_id: U, category_id: null, period_type: 'daily', period_start: '2026-10-28', period_end: '2026-10-29', amount: 1 },
      { id: 'm-sep', user_id: U, category_id: null, period_type: 'monthly', period_start: '2026-09-01', period_end: '2026-10-01', amount: 1 },
      { id: 'other', user_id: OTHER, category_id: null, period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01', amount: 1 },
    ];
  });
  const ids = async (f: Partial<Parameters<typeof listBudgets>[1]>) =>
    (await listBudgets(U, { periodType: '', scope: '', categoryId: '', ...f })).map((b) => b.id).sort();

  it('theo loại kỳ', async () => {
    expect(await ids({ periodType: 'monthly' })).toEqual(['m-food', 'm-sep', 'm-total']);
    expect(await ids({ periodType: 'weekly' })).toEqual(['w1']);
    expect(await ids({ periodType: 'daily' })).toEqual(['d1']);
  });
  it('theo kỳ cụ thể', async () => {
    expect(await ids({ periodType: 'monthly', start: '2026-10-01' })).toEqual(['m-food', 'm-total']);
  });
  it('tổng / danh mục / một danh mục', async () => {
    expect(await ids({ periodType: 'monthly', scope: 'total' })).toEqual(['m-sep', 'm-total']);
    expect(await ids({ scope: 'category' })).toEqual(['m-food']);
    expect(await ids({ scope: 'category', categoryId: 'food' })).toEqual(['m-food']);
    expect(await ids({ scope: 'category', categoryId: 'taxi' })).toEqual([]);
  });
  it('khoảng thời gian: lấy mọi kỳ giao với [from, to], to tính cả ngày', async () => {
    expect(await ids({ from: '2026-10-28', to: '2026-10-28' })).toEqual(['d1', 'm-food', 'm-total', 'w1']);
    expect(await ids({ from: '2026-09-30', to: '2026-09-30' })).toEqual(['m-sep']);
    expect(await ids({ from: '2026-11-01', to: '2026-11-01' })).toEqual(['w1']); // chỉ tuần giao tháng 11
  });
  it('không bao giờ trả về ngân sách của người dùng khác', async () => {
    expect((await ids({})).includes('other')).toBe(false);
  });
});

describe('tổng quan ngân sách (Dashboard, cảnh báo)', () => {
  it('ngày/tuần/tháng/danh mục tính độc lập từ cùng một khoản chi; tuần giao tháng', async () => {
    fake.db.ss_budgets = [
      { id: 'day', user_id: U, category_id: null, period_type: 'daily', period_start: '2026-10-28', period_end: '2026-10-29', amount: 100 },
      { id: 'week', user_id: U, category_id: null, period_type: 'weekly', period_start: '2026-10-26', period_end: '2026-11-02', amount: 1000 },
      { id: 'month', user_id: U, category_id: null, period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01', amount: 1000 },
      { id: 'food', user_id: U, category_id: 'food', period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01', amount: 250 },
      { id: 'next-month', user_id: U, category_id: null, period_type: 'monthly', period_start: '2026-11-01', period_end: '2026-12-01', amount: 1 },
    ];
    const o = await loadBudgetOverview(U, '2026-10-28');
    expect(o.byPeriod.daily.total?.spent).toBe(100); // chỉ 28/10
    expect(o.byPeriod.weekly.total?.spent).toBe(350); // 26/10 (200) + 28/10 (100) + 01/11 (50)
    expect(o.byPeriod.monthly.total?.spent).toBe(300); // tháng 10: 200 + 100 (01/11 thuộc tháng 11)
    expect(o.byPeriod.monthly.categories[0].spent).toBe(300); // food trong tháng
    expect(o.evaluations.find((e) => e.budget.id === 'next-month')).toBeUndefined(); // không thuộc kỳ hiện tại
    // cảnh báo: ngày 100/100 = exhausted; food 300/250 = category_exceeded
    expect(o.alerts.map((a) => a.kind).sort()).toEqual(['category_exceeded', 'exhausted']);
  });

  it('chưa có ngân sách nào: không có đánh giá và không có cảnh báo', async () => {
    const o = await loadBudgetOverview(U, '2026-10-28');
    expect(o.evaluations).toEqual([]);
    expect(o.alerts).toEqual([]);
    expect(o.byPeriod.monthly.total).toBeNull();
  });

  it('không dùng ngân sách của người dùng khác', async () => {
    fake.db.ss_budgets = [{ id: 'x', user_id: OTHER, category_id: null, period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01', amount: 1 }];
    expect((await loadBudgetOverview(U, '2026-10-28')).evaluations).toEqual([]);
  });
});

describe('lịch sử điều chỉnh (audit logs) - chỉ đọc', () => {
  it('chỉ trả về lịch sử của chính mình, mới nhất trước', async () => {
    const page = await listBudgetAuditLogs(U, { budgetId: '', page: 1 });
    expect(page.rows.map((r) => r.id)).toEqual([2, 1]);
    expect(page.total).toBe(2);
  });
  it('lọc theo ngân sách', async () => {
    expect((await listBudgetAuditLogs(U, { budgetId: 'b-x', page: 1 })).rows).toEqual([]); // log của người khác không lọt ra
  });
  it('không bao giờ ghi vào ss_budget_audit_logs từ frontend', async () => {
    fake.db.ss_budgets = [{ id: 'b1', user_id: U, category_id: null, period_type: 'monthly', period_start: '2026-10-01', period_end: '2026-11-01', amount: 1 }];
    await createBudget(U, { ...baseInput, anchor: '2026-11-05' });
    await updateBudgetAmount('b1', 2);
    await deleteBudget('b1');
    await listBudgetAuditLogs(U, { budgetId: '', page: 1 });
    expect(fake.calls.filter((c) => c.table === 'ss_budget_audit_logs')).toEqual([]);
  });
});
