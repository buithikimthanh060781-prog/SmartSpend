/**
 * KIỂM THỬ TÍCH HỢP BÁO CÁO VỚI SUPABASE THẬT (hai tài khoản test). Cách chạy: xem đầu file two-accounts.integration.ts
 * (cùng biến môi trường SMARTSPEND_TEST_*, và SMARTSPEND_TEST_CONFIRM=yes).
 *
 * Tạo dữ liệu năm 2099 cho tài khoản A, tải lại bằng chính truy vấn của báo cáo rồi so với kết quả tính tay,
 * kiểm tra báo cáo thay đổi khi sửa/xóa, tài khoản B không thấy dữ liệu của A, và file CSV/Excel đúng số liệu.
 * Dữ liệu được đánh dấu [IT-...] và tự xóa khi kết thúc.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const env = process.env;
const url = import.meta.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const A = { email: env.SMARTSPEND_TEST_A_EMAIL, password: env.SMARTSPEND_TEST_A_PASSWORD };
const B = { email: env.SMARTSPEND_TEST_B_EMAIL, password: env.SMARTSPEND_TEST_B_PASSWORD };
const enabled = Boolean(url && anonKey && A.email && A.password && B.email && B.password && env.SMARTSPEND_TEST_CONFIRM === 'yes');

// Các service dùng client singleton của ứng dụng; trong bài kiểm thử này ta thay nó bằng client của từng tài khoản.
const holder: { client: SupabaseClient | null } = { client: null };
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: new Proxy({}, { get: (_t, prop) => (holder.client as unknown as Record<string, unknown>)[prop as string] }),
}));

import { buildCsv } from '@/export/csv';
import { categoriesSheet, categoryNamer, expensesSheet, incomesSheet } from '@/export/datasets';
import { buildCategoryReport } from '@/reports/categories';
import { buildPlanReport } from '@/reports/plans';
import { resolvePreset } from '@/reports/ranges';
import { buildSeries } from '@/reports/series';
import { buildFinancialSummary } from '@/reports/summary';
import { fetchPeriodData, fetchPlanData } from '@/services/reports';

const RUN = `IT-${Date.now().toString(36)}`;
const TAG = `[${RUN}]`;
const RANGE = resolvePreset('custom', '2099-12-31', { from: '2099-03-01', to: '2099-03-31' })!;
const TODAY = '2099-12-31';

async function login(creds: { email?: string; password?: string }) {
  const client = createClient(url as string, anonKey as string, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: creds.email as string, password: creds.password as string });
  if (error || !data.user) throw new Error(`Đăng nhập thất bại: ${error?.message}`);
  return { client, userId: data.user.id };
}

describe.skipIf(!enabled)('Báo cáo trên Supabase thật', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aId = '';
  let incomeCat = '';
  let foodCat = '';
  let planId = '';
  let removable = '';

  beforeAll(async () => {
    ({ client: a, userId: aId } = await login(A));
    ({ client: b } = await login(B));
    await a.rpc('ss_initialize_account');
    const mk = async (name: string, type: string) => (await a.from('ss_categories').insert({ user_id: aId, name: `${TAG} ${name}`, type, is_active: true, is_default: false }).select('id').single()).data?.id as string;
    incomeCat = await mk('thu', 'income');
    foodCat = await mk('ăn', 'expense');
    const plan = await a.from('ss_expense_plans').insert({ user_id: aId, category_id: foodCat, title: `${TAG} kế hoạch`, planned_date: '2099-03-15', planned_amount: 1000000, status: 'in_progress' }).select('id').single();
    planId = plan.data?.id as string;

    const inc = (date: string, amount: number, status: string, description: string) => ({ user_id: aId, category_id: incomeCat, amount, income_date: date, status, description: `${TAG} ${description}` });
    await a.from('ss_incomes').insert([inc('2099-03-01', 20_000_000, 'received', 'lương'), inc('2099-03-05', 500_000.5, 'received', '=HYPERLINK("x")'), inc('2099-03-06', 9_999_999, 'expected', 'dự kiến'), inc('2099-04-01', 777, 'received', 'tháng sau')]);
    const ex = (date: string, amount: number, plan_id: string | null, description: string) => ({ user_id: aId, category_id: foodCat, plan_id, amount, expense_date: date, payment_method: 'cash', description: `${TAG} ${description}` });
    const r = await a.from('ss_expenses').insert([ex('2099-03-02', 1_000_000, null, 'ngoài kế hoạch'), ex('2099-03-10', 600_000.25, planId, 'trong kế hoạch'), ex('2099-03-11', 400_000, planId, 'trong kế hoạch 2'), ex('2099-02-28', 5, null, 'tháng trước')]).select('id, description');
    removable = (r.data ?? []).find((x) => String(x.description).endsWith('ngoài kế hoạch'))?.id as string;
  });

  afterAll(async () => {
    holder.client = a;
    for (const c of [a, b].filter(Boolean)) {
      await c.from('ss_expenses').delete().like('description', `${TAG}%`);
      await c.from('ss_expense_plans').delete().like('title', `${TAG}%`);
      await c.from('ss_incomes').delete().like('description', `${TAG}%`);
      await c.from('ss_categories').delete().like('name', `${TAG}%`);
    }
  });

  const load = async (client: SupabaseClient) => {
    holder.client = client;
    return fetchPeriodData((await client.auth.getUser()).data.user!.id, { start: '2099-02-01', endExclusive: '2099-05-01' });
  };

  it('báo cáo tổng quan từ dữ liệu thật khớp số tính tay', async () => {
    const { incomes, expenses } = await load(a);
    const s = buildFinancialSummary(incomes.filter((i) => String(i.description).startsWith(TAG)), expenses.filter((e) => String(e.description).startsWith(TAG)), RANGE, TODAY);
    expect(s.receivedIncome).toBe(20_500_000.5); // chỉ received trong tháng 3
    expect(s.expectedIncome).toBe(9_999_999); // expected không tính vào thực nhận
    expect(s.actualExpense).toBe(2_000_000.25);
    expect(s.plannedExpense).toBe(1_000_000.25);
    expect(s.unplannedExpense).toBe(1_000_000);
    expect(s.netCashFlow).toBe(18_500_000.25);
    expect(s.daysWithExpense).toBe(3);
  });

  it('chuỗi theo ngày đủ 31 mốc tháng 3 và khớp tổng', async () => {
    const { incomes, expenses } = await load(a);
    const mine = { i: incomes.filter((i) => String(i.description).startsWith(TAG)), e: expenses.filter((e) => String(e.description).startsWith(TAG)) };
    const series = buildSeries(mine.i, mine.e, RANGE, 'day');
    expect(series).toHaveLength(31);
    expect(series.reduce((s, x) => s + Math.round(x.expense * 100), 0)).toBe(200_000_025);
  });

  it('báo cáo kế hoạch: thực chi chỉ gồm giao dịch liên kết, không gồm planned_amount', async () => {
    holder.client = a;
    const { plans, linked } = await fetchPlanData(aId, RANGE);
    const mine = plans.filter((p) => p.title.startsWith(TAG));
    const report = buildPlanReport(mine, linked.filter((l) => l.plan_id === planId));
    expect(report.actualLinked).toBe(1_000_000.25);
    expect(report.plannedAmount).toBe(1_000_000);
    expect(report.overrunCount).toBe(1); // 1.000.000,25 > 1.000.000
  });

  it('báo cáo thay đổi khi sửa và xóa giao dịch', async () => {
    holder.client = a;
    await a.from('ss_expenses').update({ amount: 1_500_000 }).eq('id', removable);
    let { expenses } = await load(a);
    expect(buildFinancialSummary([], expenses.filter((e) => String(e.description).startsWith(TAG)), RANGE, TODAY).actualExpense).toBe(2_500_000.25);
    await a.from('ss_expenses').delete().eq('id', removable);
    ({ expenses } = await load(a));
    expect(buildFinancialSummary([], expenses.filter((e) => String(e.description).startsWith(TAG)), RANGE, TODAY).actualExpense).toBe(1_000_000.25);
  });

  it('tài khoản B không thấy dữ liệu của A trong báo cáo', async () => {
    const { incomes, expenses } = await load(b);
    expect(incomes.filter((i) => String(i.description).startsWith(TAG))).toEqual([]);
    expect(expenses.filter((e) => String(e.description).startsWith(TAG))).toEqual([]);
  });

  it('CSV xuất đúng dữ liệu và an toàn trước formula injection', async () => {
    const { incomes, expenses } = await load(a);
    const mineI = incomes.filter((i) => String(i.description).startsWith(TAG) && i.income_date >= '2099-03-01' && i.income_date < '2099-04-01');
    const cats = [{ id: incomeCat, name: 'Thu' }, { id: foodCat, name: 'Ăn' }];
    const sheet = incomesSheet(mineI, categoryNamer(cats), 'x');
    const csv = buildCsv(sheet.columns, sheet.rows, sheet.totals);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/,=HYPERLINK/);
    expect(csv).toContain('20500000.5'); // tổng thực nhận
    const exSheet = expensesSheet(expenses.filter((e) => String(e.description).startsWith(TAG)), categoryNamer(cats), 'x');
    expect(buildCsv(exSheet.columns, exSheet.rows, exSheet.totals).split('\r\n').length).toBeGreaterThan(3);
    const catSheet = categoriesSheet(buildCategoryReport(expenses.filter((e) => String(e.description).startsWith(TAG)), [{ id: foodCat, name: 'Ăn', is_active: true, color: null, icon: null }]), 'x', false);
    expect(catSheet.rows[0].count).toBeGreaterThan(0);
  });
});

describe.skipIf(enabled)('Báo cáo tích hợp (BỊ BỎ QUA)', () => {
  it('thiếu biến môi trường SMARTSPEND_TEST_* hoặc SMARTSPEND_TEST_CONFIRM=yes: chưa chạy kiểm thử thực tế', () => {
    expect(enabled).toBe(false);
  });
});
