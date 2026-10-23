import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UserCacheGuard } from '@/auth/userCacheGuard';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Kiểm tra session khi mở website.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Không gọi Supabase bên trong callback này (tránh deadlock), chỉ cập nhật state và cache cục bộ.
    const guard = new UserCacheGuard(queryClient);
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Reset cache TRƯỚC khi giao diện nhận user mới: hủy truy vấn của tài khoản cũ, không để lộ dữ liệu cũ.
      guard.handle(event, next?.user.id ?? null);
      setSession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, signOut }),
    [session, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return ctx;
}
