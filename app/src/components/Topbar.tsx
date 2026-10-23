import { LogOut, Menu, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setConfirmOpen(false);
      navigate('/login', { replace: true });
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Mở menu">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1" />

      <Button asChild variant="accent" className="hidden sm:inline-flex">
        <Link to="/expenses">
          <Plus className="h-4 w-4" aria-hidden />
          Thêm chi tiêu
        </Link>
      </Button>

      <span className="hidden max-w-[220px] truncate text-sm font-medium text-slate-600 md:block" title={user?.email ?? ''}>
        {user?.email}
      </span>
      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
        <LogOut className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Đăng xuất</span>
        <span className="sr-only sm:hidden">Đăng xuất</span>
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Đăng xuất?"
        description="Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng Smart Spend."
        confirmLabel="Đăng xuất"
        loading={signingOut}
        onConfirm={handleSignOut}
      />
    </header>
  );
}
