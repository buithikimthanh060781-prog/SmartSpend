import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/auth/AuthProvider';
import { FullScreenLoader } from '@/components/LoadingSkeleton';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const schema = z.object({
  email: z.string().trim().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (loading) return <FullScreenLoader />;

  // Đã có session (đăng nhập xong hoặc tải lại trang): chuyển vào app. Việc khởi tạo tài khoản
  // do AccountGate đảm nhiệm cho mọi phiên, nên trang này chỉ lo đăng nhập.
  if (session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/dashboard'} replace />;
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) setFormError(toUserMessage(error, 'Đăng nhập không thành công. Vui lòng thử lại.'));
    } catch (e) {
      setFormError(toUserMessage(e, 'Đăng nhập không thành công. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-navy px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-xl font-extrabold text-navy">Smart Spend</span>
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-navy">Đăng nhập</h1>
        <p className="mt-1 text-sm text-slate-500">Dùng tài khoản Học Vèo của bạn để tiếp tục.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} {...register('email')} />
            {errors.email && <p className="mt-1 text-sm text-danger">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register('password')} />
            {errors.password && <p className="mt-1 text-sm text-danger">{errors.password.message}</p>}
          </div>

          {formError && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
              {formError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </div>
  );
}
