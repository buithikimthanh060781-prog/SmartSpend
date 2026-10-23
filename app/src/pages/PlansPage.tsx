import { CalendarClock, Pencil, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ExportMenu } from '@/components/ExportMenu';
import { categoryNamer, describeFilters, plansSheet } from '@/export/datasets';
import { useAuth } from '@/auth/AuthProvider';
import { useOpenCreateFromUrl } from '@/hooks/useOpenCreateFromUrl';
import { buildPlanReport } from '@/reports/plans';
import { fetchLinkedExpenses, listAllPlans } from '@/services/plans';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Pagination } from '@/components/Pagination';
import { PlanFormDialog } from '@/components/plans/PlanFormDialog';
import { PlanProgress } from '@/components/plans/PlanProgress';
import { PlanStatusSelect } from '@/components/plans/PlanStatusSelect';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { useFilterState } from '@/hooks/useFilterState';
import { usePlans } from '@/hooks/usePlans';
import { useSettings } from '@/hooks/useSettings';
import { PAGE_SIZE, PLAN_STATUSES, PLAN_STATUS_LABEL, type PlanStatus } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { tryToMoney } from '@/lib/money';
import type { PlanFilters } from '@/services/plans';
import type { SsExpensePlan } from '@/types/db';

const INITIAL: PlanFilters = { search: '', status: '', categoryId: '', page: 1 };

export function PlansPage() {
  const { currency } = useSettings();
  const { categories, byId } = useCategories();
  const { filters, searchInput, setSearchInput, patch, reset, isFiltering } = useFilterState<PlanFilters>(INITIAL);
  const list = usePlans(filters);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SsExpensePlan | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const openCreate = () => { setEditing(null); setFormOpen(true); };
  useOpenCreateFromUrl(openCreate);
  const { user } = useAuth();
  const linkedOf = (id: string) => list.data?.spent[id]?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kế hoạch chi tiêu"
        subtitle="Lập kế hoạch và so sánh với thực chi từ các giao dịch liên kết."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu
              name="ke-hoach"
              produce={async () => {
                // Toàn bộ kế hoạch khớp bộ lọc + thực chi của các giao dịch liên kết.
                const plans = await listAllPlans(user?.id ?? '', filters);
                const linked = await fetchLinkedExpenses(plans.map((p) => p.id));
                const cat = categories.find((c) => c.id === filters.categoryId)?.name;
                const subtitle = describeFilters([
                  ['Từ khóa', filters.search],
                  ['Trạng thái', filters.status ? PLAN_STATUS_LABEL[filters.status] : ''],
                  ['Danh mục', cat],
                ]);
                return [plansSheet(buildPlanReport(plans, linked), categoryNamer(categories), subtitle)];
              }}
            />
            <Button variant="accent" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              Tạo kế hoạch
            </Button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
            <Input className="pl-9" placeholder="Tìm theo tên, ghi chú..." aria-label="Tìm kiếm" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <Select aria-label="Lọc theo trạng thái" value={filters.status} onChange={(e) => patch({ status: e.target.value as '' | PlanStatus })}>
            <option value="">Mọi trạng thái</option>
            {PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>{PLAN_STATUS_LABEL[s]}</option>
            ))}
          </Select>
          <Select aria-label="Lọc theo danh mục" value={filters.categoryId} onChange={(e) => patch({ categoryId: e.target.value })}>
            <option value="">Mọi danh mục</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
        {isFiltering && <Button variant="ghost" size="sm" className="mt-3" onClick={reset}>Xóa bộ lọc</Button>}
      </Card>

      <Card>
        {list.isLoading && <div className="p-5"><LoadingSkeleton /></div>}
        {list.error && !list.isLoading && (
          <div className="p-5"><ErrorState message={toUserMessage(list.error)} onRetry={() => void list.refetch()} /></div>
        )}
        {list.data && list.data.rows.length === 0 && (
          <EmptyState
            icon={CalendarClock}
            title={isFiltering ? 'Không có kết quả phù hợp' : 'Chưa có kế hoạch nào'}
            description={isFiltering ? 'Thử thay đổi hoặc xóa bộ lọc.' : 'Tạo kế hoạch cho một khoản chi sắp tới, rồi liên kết các chi tiêu thực tế vào đó.'}
            action={!isFiltering ? <Button variant="accent" onClick={openCreate}>Tạo kế hoạch</Button> : undefined}
          />
        )}
        {list.data && list.data.rows.length > 0 && (
          <>
            <ul className="divide-y divide-slate-100 px-5">
              {list.data.rows.map((p) => {
                const s = list.data.spent[p.id] ?? { spent: 0, count: 0 };
                const planned = tryToMoney(p.planned_amount);
                return (
                  <li key={p.id} className="space-y-3 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Link to={`/plans/${p.id}`} className="block truncate text-sm font-bold text-navy hover:text-accent-600">
                          {p.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {byId.get(p.category_id)?.name ?? 'Chưa phân loại'} · {formatDate(p.planned_date)} · {s.count} giao dịch
                        </p>
                      </div>
                      <PlanStatusSelect planId={p.id} status={p.status} linkedCount={s.count} />
                      <Button variant="ghost" size="icon" aria-label={`Sửa kế hoạch ${p.title}`} onClick={() => { setEditing(p); setFormOpen(true); }}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                    {planned === null ? (
                      <p role="alert" className="text-xs font-semibold text-danger">Số tiền kế hoạch không hợp lệ trong dữ liệu.</p>
                    ) : (
                      <PlanProgress planned={planned} spent={s.spent} currency={currency} />
                    )}
                  </li>
                );
              })}
            </ul>
            <Pagination page={filters.page} pageSize={PAGE_SIZE} total={list.data.total} onPageChange={(page) => patch({ page })} />
          </>
        )}
      </Card>

      <PlanFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} categories={categories} linkedCount={editing ? linkedOf(editing.id) : 0} />
    </div>
  );
}
