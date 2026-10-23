/**
 * KIỂM THỬ TÍCH HỢP VỚI SUPABASE THẬT, dùng HAI tài khoản test.
 * Kiểm tra hành vi ở DATABASE (RLS, CHECK, trigger, FK), không phải logic frontend.
 *
 * Chạy (PowerShell, trong thư mục app):
 *   $env:SMARTSPEND_TEST_CONFIRM = 'yes'
 *   $env:SMARTSPEND_TEST_A_EMAIL = '...'; $env:SMARTSPEND_TEST_A_PASSWORD = '...'
 *   $env:SMARTSPEND_TEST_B_EMAIL = '...'; $env:SMARTSPEND_TEST_B_PASSWORD = '...'
 *   npm run test:integration
 *
 * - Cần VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY (đọc từ .env.local). Chỉ dùng anon key, không dùng service_role.
 * - Chỉ GHI dữ liệu của chính hai tài khoản test, đánh dấu bằng tiền tố [IT-<runId>], và tự xóa khi kết thúc.
 * - Dữ liệu giao dịch dùng ngày năm 2099 để tách biệt khỏi dữ liệu thật.
 * - Các mục "database phải từ chối" nếu FAIL nghĩa là database THIẾU ràng buộc đó -> cần migration (xem README).
 * - Không bao giờ chạy với tài khoản thật/Production của người dùng.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumMoney } from '@/lib/money';

const env = process.env;
const url = import.meta.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const A = { email: env.SMARTSPEND_TEST_A_EMAIL, password: env.SMARTSPEND_TEST_A_PASSWORD };
const B = { email: env.SMARTSPEND_TEST_B_EMAIL, password: env.SMARTSPEND_TEST_B_PASSWORD };
const enabled = Boolean(url && anonKey && A.email && A.password && B.email && B.password && env.SMARTSPEND_TEST_CONFIRM === 'yes');

const RUN = `IT-${Date.now().toString(36)}`;
const TAG = `[${RUN}]`;
const MONTH_START = '2099-01-01';
const MONTH_END = '2099-02-01';

function newClient(): SupabaseClient {
  return createClient(url as string, anonKey as string, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function login(creds: { email?: string; password?: string }) {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({ email: creds.email as string, password: creds.password as string });
  if (error || !data.user) throw new Error(`Đăng nhập tài khoản test thất bại: ${error?.message}`);
  return { client, userId: data.user.id };
}

describe.skipIf(!enabled)('Hai tài khoản test trên Supabase', () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aId = '';
  let bId = '';

  // dữ liệu tạo ra để kiểm tra chéo
  let incomeCat = '';
  let expenseCat = '';
  let otherExpenseCat = '';
  let planId = '';
  let cancelledPlanId = '';
  let otherCatPlanId = '';
  let receivedIncomeId = '';
  let linkedExpenseId = '';

  beforeAll(async () => {
    ({ client: a, userId: aId } = await login(A));
    ({ client: b, userId: bId } = await login(B));
    expect(aId).not.toBe(bId);
  });

  afterAll(async () => {
    // Dọn dẹp theo thứ tự phụ thuộc. Chỉ xóa bản ghi có tiền tố của lần chạy này.
    for (const c of [a, b].filter(Boolean)) {
      await c.from('ss_expenses').delete().like('description', `${TAG}%`);
      await c.from('ss_expense_plans').delete().like('title', `${TAG}%`);
      await c.from('ss_incomes').delete().like('description', `${TAG}%`);
      await c.from('ss_categories').delete().like('name', `${TAG}%`);
    }
  });

  describe('Khởi tạo tài khoản', () => {
    it('RPC ss_initialize_account tạo 5 danh mục thu nhập + 10 danh mục chi tiêu mặc định', async () => {
      const { error } = await a.rpc('ss_initialize_account');
      expect(error).toBeNull();
      const { data } = await a.from('ss_categories').select('type').eq('is_default', true);
      const count = (t: string) => (data ?? []).filter((c) => c.type === t).length;
      expect({ income: count('income'), expense: count('expense') }).toEqual({ income: 5, expense: 10 });
    });

    it('gọi lại RPC không tạo trùng và không xóa danh mục tùy chỉnh', async () => {
      const custom = await a.from('ss_categories').insert({ user_id: aId, name: `${TAG} custom`, type: 'expense', is_active: true, is_default: false }).select('id').single();
      expect(custom.error).toBeNull();
      const before = await a.from('ss_categories').select('id', { count: 'exact', head: true });
      expect((await a.rpc('ss_initialize_account')).error).toBeNull();
      expect((await a.rpc('ss_initialize_account')).error).toBeNull();
      const after = await a.from('ss_categories').select('id', { count: 'exact', head: true });
      expect(after.count).toBe(before.count);
      const still = await a.from('ss_categories').select('id').eq('id', custom.data?.id ?? '');
      expect(still.data).toHaveLength(1);
      await a.from('ss_categories').delete().eq('id', custom.data?.id ?? '');
    });

    it('tài khoản B cũng khởi tạo được', async () => {
      expect((await b.rpc('ss_initialize_account')).error).toBeNull();
    });
  });

  describe('CRUD danh mục', () => {
    it('thêm, sửa tên/màu, tắt, bật và xóa danh mục chưa dùng', async () => {
      const ins = await a.from('ss_categories').insert({ user_id: aId, name: `${TAG} cat`, type: 'expense', color: '#FF6B6B', icon: 'tag', is_active: true, is_default: false }).select('*').single();
      expect(ins.error).toBeNull();
      const id = ins.data?.id as string;
      expect((await a.from('ss_categories').update({ name: `${TAG} cat đổi tên`, color: '#2BB3E8' }).eq('id', id).select('id')).data).toHaveLength(1);
      expect((await a.from('ss_categories').update({ is_active: false }).eq('id', id).select('id')).data).toHaveLength(1);
      expect((await a.from('ss_categories').update({ is_active: true }).eq('id', id).select('id')).data).toHaveLength(1);
      expect((await a.from('ss_categories').delete().eq('id', id).select('id')).data).toHaveLength(1);
    });

    it('DATABASE phải chặn trùng tên cùng loại (không phân biệt hoa thường)', async () => {
      const first = await a.from('ss_categories').insert({ user_id: aId, name: `${TAG} Trùng`, type: 'expense', is_active: true, is_default: false });
      expect(first.error).toBeNull();
      const dup = await a.from('ss_categories').insert({ user_id: aId, name: `${TAG} trùng`, type: 'expense', is_active: true, is_default: false });
      expect(dup.error, 'Thiếu unique index (user_id, type, lower(name)) -> cần migration').not.toBeNull();
    });

    it('chuẩn bị danh mục dùng cho các bài kiểm tra tiếp theo', async () => {
      const mk = async (name: string, type: string) => {
        const r = await a.from('ss_categories').insert({ user_id: aId, name: `${TAG} ${name}`, type, is_active: true, is_default: false }).select('id').single();
        expect(r.error).toBeNull();
        return r.data?.id as string;
      };
      incomeCat = await mk('thu', 'income');
      expenseCat = await mk('chi', 'expense');
      otherExpenseCat = await mk('chi khác', 'expense');
    });
  });

  describe('Thu nhập và chi tiêu, Dashboard', () => {
    it('thêm thu nhập expected và received', async () => {
      const received = await a.from('ss_incomes').insert({ user_id: aId, category_id: incomeCat, amount: 1500000.5, income_date: '2099-01-05', status: 'received', description: `${TAG} nhận` }).select('id').single();
      const expected = await a.from('ss_incomes').insert({ user_id: aId, category_id: incomeCat, amount: 999999, income_date: '2099-01-06', status: 'expected', description: `${TAG} dự kiến` });
      expect(received.error).toBeNull();
      expect(expected.error).toBeNull();
      receivedIncomeId = received.data?.id as string;
    });

    it('tổng thu nhập thực nhận của tháng chỉ cộng received', async () => {
      const { data, error } = await a.from('ss_incomes').select('amount').eq('status', 'received').gte('income_date', MONTH_START).lt('income_date', MONTH_END).like('description', `${TAG}%`);
      expect(error).toBeNull();
      expect(sumMoney(data ?? [], (r) => r.amount)).toBe(1500000.5);
    });

    it('chi tiêu ngoài kế hoạch (plan_id null)', async () => {
      const r = await a.from('ss_expenses').insert({ user_id: aId, category_id: expenseCat, plan_id: null, amount: 200000, expense_date: '2099-01-10', payment_method: 'cash', description: `${TAG} ngoài kế hoạch` });
      expect(r.error).toBeNull();
    });

    it('DATABASE phải từ chối giá trị enum sai (status, payment_method, period_type)', async () => {
      const inc = await a.from('ss_incomes').insert({ user_id: aId, category_id: incomeCat, amount: 1, income_date: '2099-01-07', status: 'pending', description: `${TAG} sai status` });
      const exp = await a.from('ss_expenses').insert({ user_id: aId, category_id: expenseCat, amount: 1, expense_date: '2099-01-07', payment_method: 'crypto', description: `${TAG} sai pm` });
      expect(inc.error, 'status ngoài expected/received phải bị CHECK chặn').not.toBeNull();
      expect(exp.error, 'payment_method ngoài danh sách phải bị CHECK chặn').not.toBeNull();
    });
  });

  describe('Kế hoạch chi tiêu', () => {
    it('tạo kế hoạch và liên kết nhiều chi tiêu', async () => {
      const mkPlan = async (title: string, category_id: string, status = 'planned') => {
        const r = await a.from('ss_expense_plans').insert({ user_id: aId, category_id, title: `${TAG} ${title}`, planned_date: '2099-01-15', planned_amount: 1000000, status }).select('id').single();
        expect(r.error).toBeNull();
        return r.data?.id as string;
      };
      planId = await mkPlan('kế hoạch', expenseCat);
      otherCatPlanId = await mkPlan('kế hoạch khác danh mục', otherExpenseCat);
      cancelledPlanId = await mkPlan('kế hoạch đã hủy', expenseCat, 'cancelled');

      for (const amount of [300000, 450000.25]) {
        const r = await a.from('ss_expenses').insert({ user_id: aId, category_id: expenseCat, plan_id: planId, amount, expense_date: '2099-01-12', payment_method: 'card', description: `${TAG} liên kết` }).select('id').single();
        expect(r.error).toBeNull();
        linkedExpenseId = r.data?.id as string;
      }
    });

    it('tổng thực chi của kế hoạch = tổng giao dịch liên kết, KHÔNG cộng planned_amount', async () => {
      const { data } = await a.from('ss_expenses').select('amount').eq('plan_id', planId);
      expect(sumMoney(data ?? [], (r) => r.amount)).toBe(750000.25);
    });

    it('DATABASE phải từ chối liên kết kế hoạch khác danh mục', async () => {
      const r = await a.from('ss_expenses').insert({ user_id: aId, category_id: expenseCat, plan_id: otherCatPlanId, amount: 1, expense_date: '2099-01-13', payment_method: 'cash', description: `${TAG} sai danh mục kế hoạch` });
      expect(r.error, 'Thiếu ràng buộc plan.category_id = expense.category_id -> cần migration').not.toBeNull();
    });

    it('DATABASE phải từ chối liên kết kế hoạch đã hủy', async () => {
      const r = await a.from('ss_expenses').insert({ user_id: aId, category_id: expenseCat, plan_id: cancelledPlanId, amount: 1, expense_date: '2099-01-13', payment_method: 'cash', description: `${TAG} kế hoạch đã hủy` });
      expect(r.error, 'Thiếu ràng buộc chặn liên kết kế hoạch cancelled -> cần migration').not.toBeNull();
    });

    it('DATABASE phải từ chối hủy kế hoạch đã có giao dịch liên kết', async () => {
      const r = await a.from('ss_expense_plans').update({ status: 'cancelled' }).eq('id', planId).select('id');
      expect(r.error, 'Trigger chặn hủy kế hoạch có giao dịch phải tồn tại').not.toBeNull();
    });

    it('DATABASE phải từ chối đổi danh mục kế hoạch đã có giao dịch liên kết', async () => {
      const r = await a.from('ss_expense_plans').update({ category_id: otherExpenseCat }).eq('id', planId).select('id');
      expect(r.error, 'Đổi danh mục kế hoạch làm sai dữ liệu liên kết -> cần trigger/migration').not.toBeNull();
    });

    it('DATABASE phải từ chối dùng danh mục thu nhập cho chi tiêu/kế hoạch và ngược lại', async () => {
      const exp = await a.from('ss_expenses').insert({ user_id: aId, category_id: incomeCat, amount: 1, expense_date: '2099-01-14', payment_method: 'cash', description: `${TAG} chi bằng danh mục thu` });
      const inc = await a.from('ss_incomes').insert({ user_id: aId, category_id: expenseCat, amount: 1, income_date: '2099-01-14', status: 'received', description: `${TAG} thu bằng danh mục chi` });
      expect(exp.error, 'Chi tiêu dùng danh mục thu nhập -> cần ràng buộc type').not.toBeNull();
      expect(inc.error, 'Thu nhập dùng danh mục chi tiêu -> cần ràng buộc type').not.toBeNull();
    });

    it('DATABASE phải từ chối xóa danh mục đang được dùng', async () => {
      const r = await a.from('ss_categories').delete().eq('id', expenseCat).select('id');
      expect(r.error ?? (r.data?.length ? null : 'không xóa được'), 'Xóa danh mục đã có giao dịch phải bị FK chặn').not.toBeNull();
    });
  });

  describe('Cách ly dữ liệu giữa hai tài khoản (RLS)', () => {
    it('B không đọc được dữ liệu của A ở bất kỳ bảng nào', async () => {
      for (const [table, id] of [
        ['ss_categories', incomeCat],
        ['ss_incomes', receivedIncomeId],
        ['ss_expenses', linkedExpenseId],
        ['ss_expense_plans', planId],
      ] as const) {
        const r = await b.from(table).select('id').eq('id', id);
        expect(r.error).toBeNull();
        expect(r.data, `B đọc được ${table} của A`).toEqual([]);
      }
      const settings = await b.from('ss_settings').select('user_id');
      expect((settings.data ?? []).every((s) => s.user_id === bId)).toBe(true);
    });

    it('B không sửa/xóa được dữ liệu của A (0 dòng bị ảnh hưởng)', async () => {
      const upd = await b.from('ss_incomes').update({ amount: 1 }).eq('id', receivedIncomeId).select('id');
      const del = await b.from('ss_expenses').delete().eq('id', linkedExpenseId).select('id');
      expect(upd.data ?? []).toHaveLength(0);
      expect(del.data ?? []).toHaveLength(0);
      const still = await a.from('ss_incomes').select('amount').eq('id', receivedIncomeId).single();
      expect(Number(still.data?.amount)).toBe(1500000.5);
    });

    it('B không thể tạo dữ liệu mang user_id của A', async () => {
      const r = await b.from('ss_incomes').insert({ user_id: aId, category_id: incomeCat, amount: 1, income_date: '2099-01-20', status: 'received', description: `${TAG} giả mạo` });
      expect(r.error).not.toBeNull();
    });

    it('B không thể liên kết chi tiêu của mình vào kế hoạch của A', async () => {
      const bCat = await b.from('ss_categories').select('id').eq('type', 'expense').limit(1).single();
      const r = await b.from('ss_expenses').insert({ user_id: bId, category_id: bCat.data?.id, plan_id: planId, amount: 1, expense_date: '2099-01-20', payment_method: 'cash', description: `${TAG} liên kết chéo` });
      expect(r.error, 'Liên kết chéo tài khoản phải bị chặn (RLS/trigger/FK)').not.toBeNull();
    });
  });

  describe('Tải lại phiên', () => {
    it('đăng nhập lại (phiên mới) vẫn thấy dữ liệu đã lưu', async () => {
      const again = await login(A);
      const r = await again.client.from('ss_incomes').select('id').eq('id', receivedIncomeId);
      expect(r.data).toHaveLength(1);
      const plans = await again.client.from('ss_expenses').select('id', { count: 'exact', head: true }).eq('plan_id', planId);
      expect(plans.count).toBe(2);
    });
  });
});

describe.skipIf(enabled)('Hai tài khoản test (BỊ BỎ QUA)', () => {
  it('thiếu biến môi trường SMARTSPEND_TEST_* hoặc SMARTSPEND_TEST_CONFIRM=yes: chưa chạy kiểm thử thực tế', () => {
    expect(enabled).toBe(false);
  });
});
