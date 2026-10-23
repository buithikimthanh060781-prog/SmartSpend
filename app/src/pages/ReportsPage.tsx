import { BarChart3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ExportMenu } from '@/components/ExportMenu';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { BudgetsReportView } from '@/components/reports/BudgetsReportView';
import { CategoryView } from '@/components/reports/CategoryView';
import { CompareView } from '@/components/reports/CompareView';
import { OverviewView } from '@/components/reports/OverviewView';
import { PlansReportView } from '@/components/reports/PlansReportView';
import { RangeFilter } from '@/components/reports/RangeFilter';
import { TimeSeriesView } from '@/components/reports/TimeSeriesView';
import { Card } from '@/components/ui/card';
import { budgetsSheet, categoriesSheet, categoryNamer, plansSheet, rangeText, seriesSheet, summaryWorkbookSheets } from '@/export/datasets';
import { useBudgetOverview } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { unionWindow, usePeriodData, usePlanData, useToday } from '@/hooks/useReportData';
import { useSettings } from '@/hooks/useSettings';
import { toUserMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { buildCategoryReport, withComparableChanges } from '@/reports/categories';
import { buildPeriodComparison } from '@/reports/periodComparison';
import { buildPlanReport } from '@/reports/plans';
import { inRange, previousComparableRange, rangeDays, resolvePreset, type ComparisonSpec, type CustomRange, type RangePreset } from '@/reports/ranges';
import { allowedGranularities, buildSeries, GRANULARITY_LABEL, suggestGranularity, type Granularity } from '@/reports/series';
import { buildFinancialSummary } from '@/reports/summary';
import { BusinessRuleError } from '@/services/guards';
import { planTitlesByIds } from '@/services/plans';
import { fetchPlanData } from '@/services/reports';
import { loadBudgetOverview } from '@/services/budgets';

type Tab = 'overview' | 'time' | 'category' | 'plans' | 'budgets' | 'compare';
const TABS: Array<[Tab, string]> = [
  ['overview', 'Tổng quan'],
  ['time', 'Theo thời gian'],
  ['category', 'Theo danh mục'],
  ['plans', 'Kế hoạch'],
  ['budgets', 'Ngân sách'],
  ['compare', 'So sánh kỳ'],
];

export function ReportsPage() {
  const { user } = useAuth();
  const { currency } = useSettings();
  const today = useToday();
  const { categories, byId } = useCategories();
  const categoryName = (id: string) => byId.get(id)?.name;
  const userId = user?.id ?? '';

  const [tab, setTab] = useState<Tab>('overview');
  const [preset, setPreset] = useState<RangePreset>('thisMonth');
  const [custom, setCustom] = useState<CustomRange>({ from: '', to: '' });
  const [granularityChoice, setGranularityChoice] = useState<Granularity | null>(null);
  const [budgetDate, setBudgetDate] = useState<string | null>(null);

  const range = useMemo(() => resolvePreset(preset, today, custom), [preset, today, custom]);
  const cmp = useMemo(() => (range ? previousComparableRange(range, preset, today) : null), [range, preset, today]);
  const window = range && cmp ? unionWindow(range, cmp.previous) : range;

  const period = usePeriodData(tab === 'compare' || tab === 'budgets' ? null : window);
  const planData = usePlanData(tab === 'plans' ? range : null);
  const budgetOverview = useBudgetOverview(budgetDate ?? today, tab === 'budgets');

  const derived = useMemo(() => {
    if (!range || !cmp || !period.data) return null;
    const { incomes, expenses } = period.data;
    const rangeExpenses = expenses.filter((e) => inRange(e.expense_date, range));
    const previousExpenses = expenses.filter((e) => inRange(e.expense_date, cmp.previous));
    const comparableExpenses = expenses.filter((e) => inRange(e.expense_date, cmp.current));
    const spec: ComparisonSpec = {
      current: cmp.current,
      previous: cmp.previous,
      days: rangeDays(cmp.current),
      partial: cmp.partial,
      currentLabel: 'Kỳ này',
      previousLabel: 'Kỳ trước',
    };
    const comparison = rangeDays(cmp.current) > 0 ? buildPeriodComparison(spec, incomes, expenses, categories, today) : null;
    return {
      summary: buildFinancialSummary(incomes, expenses, range, today),
      comparison,
      rangeExpenses,
      categoryReport: withComparableChanges(buildCategoryReport(rangeExpenses, categories, previousExpenses), comparableExpenses, previousExpenses),
    };
  }, [range, cmp, period.data, categories, today]);

  const allowed = range ? allowedGranularities(range) : [];
  const granularity: Granularity = granularityChoice && allowed.includes(granularityChoice) ? granularityChoice : range ? suggestGranularity(range) : 'day';
  const series = useMemo(
    () => (range && period.data ? buildSeries(period.data.incomes, period.data.expenses, range, granularity) : []),
    [range, period.data, granularity],
  );
  const planReport = useMemo(() => (planData.data ? buildPlanReport(planData.data.plans, planData.data.linked) : null), [planData.data]);

  const changePreset = (p: RangePreset) => {
    setPreset(p);
    setGranularityChoice(null);
  };

  const needsRange = tab !== 'compare' && tab !== 'budgets';
  const subtitle = range ? `Phạm vi: ${rangeText(range)}` : '';

  /** Báo cáo tổng hợp 6 sheet: dùng dữ liệu đã tải cho kỳ đang chọn, cộng thêm kế hoạch và ngân sách tại thời điểm xuất. */
  const produceSummary = async () => {
    if (!range || !derived || !period.data) throw new BusinessRuleError('Hãy chọn khoảng thời gian hợp lệ và đợi dữ liệu tải xong.');
    const [plans, overview] = await Promise.all([fetchPlanData(userId, range), loadBudgetOverview(userId, today)]);
    const inR = period.data.expenses.filter((e) => inRange(e.expense_date, range));
    const titles = await planTitlesByIds([...new Set(inR.flatMap((e) => (e.plan_id ? [e.plan_id] : [])))]);
    return summaryWorkbookSheets({
      range,
      generatedOn: today,
      summary: derived.summary,
      comparison: derived.comparison,
      incomes: period.data.incomes.filter((i) => inRange(i.income_date, range)),
      expenses: inR.map((e) => ({ ...e, planTitle: e.plan_id ? titles.get(e.plan_id) : undefined })),
      planReport: buildPlanReport(plans.plans, plans.linked),
      budgetEvaluations: overview.evaluations,
      budgetNote: `Ngân sách của các kỳ ngày/tuần/tháng chứa ngày ${today.split('-').reverse().join('/')} (ngày xuất).`,
      categoryReport: derived.categoryReport,
      nameOf: categoryNamer(categories),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo tài chính"
        subtitle="Số liệu từ dữ liệu thực của bạn. Thu nhập dự kiến và kế hoạch chưa thực hiện không được tính vào thực nhận hay thực chi."
        action={<ExportMenu name="bao-cao-tong-hop" disabled={!derived || period.isFetching} produce={produceSummary} />}
      />

      <div role="tablist" aria-label="Phân hệ báo cáo" className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-card">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn('shrink-0 rounded-lg px-4 py-2 text-sm font-semibold', tab === key ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-50')}
          >
            {label}
          </button>
        ))}
      </div>

      {needsRange && (
        <Card className="p-4">
          <RangeFilter preset={preset} onPreset={changePreset} custom={custom} onCustom={setCustom} range={range} />
        </Card>
      )}

      {needsRange && range && period.isLoading && <LoadingSkeleton />}
      {needsRange && period.error && !period.isLoading && <ErrorState message={toUserMessage(period.error, 'Không tải được dữ liệu báo cáo.')} onRetry={() => void period.refetch()} />}
      {needsRange && !range && (
        <Card>
          <EmptyState icon={BarChart3} title="Chưa chọn khoảng thời gian hợp lệ" description="Chọn ngày bắt đầu và ngày kết thúc (ngày bắt đầu không sau ngày kết thúc)." />
        </Card>
      )}

      {needsRange && range && derived && (
        <div className={cn(period.isFetching && period.isPlaceholderData && 'opacity-60 transition-opacity')} aria-busy={period.isFetching}>
          {tab === 'overview' && <OverviewView summary={derived.summary} comparison={derived.comparison} currency={currency} />}

          {tab === 'time' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-500">{GRANULARITY_LABEL[granularity]} · tuần bắt đầu Thứ Hai (ISO) · mốc không có giao dịch hiển thị bằng 0</p>
                <ExportMenu name="theo-thoi-gian" produce={async () => [seriesSheet(series, GRANULARITY_LABEL[granularity], subtitle)]} />
              </div>
              <TimeSeriesView buckets={series} currency={currency} granularity={granularity} allowed={allowed} onGranularity={setGranularityChoice} />
            </div>
          )}

          {tab === 'category' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <ExportMenu name="chi-tieu-theo-danh-muc" produce={async () => [categoriesSheet(derived.categoryReport, subtitle, true)]} />
              </div>
              <CategoryView report={derived.categoryReport} currency={currency} range={range} expenses={derived.rangeExpenses} showComparison />
            </div>
          )}
        </div>
      )}

      {tab === 'plans' && range && (
        <div className="space-y-3">
          {planData.isLoading && <LoadingSkeleton />}
          {planData.error && <ErrorState message={toUserMessage(planData.error)} onRetry={() => void planData.refetch()} />}
          {planReport && (
            <>
              <div className="flex justify-end">
                <ExportMenu name="bao-cao-ke-hoach" produce={async () => [plansSheet(planReport, categoryNamer(categories), subtitle)]} />
              </div>
              <PlansReportView report={planReport} currency={currency} range={range} categoryName={categoryName} />
            </>
          )}
        </div>
      )}

      {tab === 'budgets' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <ExportMenu
              name="bao-cao-ngan-sach"
              disabled={!budgetOverview.data || budgetOverview.data.evaluations.length === 0}
              produce={async () => [budgetsSheet(budgetOverview.data?.evaluations ?? [], categoryNamer(categories), `Ngân sách của các kỳ chứa ngày ${(budgetDate ?? today).split('-').reverse().join('/')}.`)]}
            />
          </div>
          <BudgetsReportView
            overview={budgetOverview.data}
            isLoading={budgetOverview.isLoading}
            error={budgetOverview.error}
            onRetry={() => void budgetOverview.refetch()}
            date={budgetDate ?? today}
            onDate={setBudgetDate}
            currency={currency}
            categoryName={categoryName}
          />
        </div>
      )}

      {tab === 'compare' && <CompareView currency={currency} />}
    </div>
  );
}
