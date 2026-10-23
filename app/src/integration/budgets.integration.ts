/**
 * KIỂM THỬ TÍCH HỢP NGÂN SÁCH VỚI SUPABASE THẬT (hai tài khoản test). Cách chạy: xem đầu file two-accounts.integration.ts
 * (cùng các biến môi trường SMARTSPEND_TEST_*, và SMARTSPEND_TEST_CONFIRM=yes).
 *
 * Kiểm tra hành vi ở DATABASE: CHECK constraint của ss_budgets, UNIQUE chống trùng, trigger ghi audit log, RLS.
 * Các mục "DATABASE phải ..." nếu FAIL nghĩa là database thiếu ràng buộc/trigger đó -> xem database/proposed/.
 *
 * Lưu ý: audit log do database ghi và frontend KHÔNG được xóa, nên các dòng audit của hai tài khoản test sẽ còn lại.
 * Ngân sách tạo ra dùng năm 2099 và được xóa khi kết thúc.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const env = process.env;
const url = import.meta.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const A = { email: env.SMARTSPEND_TEST_A_EMAIL, password: env.SMARTSPEND_TEST_A_PASSWORD };
const B = { email: env.SMARTSPEND_TEST_B_EMAIL, password: env.SMARTSPEND_TEST_B_PASSWORD };
const enabled = Boolean(url && anonKey && A.email && A.password && B.email && B.password && env.SMARTSPEND_TEST_CONFIRM === 'yes');

async function login(creds: { email?: string; password?: string }) {
  const client = createClient(url as string, anonKey as string, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: creds.email as string, password: creds.password as string });
  if (error || !data.user) throw new Error(`Đăng nhập tài khoản test thất bại: ${error?.message}`);
  return { client, userId: data.user.id };
}

describe.skipIf(!enabled)('Ngân sách trên Supabase thật', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aId = '';
  let bId = '';
  let foodCat = '';
  const created: string[] = [];

  const row = (over: Record<string, unknown>) => ({
    user_id: aId,
    category_id: null,
    period_type: 'monthly',
    period_start: '2099-01-01',
    period_end: '2099-02-01',
    amount: 1000,
    ...over,
  });

  async function insertBudget(client: SupabaseClient, r: Record<string, unknown>) {
    const res = await client.from('ss_budgets').insert(r).select('id').single();
    if (res.data?.id) created.push(res.data.id as string);
    return res;
  }

  beforeAll(async () => {
    ({ client: a, userId: aId } = await login(A));
    ({ client: b, userId: bId } = await login(B));
    await a.rpc('ss_initialize_account');
    const cat = await a.from('ss_categories').select('id').eq('type', 'expense').eq('is_active', true).limit(1).single();
    foodCat = cat.data?.id as string;
  });

  afterAll(async () => {
    for (const id of created) await a.from('ss_budgets').delete().eq('id', id);
    for (const id of created) await b.from('ss_budgets').delete().eq('id', id);
  });

  describe('CHECK constraint', () => {
    it('chấp nhận ngân sách tháng/tuần/ngày hợp lệ và hạn mức 0', async () => {
      expect((await insertBudget(a, row({ period_start: '2099-01-01', period_end: '2099-02-01', amount: 0 }))).error).toBeNull();
      expect((await insertBudget(a, row({ period_type: 'weekly', period_start: '2099-01-05', period_end: '2099-01-12' }))).error).toBeNull(); // 2099-01-05 là Thứ Hai
      expect((await insertBudget(a, row({ period_type: 'daily', period_start: '2099-01-07', period_end: '2099-01-08' }))).error).toBeNull();
    });

    it('DATABASE từ chối dữ liệu sai quy tắc kỳ, enum và số âm', async () => {
      const bad: Array<[string, Record<string, unknown>]> = [
        ['số âm', { amount: -1, period_start: '2099-03-01', period_end: '2099-04-01' }],
        ['period_type month (cũ)', { period_type: 'month', period_start: '2099-03-01', period_end: '2099-04-01' }],
        ['monthly không bắt đầu ngày 01', { period_start: '2099-03-02', period_end: '2099-04-02' }],
        ['monthly end kiểu bao gồm (ngày cuối tháng)', { period_start: '2099-03-01', period_end: '2099-03-31' }],
        ['weekly không bắt đầu Thứ Hai', { period_type: 'weekly', period_start: '2099-03-03', period_end: '2099-03-10' }],
        ['weekly end sai', { period_type: 'weekly', period_start: '2099-03-02', period_end: '2099-03-08' }],
        ['daily end +2 ngày', { period_type: 'daily', period_start: '2099-03-03', period_end: '2099-03-05' }],
      ];
      for (const [name, over] of bad) {
        const r = await insertBudget(a, row(over));
        expect(r.error, `CHECK phải chặn: ${name}`).not.toBeNull();
      }
    });
  });

  describe('Chống trùng ở database', () => {
    it('DATABASE phải chặn trùng ngân sách tổng (category_id null) cùng loại kỳ và ngày bắt đầu', async () => {
      const first = await insertBudget(a, row({ period_start: '2099-05-01', period_end: '2099-06-01' }));
      expect(first.error).toBeNull();
      const dup = await insertBudget(a, row({ period_start: '2099-05-01', period_end: '2099-06-01', amount: 5 }));
      expect(dup.error, 'Thiếu unique cho ngân sách tổng (NULL category) -> cần migration').not.toBeNull();
    });

    it('DATABASE phải chặn trùng ngân sách danh mục, nhưng cho phép danh mục khác/tổng cùng kỳ', async () => {
      const first = await insertBudget(a, row({ period_start: '2099-06-01', period_end: '2099-07-01', category_id: foodCat }));
      expect(first.error).toBeNull();
      const dup = await insertBudget(a, row({ period_start: '2099-06-01', period_end: '2099-07-01', category_id: foodCat }));
      expect(dup.error, 'Thiếu unique (user_id, period_type, period_start, category_id) -> cần migration').not.toBeNull();
      const total = await insertBudget(a, row({ period_start: '2099-06-01', period_end: '2099-07-01' }));
      expect(total.error, 'Ngân sách tổng khác phạm vi với ngân sách danh mục, không được coi là trùng').toBeNull();
    });

    it('người dùng B có thể tạo ngân sách cùng kỳ với A (unique theo user)', async () => {
      const r = await insertBudget(b, row({ user_id: bId, period_start: '2099-06-01', period_end: '2099-07-01' }));
      expect(r.error).toBeNull();
    });
  });

  describe('Lịch sử điều chỉnh (audit log)', () => {
    let budgetId = '';

    it('DATABASE phải tự ghi audit log khi tạo và khi sửa hạn mức (trigger)', async () => {
      const ins = await insertBudget(a, row({ period_start: '2099-08-01', period_end: '2099-09-01', amount: 1000 }));
      expect(ins.error).toBeNull();
      budgetId = ins.data?.id as string;
      expect((await a.from('ss_budgets').update({ amount: 1500 }).eq('id', budgetId).select('id')).data).toHaveLength(1);

      const logs = await a.from('ss_budget_audit_logs').select('*').eq('budget_id', budgetId).order('id');
      expect(logs.error).toBeNull();
      expect((logs.data ?? []).length, 'Thiếu trigger ghi audit log -> cần migration (database/proposed)').toBeGreaterThanOrEqual(1);
      const update = (logs.data ?? []).find((l) => Number(l.new_amount) === 1500);
      expect(update, 'Phải có bản ghi với new_amount = 1500').toBeDefined();
      expect(Number(update?.old_amount)).toBe(1000);
      expect(update?.user_id).toBe(aId);
    });

    it('người dùng B không thấy lịch sử của A', async () => {
      const r = await b.from('ss_budget_audit_logs').select('id').eq('budget_id', budgetId);
      expect(r.error).toBeNull();
      expect(r.data).toEqual([]);
    });

    it('frontend KHÔNG được ghi/sửa/xóa audit log (RLS phải chặn)', async () => {
      const ins = await a.from('ss_budget_audit_logs').insert({ user_id: aId, budget_id: budgetId, action: 'FORGED', old_amount: 1, new_amount: 2 });
      expect(ins.error, 'authenticated không được INSERT audit log').not.toBeNull();
      const upd = await a.from('ss_budget_audit_logs').update({ new_amount: 999 }).eq('budget_id', budgetId).select('id');
      expect(upd.error ?? (upd.data?.length ? 'đã sửa được' : null), 'authenticated không được UPDATE audit log').toBeNull();
      expect(upd.data ?? []).toHaveLength(0);
      const del = await a.from('ss_budget_audit_logs').delete().eq('budget_id', budgetId).select('id');
      expect(del.data ?? []).toHaveLength(0);
    });
  });

  describe('Xóa ngân sách', () => {
    it('xóa ngân sách không làm mất giao dịch chi tiêu', async () => {
      const exp = await a.from('ss_expenses').insert({ user_id: aId, category_id: foodCat, plan_id: null, amount: 123, expense_date: '2099-10-05', payment_method: 'cash', description: '[IT-budget] chi' }).select('id').single();
      expect(exp.error).toBeNull();
      const bud = await insertBudget(a, row({ period_start: '2099-10-01', period_end: '2099-11-01', category_id: foodCat }));
      expect(bud.error).toBeNull();

      const del = await a.from('ss_budgets').delete().eq('id', bud.data?.id as string).select('id');
      // Nếu FK từ audit log chặn xóa, đây là thông tin cần biết (không tự sửa FK): ghi rõ thay vì ẩn.
      expect(del.error, `Database từ chối xóa ngân sách: ${del.error?.message}`).toBeNull();
      expect(del.data).toHaveLength(1);

      const still = await a.from('ss_expenses').select('id').eq('id', exp.data?.id as string);
      expect(still.data).toHaveLength(1);
      await a.from('ss_expenses').delete().eq('id', exp.data?.id as string);
    });
  });

  describe('Cách ly dữ liệu (RLS)', () => {
    it('B không đọc, sửa, xóa được ngân sách của A', async () => {
      const own = await insertBudget(a, row({ period_start: '2099-11-01', period_end: '2099-12-01' }));
      const id = own.data?.id as string;
      expect((await b.from('ss_budgets').select('id').eq('id', id)).data).toEqual([]);
      expect((await b.from('ss_budgets').update({ amount: 1 }).eq('id', id).select('id')).data ?? []).toHaveLength(0);
      expect((await b.from('ss_budgets').delete().eq('id', id).select('id')).data ?? []).toHaveLength(0);
      const stillThere = await a.from('ss_budgets').select('amount').eq('id', id).single();
      expect(Number(stillThere.data?.amount)).toBe(1000);
    });

    it('B không tạo được ngân sách mang user_id của A', async () => {
      const r = await insertBudget(b, row({ user_id: aId, period_start: '2099-12-01', period_end: '2100-01-01' }));
      expect(r.error).not.toBeNull();
    });
  });
});

describe.skipIf(enabled)('Ngân sách tích hợp (BỊ BỎ QUA)', () => {
  it('thiếu biến môi trường SMARTSPEND_TEST_* hoặc SMARTSPEND_TEST_CONFIRM=yes: chưa chạy kiểm thử thực tế', () => {
    expect(enabled).toBe(false);
  });
});
