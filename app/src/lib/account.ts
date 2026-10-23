import { supabase } from '@/lib/supabase';

/** Số danh mục mặc định mà ss_initialize_account() phải tạo (5 thu nhập + 10 chi tiêu). */
export const EXPECTED_DEFAULT_CATEGORIES = 15;

export type InitStep = 'rpc' | 'settings' | 'categories';

/** Lỗi khởi tạo có ghi rõ bước nào thất bại, để hiển thị đúng nguyên nhân thay vì thông báo chung chung. */
export class AccountInitError extends Error {
  constructor(
    public readonly step: InitStep,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AccountInitError';
  }
}

const STEP_LABEL: Record<InitStep, string> = {
  rpc: 'gọi hàm ss_initialize_account()',
  settings: 'đọc ss_settings',
  categories: 'đọc ss_categories',
};

/**
 * Khởi tạo tài khoản Smart Spend cho người dùng đang đăng nhập.
 * RPC ss_initialize_account() dùng auth.uid() và được thiết kế idempotent. Hàm này chỉ được gọi
 * từ AccountGate (một lần cho mỗi phiên/người dùng), KHÔNG gọi trong lúc render.
 * Sau RPC, kiểm tra lại ss_settings và ss_categories qua RLS. Trả về true khi thành công.
 */
export async function initializeAccount(): Promise<true> {
  const { error: rpcError } = await supabase.rpc('ss_initialize_account');
  if (rpcError) throw wrap('rpc', rpcError);

  const settings = await supabase.from('ss_settings').select('user_id').maybeSingle();
  if (settings.error) throw wrap('settings', settings.error);
  if (!settings.data) {
    throw new AccountInitError('settings', 'RPC chạy xong nhưng không đọc được dòng ss_settings của bạn (có thể RPC không tạo, hoặc RLS chặn đọc).');
  }

  const categories = await supabase.from('ss_categories').select('id', { count: 'exact', head: true });
  if (categories.error) throw wrap('categories', categories.error);
  if (!categories.count) {
    throw new AccountInitError('categories', 'RPC chạy xong nhưng không đọc được danh mục nào trong ss_categories (có thể RPC không tạo, hoặc RLS chặn đọc).');
  }

  // Không chặn người dùng nếu số liệu lệch (có thể do danh mục tùy chỉnh); chỉ cảnh báo để dev kiểm tra.
  if (import.meta.env.DEV) {
    const defaults = await supabase
      .from('ss_categories')
      .select('id', { count: 'exact', head: true })
      .eq('is_default', true);
    if (!defaults.error && defaults.count !== EXPECTED_DEFAULT_CATEGORIES) {
      console.warn(`[Smart Spend] Có ${defaults.count} danh mục mặc định, kỳ vọng ${EXPECTED_DEFAULT_CATEGORIES}.`);
    }
  }

  // React Query v5 coi kết quả `undefined` là lỗi, nên phải trả về một giá trị.
  return true;
}

function wrap(step: InitStep, cause: unknown): AccountInitError {
  const e = (cause ?? {}) as { message?: string; code?: string };
  const code = e.code ? ` [${e.code}]` : '';
  const err = new AccountInitError(step, `Lỗi khi ${STEP_LABEL[step]}${code}: ${e.message ?? 'không rõ'}`, cause);
  console.error(`[Smart Spend] Khởi tạo tài khoản thất bại ở bước "${step}":`, cause);
  return err;
}
