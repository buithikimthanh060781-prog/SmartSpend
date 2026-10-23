import { PAYMENT_METHOD_LABEL, PLAN_STATUS_LABEL, INCOME_STATUS_LABEL, type IncomeStatus, type PaymentMethod, type PlanStatus } from '@/lib/constants';
import { PERIOD_TYPE_LABEL, type PeriodType } from '@/lib/budget';
import { addDays, formatDate } from '@/lib/dates';
import { sumMoney, toMoney } from '@/lib/money';
import { periodLabel } from '@/lib/periods';
import type { ExportColumn, KeyValueRow, KeyValueSheet, SheetSpec, TableSheet, TotalsRow } from '@/export/types';
import type { CategoryReport } from '@/reports/categories';
import type { PeriodComparison } from '@/reports/periodComparison';
import { UNKNOWN_CATEGORY_NAME } from '@/reports/categories';
import type { PlanReport } from '@/reports/plans';
import type { Bucket } from '@/reports/series';
import type { DateRange } from '@/reports/ranges';
import type { FinancialSummary } from '@/reports/summary';
import { STATUS_LABEL, type BudgetEvaluation } from '@/services/budgetCalculation';
import type { NumericValue } from '@/lib/money';

/**
 * Cột tối thiểu mà sheet Thu nhập/Chi tiêu cần (cho phép dùng cả dòng đầy đủ lẫn dòng báo cáo rút gọn).
 * `amount` là NumericValue: giá trị hỏng làm việc xuất thất bại (không bị ghi thành 0).
 */
export interface IncomeExportRow {
  income_date: string;
  category_id: string;
  description: string;
  amount: NumericValue;
  status: string;
  note: string | null;
}

/** Ghi chú phạm vi hiển thị ở đầu mỗi sheet để người đọc biết dữ liệu thuộc bộ lọc nào. */
export const rangeText = (r: DateRange): string => `${formatDate(r.start)} – ${formatDate(addDays(r.endExclusive, -1))}`;

type NameOf = (categoryId: string) => string;

/** Dòng mô tả bộ lọc đang áp dụng, ghi ở đầu sheet để người đọc biết dữ liệu thuộc phạm vi nào. */
export function describeFilters(parts: Array<[label: string, value: string | undefined | null]>): string {
  const active = parts.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([l, v]) => `${l}: ${v}`);
  return active.length > 0 ? `Bộ lọc: ${active.join('; ')}.` : 'Không áp dụng bộ lọc (toàn bộ dữ liệu).';
}

export function categoryNamer(categories: ReadonlyArray<{ id: string; name: string }>): NameOf {
  const m = new Map(categories.map((c) => [c.id, c.name]));
  return (id) => m.get(id) ?? UNKNOWN_CATEGORY_NAME;
}

/** Cột/tổng của sheet Thu nhập. Tổng thực nhận và tổng dự kiến được tách riêng (không cộng chung). */
export function incomesSheet(rows: readonly IncomeExportRow[], nameOf: NameOf, subtitle: string): TableSheet<IncomeExportRow> {
  const columns: ExportColumn<IncomeExportRow>[] = [
    { header: 'Ngày', kind: 'date', width: 13, value: (r) => r.income_date },
    { header: 'Danh mục', kind: 'text', width: 22, value: (r) => nameOf(r.category_id) },
    { header: 'Mô tả', kind: 'text', width: 36, value: (r) => r.description },
    { header: 'Số tiền', kind: 'money', width: 18, value: (r) => toMoney(r.amount) },
    { header: 'Trạng thái', kind: 'text', width: 14, value: (r) => INCOME_STATUS_LABEL[r.status as IncomeStatus] ?? r.status },
    { header: 'Ghi chú', kind: 'text', width: 36, value: (r) => r.note },
  ];
  const received = sumMoney(rows.filter((r) => r.status === 'received'), (r) => r.amount);
  const expected = sumMoney(rows.filter((r) => r.status === 'expected'), (r) => r.amount);
  return {
    type: 'table',
    name: 'Thu nhập',
    title: 'Thu nhập',
    subtitle,
    columns,
    rows: [...rows],
    totals: [
      ['Tổng thực nhận (Đã nhận)', null, null, received, null, null],
      ['Tổng dự kiến (không tính vào thực nhận)', null, null, expected, null, null],
    ],
  };
}

export interface ExpenseExportRow {
  expense_date: string;
  category_id: string;
  description: string;
  amount: NumericValue;
  payment_method: string;
  plan_id: string | null;
  note: string | null;
  planTitle?: string;
}

export function expensesSheet(rows: readonly ExpenseExportRow[], nameOf: NameOf, subtitle: string): TableSheet<ExpenseExportRow> {
  const columns: ExportColumn<ExpenseExportRow>[] = [
    { header: 'Ngày', kind: 'date', width: 13, value: (r) => r.expense_date },
    { header: 'Danh mục', kind: 'text', width: 22, value: (r) => nameOf(r.category_id) },
    { header: 'Mô tả', kind: 'text', width: 36, value: (r) => r.description },
    { header: 'Số tiền', kind: 'money', width: 18, value: (r) => toMoney(r.amount) },
    { header: 'Phương thức', kind: 'text', width: 16, value: (r) => PAYMENT_METHOD_LABEL[r.payment_method as PaymentMethod] ?? r.payment_method },
    { header: 'Kế hoạch', kind: 'text', width: 16, value: (r) => (r.plan_id ? 'Trong kế hoạch' : 'Ngoài kế hoạch') },
    { header: 'Tên kế hoạch', kind: 'text', width: 26, value: (r) => r.planTitle ?? null },
    { header: 'Ghi chú', kind: 'text', width: 36, value: (r) => r.note },
  ];
  return {
    type: 'table',
    name: 'Chi tiêu',
    title: 'Chi tiêu',
    subtitle,
    columns,
    rows: [...rows],
    totals: [['Tổng chi', null, null, sumMoney(rows, (r) => r.amount), null, null, null, null]],
  };
}

export function plansSheet(report: PlanReport, nameOf: NameOf, subtitle: string): TableSheet<PlanReport['rows'][number]> {
  type Row = PlanReport['rows'][number];
  const columns: ExportColumn<Row>[] = [
    { header: 'Tên kế hoạch', kind: 'text', width: 30, value: (r) => r.plan.title },
    { header: 'Danh mục', kind: 'text', width: 22, value: (r) => nameOf(r.plan.category_id) },
    { header: 'Ngày dự kiến', kind: 'date', width: 14, value: (r) => r.plan.planned_date },
    { header: 'Trạng thái', kind: 'text', width: 18, value: (r) => PLAN_STATUS_LABEL[r.plan.status as PlanStatus] ?? r.plan.status },
    { header: 'Dự kiến', kind: 'money', width: 18, value: (r) => r.planned },
    { header: 'Thực chi liên kết', kind: 'money', width: 18, value: (r) => r.actual },
    { header: 'Chênh lệch (thực chi - dự kiến)', kind: 'money', width: 22, value: (r) => r.variance },
    { header: 'Số giao dịch', kind: 'int', width: 12, value: (r) => r.linkedCount },
    { header: 'Ghi chú', kind: 'text', width: 36, value: (r) => r.plan.note },
  ];
  const totals: TotalsRow[] = [
    ['Tổng (không gồm kế hoạch đã hủy ở cột Dự kiến)', null, null, null, report.plannedAmount, report.actualLinked, report.variance, report.rows.reduce((n, r) => n + r.linkedCount, 0), null],
  ];
  return { type: 'table', name: 'Kế hoạch', title: 'Kế hoạch chi tiêu', subtitle, columns, rows: report.rows, totals };
}

/** Sheet Ngân sách. KHÔNG có hàng tổng: các hạn mức ngày/tuần/tháng/danh mục độc lập, cộng lại sẽ cho số vô nghĩa. */
export function budgetsSheet(evaluations: readonly BudgetEvaluation[], nameOf: NameOf, subtitle: string): TableSheet<BudgetEvaluation> {
  const columns: ExportColumn<BudgetEvaluation>[] = [
    { header: 'Loại kỳ', kind: 'text', width: 10, value: (e) => PERIOD_TYPE_LABEL[e.budget.period_type as PeriodType] ?? e.budget.period_type },
    { header: 'Kỳ', kind: 'text', width: 26, value: (e) => periodLabel({ type: e.budget.period_type as PeriodType, start: e.budget.period_start, endExclusive: e.budget.period_end }) },
    { header: 'Bắt đầu', kind: 'date', width: 13, value: (e) => e.budget.period_start },
    { header: 'Kết thúc (không gồm)', kind: 'date', width: 18, value: (e) => e.budget.period_end },
    { header: 'Phạm vi', kind: 'text', width: 22, value: (e) => (e.budget.category_id === null ? 'Tổng chi tiêu' : nameOf(e.budget.category_id)) },
    { header: 'Hạn mức', kind: 'money', width: 18, value: (e) => e.amount },
    { header: 'Đã chi', kind: 'money', width: 18, value: (e) => e.spent },
    { header: 'Còn lại', kind: 'money', width: 18, value: (e) => e.remaining },
    { header: 'Vượt', kind: 'money', width: 16, value: (e) => e.overspent },
    { header: 'Tỷ lệ sử dụng (%)', kind: 'percent', width: 16, value: (e) => e.usagePercent },
    { header: 'Trạng thái', kind: 'text', width: 18, value: (e) => STATUS_LABEL[e.status] },
  ];
  return {
    type: 'table',
    name: 'Ngân sách',
    title: 'Ngân sách',
    subtitle: `${subtitle} Các hạn mức độc lập, không cộng gộp.`,
    columns,
    rows: [...evaluations],
  };
}

export function categoriesSheet(report: CategoryReport, subtitle: string, withComparison: boolean): TableSheet<CategoryReport['rows'][number]> {
  type Row = CategoryReport['rows'][number];
  const columns: ExportColumn<Row>[] = [
    { header: 'Danh mục', kind: 'text', width: 26, value: (r) => r.name },
    { header: 'Tình trạng danh mục', kind: 'text', width: 18, value: (r) => (!r.known ? 'Không còn trong danh sách' : r.isActive ? 'Đang dùng' : 'Đã ngừng hoạt động') },
    { header: 'Tổng chi', kind: 'money', width: 18, value: (r) => r.total },
    { header: 'Số giao dịch', kind: 'int', width: 12, value: (r) => r.count },
    { header: 'Tỷ trọng (%)', kind: 'percent', width: 14, value: (r) => r.sharePercent },
    { header: 'Trung bình mỗi giao dịch', kind: 'money', width: 22, value: (r) => r.avgPerTransaction },
    ...(withComparison
      ? ([
          { header: 'Kỳ trước', kind: 'money', width: 18, value: (r) => r.change?.previous ?? null },
          { header: 'Thay đổi', kind: 'money', width: 18, value: (r) => r.change?.delta ?? null },
          { header: 'Thay đổi (%)', kind: 'percent', width: 14, value: (r) => r.change?.changePercent ?? null },
        ] as ExportColumn<Row>[])
      : []),
  ];
  const totals: TotalsRow[] = [['Tổng cộng', null, report.total, report.count, report.rows.length > 0 ? 100 : null, null, ...(withComparison ? [null, null, null] : [])]];
  return { type: 'table', name: 'Chi tiêu theo danh mục', title: 'Chi tiêu theo danh mục', subtitle, columns, rows: report.rows, totals };
}

/** Sheet thu/chi theo thời gian: mọi mốc đều có mặt (mốc không có giao dịch = 0). */
export function seriesSheet(buckets: readonly Bucket[], granularityLabel: string, subtitle: string): TableSheet<Bucket> {
  const columns: ExportColumn<Bucket>[] = [
    { header: 'Mốc bắt đầu', kind: 'date', width: 14, value: (b) => b.start },
    { header: 'Mốc kết thúc (không gồm)', kind: 'date', width: 22, value: (b) => b.endExclusive },
    { header: 'Thu nhập thực nhận', kind: 'money', width: 20, value: (b) => b.income },
    { header: 'Chi tiêu thực tế', kind: 'money', width: 18, value: (b) => b.expense },
    { header: 'Chênh lệch', kind: 'money', width: 18, value: (b) => b.net },
  ];
  return {
    type: 'table',
    name: 'Theo thời gian',
    title: `Thu nhập và chi tiêu ${granularityLabel.toLowerCase()}`,
    subtitle,
    columns,
    rows: [...buckets],
    totals: [['Tổng cộng', null, sumMoney(buckets, (b) => b.income), sumMoney(buckets, (b) => b.expense), sumMoney(buckets, (b) => b.net)]],
  };
}

function kv(label: string, value: number | string | null, kind: KeyValueRow['kind'], note?: string): KeyValueRow {
  return { label, value, kind, note };
}

/** Sheet Tổng quan (chỉ tiêu - giá trị). Giá trị không áp dụng (mẫu số 0) được ghi rõ bằng chữ thay vì 0 hoặc để trống. */
export function overviewSheet(range: DateRange, s: FinancialSummary, comparison: PeriodComparison | null, generatedOn: string): KeyValueSheet {
  const na = 'Không áp dụng';
  const rows: KeyValueRow[] = [
    kv('Kỳ báo cáo', rangeText(range), 'text', `Xuất ngày ${formatDate(generatedOn)}`),
    kv('Thu nhập thực nhận', s.receivedIncome, 'money', 'Chỉ thu nhập có trạng thái Đã nhận'),
    kv('Thu nhập dự kiến', s.expectedIncome, 'money', 'KHÔNG tính vào thu nhập thực nhận'),
    kv('Tổng chi tiêu thực tế', s.actualExpense, 'money', 'Chỉ giao dịch chi tiêu thật; kế hoạch chưa thực hiện không được cộng'),
    kv('Chênh lệch thu chi', s.netCashFlow, 'money', 'Thu nhập thực nhận - chi tiêu thực tế'),
    kv('Tỷ lệ chi tiêu / thu nhập (%)', s.expenseToIncomeRatio ?? na, 'percent', s.expenseToIncomeRatio === null ? 'Chưa có thu nhập thực nhận trong kỳ' : undefined),
    kv('Chi trong kế hoạch', s.plannedExpense, 'money', 'Giao dịch có liên kết kế hoạch'),
    kv('Chi ngoài kế hoạch', s.unplannedExpense, 'money', 'Giao dịch không liên kết kế hoạch'),
    kv('Tỷ trọng chi ngoài kế hoạch (%)', s.unplannedExpenseRatio ?? na, 'percent', s.unplannedExpenseRatio === null ? 'Chưa có chi tiêu trong kỳ' : undefined),
    kv('Số ngày có phát sinh chi tiêu', s.daysWithExpense, 'int'),
    kv('Số ngày đã trôi qua trong kỳ', s.elapsedDays, 'int', 'Kỳ chưa kết thúc chỉ tính đến hết hôm nay'),
    kv('Chi tiêu trung bình mỗi ngày', s.avgExpensePerDay === null ? na : s.avgExpensePerDay, 'money', 'Tổng chi / số ngày đã trôi qua'),
  ];
  if (comparison) {
    const c = comparison;
    rows.push(
      kv('So sánh kỳ trước', `${rangeText(c.spec.previous)} (cùng ${c.spec.days} ngày)`, 'text'),
      kv('Thu nhập thực nhận: thay đổi', c.receivedIncome.delta, 'money', c.receivedIncome.changePercent === null ? 'Kỳ trước bằng 0, không tính tỷ lệ' : `${c.receivedIncome.changePercent.toFixed(1)}%`),
      kv('Chi tiêu thực tế: thay đổi', c.actualExpense.delta, 'money', c.actualExpense.changePercent === null ? 'Kỳ trước bằng 0, không tính tỷ lệ' : `${c.actualExpense.changePercent.toFixed(1)}%`),
      kv('Chênh lệch thu chi kỳ trước', c.previous.netCashFlow, 'money'),
    );
  }
  return { type: 'kv', name: 'Tổng quan', title: 'Báo cáo tài chính Smart Spend', subtitle: `Khoảng thời gian: ${rangeText(range)}`, rows };
}

export interface SummaryWorkbookInput {
  range: DateRange;
  generatedOn: string;
  summary: FinancialSummary;
  comparison: PeriodComparison | null;
  incomes: readonly IncomeExportRow[];
  expenses: readonly ExpenseExportRow[];
  planReport: PlanReport;
  budgetEvaluations: readonly BudgetEvaluation[];
  budgetNote: string;
  categoryReport: CategoryReport;
  nameOf: NameOf;
}

/** Sáu sheet của báo cáo tổng hợp: Tổng quan, Thu nhập, Chi tiêu, Kế hoạch, Ngân sách, Chi tiêu theo danh mục. */
export function summaryWorkbookSheets(i: SummaryWorkbookInput): SheetSpec[] {
  const scope = `Khoảng thời gian: ${rangeText(i.range)}.`;
  return [
    overviewSheet(i.range, i.summary, i.comparison, i.generatedOn),
    incomesSheet(i.incomes, i.nameOf, scope),
    expensesSheet(i.expenses, i.nameOf, scope),
    plansSheet(i.planReport, i.nameOf, `${scope} Kế hoạch có ngày dự kiến trong khoảng này; thực chi gồm mọi giao dịch liên kết với các kế hoạch đó.`),
    budgetsSheet(i.budgetEvaluations, i.nameOf, i.budgetNote),
    categoriesSheet(i.categoryReport, scope, Boolean(i.comparison)),
  ];
}


