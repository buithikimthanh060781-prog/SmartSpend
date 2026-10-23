import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { isSupabaseConfigured } from '@/lib/supabase';
import { BudgetsPage } from '@/pages/BudgetsPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { IncomesPage } from '@/pages/IncomesPage';
import { LoginPage } from '@/pages/LoginPage';
import { MissingConfigPage } from '@/pages/MissingConfigPage';
import { PlanDetailPage } from '@/pages/PlanDetailPage';
import { PlansPage } from '@/pages/PlansPage';
import { ReportsPage } from '@/pages/ReportsPage';

// Các trang chưa triển khai (Sprint 3+).
const PLACEHOLDER_ROUTES = [
  { path: 'settings', title: 'Cài đặt' },
];

export default function App() {
  if (!isSupabaseConfigured) return <MissingConfigPage />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="incomes" element={<IncomesPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="plans/:id" element={<PlanDetailPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          {PLACEHOLDER_ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={<ComingSoonPage title={r.title} />} />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
