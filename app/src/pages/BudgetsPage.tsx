import { ChevronLeft, ChevronRight, History, PiggyBank, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AlertList } from '@/components/budgets/AlertList';
import { AuditLogPanel } from '@/components/budgets/AuditLogPanel';
import { BudgetFormDialog } from '@/components/budgets/BudgetFormDialog';
import { StatusBadge, UsageBar } from '@/components/budgets/BudgetStatus';
import { PageHeader } from '@/components/common/PageHeader';
import { ExportMenu } from '@/components/ExportMenu';
import { budgetsSheet, categoryNamer, describeFilters } from '@/export/datasets';
import { useOpenCreateFromUrl } from '@/hooks/useOpenCreateFromUrl';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useBudgetAuditCount, useBudgetList, useBudgetMutations, useBudgetOverview } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { todayIso, useSettings } from '@/hooks/useSettings';
import { PERIOD_TYPES, PERIOD_TYPE_LABEL, type PeriodType } from '@/lib/budget';
import { toMutationMessage, toUserMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { periodContaining, periodLabel, samePeriod, shiftPeriod } from '@/lib/periods';
import { cn } from '@/lib/utils';
import type { BudgetEvaluation } from '@/services/budgetCalculation';
import type { BudgetFilters } from '@/services/budgets';

type Tab = 'list' | 'history';
type Mode = 'period' | 'range';

export function BudgetsPage() {
  const toast = useToast();
  const { currency, timezone } = useSettings();
  const today = todayIso(timezone);
  const { categories, byId } = useCategories();
  const categoryName = (id: string) => byId.get(id)?.name;

  const [tab, setTab] = useState<Tab>('list');
  const [mode, setMode] = useState<Mode>('period');
  const [type, setType] = useState<'' | PeriodType>('monthly');
  const [anchor, setAnchor] = useState<string | null>(null); // null = hôm nay
  const [range, setRange] = useState({ from: '', to: '' });
  const [scope, setScope] = useState<'' | 'total' | 'category'>('');
  const [categoryId, setCategoryId] = useState('');
  const [auditBudgetId, setAuditBudgetId] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetEvaluation | null>(null);
  const [deleting, setDeleting] = useState<BudgetEvaluation | null>(null);

  const activeType: PeriodType = type === '' ? 'monthly' : type;
  const period = periodContaining(activeType, anchor ?? today);
  const isCurrent = samePeriod(period, periodContaining(activeType, today));

  const filters = useMemo<BudgetFilters>(
    () => ({
      periodType: mode === 'period' ? activeType : type,
      start: mode === 'period' ? period.start : undefined,
      from: mode === 'range' ? range.from || undefined : undefined,
      to: mode === 'range' ? range.to || undefined : undefined,
      scope,
      categoryId: scope === 'category' ? categoryId : '',
    }),
    [mode, activeType, type, period.start, range.from, range.to, scope, categoryId],
  );

  const list = useBudgetList(filters);
  const overview = useBudgetOverview();
  const { remove } = useBudgetMutations();
  const auditCount = useBudgetAuditCount(deleting?.budget.id ?? '', Boolean(deleting));

  const rows = useMemo(
    () =>
      [...(list.data ?? [])].sort(
        (a, b) =>
          (a.budget.period_start < b.budget.period_start ? 1 : a.budget.period_start > b.budget.period_start ? -1 : 0) ||
          Number(a.budget.category_id !== null) - Number(b.budget.category_id !== null) ||
          (b.usagePercent ?? Infinity) - (a.usagePercent ?? Infinity),
      ),
    [list.data],
  );

  const alerts = overview.data?.alerts ?? [];
  const openCreate = () => { setEditing(null); setFormOpen(true); };
  useOpenCreateFromUrl(openCreate);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.budget.id);
      toast.success('Đã xóa ngân sách. Các giao dịch chi tiêu không bị ảnh hưởng.');
    } catch (e) {
      toast.error(toMutationMessage(e));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ngân sách"
        subtitle="Đặt hạn mức theo ngày, tuần, tháng — tổng hoặc theo danh mục. Các hạn mức độc lập với nhau."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu
              name="ngan-sach"
              disabled={rows.length === 0}
              produce={async () => {
                // Danh sách đã được tải đầy đủ theo bộ lọc hiện tại (không phân trang), nên xuất đúng những gì đang lọc.
                const cat = categories.find((c) => c.id === filters.categoryId)?.name;
                const subtitle = describeFilters([
                  ['Loại kỳ', filters.periodType ? PERIOD_TYPE_LABEL[filters.periodType] : ''],
                  ['Kỳ', mode === 'period' ? periodLabel(period) : ''],
                  ['Từ ngày', filters.from],
                  ['Đến ngày', filters.to],
                  ['Phạm vi', filters.scope === 'total' ? 'Chỉ ngân sách tổng' : filters.scope === 'category' ? 'Chỉ ngân sách danh mục' : ''],
                  ['Danh mục', cat],
                ]);
                return [budgetsSheet(rows, categoryNamer(categories), subtitle)];
              }}
            />
            <Button variant="accent" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              Thiết lập ngân sách
            </Button>
          </div>
        }
      />

      {alerts.length > 0 && (
        <section aria-label="Cảnh báo ngân sách" className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-navy">
            Cảnh báo hiện tại <Badge tone="danger">{alerts.length}</Badge>
          </h2>
          <AlertList alerts={alerts} currency={currency} categoryName={categoryName} />
        </section>
      )}

      <div role="tablist" aria-label="Chế độ xem" className="inline-flex rounded-xl bg-white p-1 shadow-card">
        {([['list', 'Ngân sách'], ['history', 'Lịch sử thay đổi']] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn('rounded-lg px-4 py-2 text-sm font-semibold', tab === key ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-50')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <AuditLogPanel
          budgetId={auditBudgetId}
          page={auditPage}
          onPageChange={setAuditPage}
          onClearBudget={() => { setAuditBudgetId(''); setAuditPage(1); }}
          currency={currency}
          categoryName={categoryName}
        />
      )}

      {tab === 'list' && (
        <>
          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              {mode === 'period' ? (
                <div role="tablist" aria-label="Loại kỳ" className="inline-flex rounded-xl bg-canvas p-1">
                  {PERIOD_TYPES.map((t) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={type === t}
                      onClick={() => { setType(t); setAnchor(null); }}
                      className={cn('rounded-lg px-4 py-1.5 text-sm font-semibold', type === t ? 'bg-navy text-white' : 'text-slate-600')}
                    >
                      {PERIOD_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              ) : (
                <Select aria-label="Loại kỳ" className="w-auto" value={type} onChange={(e) => setType(e.target.value as '' | PeriodType)}>
                  <option value="">Mọi loại kỳ</option>
                  {PERIOD_TYPES.map((t) => (
                    <option key={t} value={t}>{PERIOD_TYPE_LABEL[t]}</option>
                  ))}
                </Select>
              )}

              {mode === 'period' ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" aria-label="Kỳ trước" onClick={() => setAnchor(shiftPeriod(period, -1).start)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[170px] text-center text-sm font-bold text-navy" aria-live="polite">{periodLabel(period)}</span>
                  <Button variant="outline" size="icon" aria-label="Kỳ sau" onClick={() => setAnchor(shiftPeriod(period, 1).start)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={isCurrent} onClick={() => setAnchor(null)}>Kỳ hiện tại</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input type="date" aria-label="Từ ngày" className="w-auto" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                  <span className="text-slate-400">–</span>
                  <Input type="date" aria-label="Đến ngày" className="w-auto" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  if (mode === 'period') setMode('range');
                  else { setMode('period'); if (type === '') setType('monthly'); }
                }}
              >
                {mode === 'period' ? 'Xem theo khoảng thời gian' : 'Xem theo từng kỳ'}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Select aria-label="Phạm vi" value={scope} onChange={(e) => { setScope(e.target.value as '' | 'total' | 'category'); setCategoryId(''); }}>
                <option value="">Tổng ngân sách và ngân sách danh mục</option>
                <option value="total">Chỉ ngân sách tổng</option>
                <option value="category">Chỉ ngân sách theo danh mục</option>
              </Select>
              {scope === 'category' && (
                <Select aria-label="Danh mục" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Mọi danh mục</option>
                  {categories.filter((c) => c.type === 'expense').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              )}
            </div>
          </Card>

          <Card>
            {list.isLoading && <div className="p-5"><LoadingSkeleton /></div>}
            {list.error && !list.isLoading && <div className="p-5"><ErrorState message={toUserMessage(list.error)} onRetry={() => void list.refetch()} /></div>}
            {!list.isLoading && !list.error && rows.length === 0 && (
              <EmptyState
                icon={PiggyBank}
                title="Chưa thiết lập"
                description={mode === 'period' ? `Chưa có ngân sách nào cho ${periodLabel(period).toLowerCase()}. Chưa có ngân sách thì sẽ không có cảnh báo.` : 'Không có ngân sách nào trong khoảng thời gian đã chọn.'}
                action={<Button variant="accent" onClick={openCreate}>Thiết lập ngân sách</Button>}
              />
            )}
            {rows.length > 0 && (
              <ul className="divide-y divide-slate-100 px-5">
                {rows.map((ev) => {
                  const b = ev.budget;
                  const scopeLabel = b.category_id === null ? 'Tổng chi tiêu' : categoryName(b.category_id) ?? 'Danh mục';
                  return (
                    <li key={b.id} className="space-y-3 py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-navy">{scopeLabel}</p>
                          <p className="text-xs text-slate-500">
                            {PERIOD_TYPE_LABEL[b.period_type as PeriodType] ?? b.period_type} · {periodLabel({ type: b.period_type as PeriodType, start: b.period_start, endExclusive: b.period_end })} · Hạn mức {formatMoney(ev.amount, currency)}
                          </p>
                        </div>
                        <StatusBadge status={ev.status} zeroBudget={ev.amount === 0} />
                        <Button variant="ghost" size="icon" aria-label="Xem lịch sử thay đổi" onClick={() => { setAuditBudgetId(b.id); setAuditPage(1); setTab('history'); }}>
                          <History className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Sửa hạn mức ${scopeLabel}`} onClick={() => { setEditing(ev); setFormOpen(true); }}>
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Xóa ngân sách ${scopeLabel}`} onClick={() => setDeleting(ev)}>
                          <Trash2 className="h-4 w-4 text-danger" aria-hidden />
                        </Button>
                      </div>
                      <UsageBar ev={ev} currency={currency} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      <BudgetFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} categories={categories} defaultType={activeType} defaultAnchor={mode === 'period' ? period.start : undefined} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa ngân sách?"
        description={
          deleting
            ? `Chỉ xóa hạn mức này; các giao dịch chi tiêu không bị xóa.${
                auditCount.data ? ` Ngân sách có ${auditCount.data} bản ghi lịch sử thay đổi (database sẽ quyết định giữ hay từ chối xóa).` : ''
              }`
            : ''
        }
        confirmLabel="Xóa"
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
