import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Chỉ dùng anon/publishable key. Mọi truy cập dữ liệu đi qua RLS (auth.uid()).
export const supabase = createClient(
  url ?? 'https://placeholder.invalid',
  anonKey ?? 'placeholder',
  { auth: { persistSession: true, autoRefreshToken: true } },
);
