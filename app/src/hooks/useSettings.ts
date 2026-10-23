import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { SsSettings } from '@/types/db';

export function useSettings() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const query = useQuery({
    queryKey: ['settings', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('ss_settings').select('*').eq('user_id', userId).maybeSingle<SsSettings>();
      if (error) throw error;
      return data;
    },
  });
  return {
    currency: query.data?.currency ?? 'VND',
    timezone: query.data?.timezone ?? 'Asia/Ho_Chi_Minh',
    isLoading: query.isLoading,
  };
}

/** Ngày hôm nay (YYYY-MM-DD) theo múi giờ người dùng. */
export function todayIso(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
