// Supabase client config - dùng chung project với HocVeo.
// Chỉ dùng anon/public key. KHÔNG đặt service_role key ở frontend.
// Nếu HocVeo đổi key, cập nhật cả hai nơi (../js/supabase.js và file này).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://laoxrsdemwvwcpqjqecq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_HBbNUGykr-mqk0oDBMrAIA_PyBQ9fmM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
