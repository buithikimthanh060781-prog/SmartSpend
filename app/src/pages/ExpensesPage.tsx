import { Pencil, Plus, Receipt, Search, Trash2, TrendingDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { ExportMenu } from '@/components/ExportMenu';
import { categoryNamer, describeFilters, expensesSheet } from '@/export/datasets';
import { useAuth } from '@/auth/AuthProvider';
import { useOpenCreateFromUrl } from '@/hooks/useOpenCreateFromUrl';
import { listAllExpenses } from '@/services/expenses';
import { planTitlesByIds } from '@/services/plans';
import { useSearchParams } from 'react-router-dom';
import { ExpenseFormDialog } from '@/components/expenses/ExpenseFormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Pagination } from '@/components/Pagination';
import { StatCard } from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useCategories } from '@/hooks/useCategories';
import { useExpenseMutations, useExpenses, useExpenseTotal } from '@/hooks/useExpenses';
import { useFilterState } from '@/hooks/useFilterState';
import { useSettings } from '@/hooks/useSettings';
import { PAGE_SIZE, PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { toMutationMessage, toUserMessage } from '@/lib/errors';
import { formatAmount, formatMoney } from '@/lib/money';
import type { ExpenseFilters, ExpenseSort } from '@/services/expenses';
import type { SsExpense } from '@/types/db';

const INITIAL: ExpenseFilters = { search: '', categoryId: '', paymentMethod: '', plan: '', from: '', to: '', sort: 'date_desc', page: 1 };

const SORT_LABEL: Record<ExpenseSort, string> = {
  date_desc: 'Mới nhất',
  date_asc: 'Cũ nhất',
  amount_desc: 'Số tiền giảm dần',
  amount_asc: 'Số tiền tăng dần',
};

export function ExpensesPage() {
  const toast = useToast();
  const { currency } = useSettings();
  const { categories, byId } = useCategories();
  const { user } = useAuth();
  // Bộ lọc khởi tạo có thể đến từ liên kết trong báo cáo: ?category=...&from=...&to=...
  const [urlParams] = useSearchParams();
  const start = useMemo<ExpenseFilters>(
    () => ({ ...INITIAL, categoryId: urlParams.get('category') ?? '', from: urlParams.get('from') ?? '', to: urlParams.get('to') ?? '' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const { filters, searchInput, setSearchInput, patch, reset, isFiltering } = useFilterState<ExpenseFilters>(INITIAL, start);
  const list = useExpenses(filters);
  const total = useExpenseTotal(filters);
  const { remove } = useExpenseMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SsExpense | null>(null);
  const [deleting, setDeleting] = useState<SsExpense | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('Đã xóa khoản chi tiêu.');
    } catch (e) {
      toast.error(toMutationMessage(e));
    } finally {
      setDeleting(null);
    }
  }

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  useOpenCreateFromUrl(openCreate);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chi tiêu"
        subtitle="Ghi lại các khoản chi trong và ngoài kế hoạch."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu
              name="chi-tieu"
              produce={async () => {
                // Lấy TOÀN BỘ kết quả khớp bộ lọc và thứ tự sắp xếp hiện tại (không chỉ trang hiện tại).
                const rows = await listAllExpenses(user?.id ?? '', filters);
                const planIds = [...new Set(rows.flatMap((r) => (r.plan_id ? [r.plan_id] : [])))];
                const titles = await planTitlesByIds(planIds);
                const cat = categories.find((c) => c.id === filters.categoryId)?.name;
                const subtitle = describeFilters([
                  ['Từ khóa', filters.search],
                  ['Danh mục', cat],
                  ['Phương thức', filters.paymentMethod ? PAYMENT_METHOD_LABEL[filters.paymentMethod] : ''],
                  ['Kế hoạch', filters.plan === 'linked' ? 'Trong kế hoạch' : filters.plan === 'unlinked' ? 'Ngoài kế hoạch' : ''],
                  ['Từ ngày', filters.from],
                  ['Đến ngày', filters.to],
                ]);
                return [expensesSheet(rows.map((r) => ({ ...r, planTitle: r.plan_id ? titles.get(r.plan_id) : undefined })), categoryNamer(categories), subtitle)];
              }}
            />
            <Button variant="accent" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              Thêm chi tiêu
            </Button>
          </div>
        }
      />

      <StatCard
        label={isFiltering ? 'Tổng chi theo bộ lọc' : 'Tổng chi tiêu'}
        value={total.data !== undefined ? formatMoney(total.data, currency) : '...'}
        hint="Không giới hạn ở trang hiện tại"
        icon={TrendingDown}
        tone="danger"
      />
      {total.error && <ErrorState title="Không tính được tổng" message={toUserMessage(total.error)} onRetry={() => void total.refetch()} />}

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
            <Input className="pl-9" placeholder="Tìm theo mô tả, ghi chú..." aria-label="Tìm kiếm" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <Select aria-label="Sắp xếp" value={filters.sort} onChange={(e) => patch({ sort: e.target.value as ExpenseSort })}>
            {(Object.keys(SORT_LABEL) as ExpenseSort[]).map((s) => (
              <option key={s} value={s}>{SORT_LABEL[s]}</option>
            ))}
          </Select>
          <Select aria-label="Lọc theo danh mục" value={filters.categoryId} onChange={(e) => patch({ categoryId: e.target.value })}>
            <option value="">Mọi danh mục</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select aria-label="Lọc theo phương thức" value={filters.paymentMethod} onChange={(e) => patch({ paymentMethod: e.target.value as '' | PaymentMethod })}>
            <option value="">Mọi phương thức</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
            ))}
          </Select>
          <Select aria-label="Lọc theo kế hoạch" value={filters.plan} onChange={(e) => patch({ plan: e.target.value as ExpenseFilters['plan'] })}>
            <option value="">Trong và ngoài kế hoạch</option>
            <option value="linked">Trong kế hoạch</option>
            <option value="unlinked">Ngoài kế hoạch</option>
          </Select>
          <div className="flex gap-2">
            <Input type="date" aria-label="Từ ngày" value={filters.from} max={filters.to || undefined} onChange={(e) => patch({ from: e.target.value })} />
            <Input type="date" aria-label="Đến ngày" value={filters.to} min={filters.from || undefined} onChange={(e) => patch({ to: e.target.value })} />
          </div>
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
            icon={Receipt}
            title={isFiltering ? 'Không có kết quả phù hợp' : 'Chưa có khoản chi tiêu nào'}
            description={isFiltering ? 'Thử thay đổi hoặc xóa bộ lọc.' : 'Ghi lại khoản chi đầu tiên để theo dõi dòng tiền.'}
            action={!isFiltering ? <Button variant="accent" onClick={openCreate}>Thêm chi tiêu</Button> : undefined}
          />
        )}
        {list.data && list.data.rows.length > 0 && (
          <>
            <ul className="divide-y divide-slate-100 px-5">
              {list.data.rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">{r.description || byId.get(r.category_id)?.name || 'Chi tiêu'}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{byId.get(r.category_id)?.name ?? 'Chưa phân loại'}</span>
                      <span>·</span>
                      <span>{formatDate(r.expense_date)}</span>
                      <span>·</span>
                      <span>{PAYMENT_METHOD_LABEL[r.payment_method as PaymentMethod] ?? r.payment_method}</span>
                      <Badge tone={r.plan_id ? 'success' : 'accent'}>{r.plan_id ? 'Trong kế hoạch' : 'Ngoài kế hoạch'}</Badge>
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-danger">-{formatAmount(r.amount, currency)}</p>
                  <Button variant="ghost" size="icon" aria-label="Sửa chi tiêu" onClick={() => { setEditing(r); setFormOpen(true); }}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Xóa chi tiêu" onClick={() => setDeleting(r)}>
                    <Trash2 className="h-4 w-4 text-danger" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            <Pagination page={filters.page} pageSize={PAGE_SIZE} total={list.data.total} onPageChange={(page) => patch({ page })} />
          </>
        )}
      </Card>

      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} categories={categories} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa khoản chi tiêu?"
        description="Khoản chi sẽ bị xóa vĩnh viễn; Tổng quan và tiến độ kế hoạch liên quan sẽ được cập nhật."
        confirmLabel="Xóa"
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
