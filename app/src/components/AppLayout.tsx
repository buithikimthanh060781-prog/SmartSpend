import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { Button } from '@/components/ui/button';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Menu mobile dạng ngăn kéo */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-navy/50" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%]">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-3 text-white hover:bg-white/10 hover:text-white"
              onClick={() => setMenuOpen(false)}
              aria-label="Đóng menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 lg:px-8 lg:pb-10">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Nút thêm chi tiêu nổi trên mobile */}
      <Button asChild variant="accent" size="icon" className="fixed bottom-5 right-5 z-30 h-14 w-14 rounded-full sm:hidden">
        <Link to="/expenses" aria-label="Thêm chi tiêu">
          <Plus className="h-6 w-6" />
        </Link>
      </Button>
    </div>
  );
}
