import { Banknote, CalendarClock, CheckCircle2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { ExportMenu } from '@/components/ExportMenu';
import { categoryNamer, describeFilters, incomesSheet } from '@/export/datasets';
import { useAuth } from '@/auth/AuthProvider';
import { useOpenCreateFromUrl } from '@/hooks/useOpenCreateFromUrl';
import { listAllIncomes } from '@/services/incomes';
import { IncomeFormDialog } from '@/components/incomes/IncomeFormDialog';
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
import { useFilterState } from '@/hooks/useFilterState';
import { useIncomeMutations, useIncomes, useIncomeTotals } from '@/hooks/useIncomes';
import { useSettings } from '@/hooks/useSettings';
import { INCOME_STATUSES, INCOME_STATUS_LABEL, PAGE_SIZE, type IncomeStatus } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { toMutationMessage, toUserMessage } from '@/lib/errors';
import { formatAmount, formatMoney } from '@/lib/money';
import type { IncomeFilters } from '@/services/incomes';
import type { SsIncome } from '@/types/db';

const INITIAL: IncomeFilters = { search: '', status: '', categoryId: '', from: '', to: '', page: 1 };

export function IncomesPage() {
  const toast = useToast();
  const { currency } = useSettings();
  const { categories, byId } = useCategories();
  const { filters, searchInput, setSearchInput, patch, reset, isFiltering } = useFilterState<IncomeFilters>(INITIAL);
  const list = useIncomes(filters);
  const totals = useIncomeTotals(filters);
  const { remove } = useIncomeMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SsIncome | null>(null);
  const [deleting, setDeleting] = useState<SsIncome | null>(null);
  const { user } = useAuth();
  useOpenCreateFromUrl(() => { setEditing(null); setFormOpen(true); });

  const incomeCategories = categories.filter((c) => c.type === 'income');

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('Đã xóa khoản thu nhập.');
    } catch (e) {
      toast.error(toMutationMessage(e));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thu nhập"
        subtitle="Theo dõi thu nhập dự kiến và thực nhận."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu
              name="thu-nhap"
              produce={async () => {
                // Lấy TOÀN BỘ kết quả khớp bộ lọc (không chỉ trang hiện tại).
                const rows = await listAllIncomes(user?.id ?? '', filters);
                const cat = categories.find((c) => c.id === filters.categoryId)?.name;
                const subtitle = describeFilters([
                  ['Từ khóa', filters.search],
                  ['Trạng thái', filters.status ? INCOME_STATUS_LABEL[filters.status] : ''],
                  ['Danh mục', cat],
                  ['Từ ngày', filters.from],
                  ['Đến ngày', filters.to],
                ]);
                return [incomesSheet(rows, categoryNamer(categories), subtitle)];
              }}
            />
            <Button variant="accent" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" aria-hidden />
              Thêm thu nhập
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Tổng thực nhận"
          value={totals.data ? formatMoney(totals.data.received, currency) : '...'}
          hint="Đã nhận, theo bộ lọc hiện tại (không tính trạng thái)"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Tổng dự kiến"
          value={totals.data ? formatMoney(totals.data.expected, currency) : '...'}
          hint="Chưa nhận, không tính vào Tổng quan"
          icon={CalendarClock}
          tone="accent"
        />
      </div>
      {totals.error && <ErrorState title="Không tính được tổng" message={toUserMessage(totals.error)} onRetry={() => void totals.refetch()} />}

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
            <Input className="pl-9" placeholder="Tìm theo mô tả, ghi chú..." aria-label="Tìm kiếm" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <Select aria-label="Lọc theo trạng thái" value={filters.status} onChange={(e) => patch({ status: e.target.value as '' | IncomeStatus })}>
            <option value="">Mọi trạng thái</option>
            {INCOME_STATUSES.map((s) => (
              <option key={s} value={s}>{INCOME_STATUS_LABEL[s]}</option>
            ))}
          </Select>
          <Select aria-label="Lọc theo danh mục" value={filters.categoryId} onChange={(e) => patch({ categoryId: e.target.value })}>
            <option value="">Mọi danh mục</option>
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input type="date" aria-label="Từ ngày" value={filters.from} max={filters.to || undefined} onChange={(e) => patch({ from: e.target.value })} />
            <Input type="date" aria-label="Đến ngày" value={filters.to} min={filters.from || undefined} onChange={(e) => patch({ to: e.target.value })} />
          </div>
        </div>
        {isFiltering && (
          <Button variant="ghost" size="sm" className="mt-3" onClick={reset}>Xóa bộ lọc</Button>
        )}
      </Card>

      <Card>
        {list.isLoading && <div className="p-5"><LoadingSkeleton /></div>}
        {list.error && !list.isLoading && (
          <div className="p-5"><ErrorState message={toUserMessage(list.error)} onRetry={() => void list.refetch()} /></div>
        )}
        {list.data && list.data.rows.length === 0 && (
          <EmptyState
            icon={Banknote}
            title={isFiltering ? 'Không có kết quả phù hợp' : 'Chưa có khoản thu nhập nào'}
            description={isFiltering ? 'Thử thay đổi hoặc xóa bộ lọc.' : 'Ghi lại khoản thu nhập đầu tiên của bạn.'}
            action={!isFiltering ? <Button variant="accent" onClick={() => { setEditing(null); setFormOpen(true); }}>Thêm thu nhập</Button> : undefined}
          />
        )}
        {list.data && list.data.rows.length > 0 && (
          <>
            <ul className="divide-y divide-slate-100 px-5">
              {list.data.rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">{r.description || byId.get(r.category_id)?.name || 'Thu nhập'}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{byId.get(r.category_id)?.name ?? 'Chưa phân loại'}</span>
                      <span>·</span>
                      <span>{formatDate(r.income_date)}</span>
                      <Badge tone={r.status === 'received' ? 'success' : 'accent'}>
                        {INCOME_STATUS_LABEL[r.status as IncomeStatus] ?? r.status}
                      </Badge>
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-success">+{formatAmount(r.amount, currency)}</p>
                  <Button variant="ghost" size="icon" aria-label="Sửa thu nhập" onClick={() => { setEditing(r); setFormOpen(true); }}>
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Xóa thu nhập" onClick={() => setDeleting(r)}>
                    <Trash2 className="h-4 w-4 text-danger" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            <Pagination page={filters.page} pageSize={PAGE_SIZE} total={list.data.total} onPageChange={(page) => patch({ page })} />
          </>
        )}
      </Card>

      <IncomeFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} categories={categories} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa khoản thu nhập?"
        description="Khoản thu nhập sẽ bị xóa vĩnh viễn và Tổng quan sẽ được cập nhật."
        confirmLabel="Xóa"
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
