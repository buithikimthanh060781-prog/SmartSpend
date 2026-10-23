import { PERIOD_TYPE_LABEL, type PeriodType } from '@/lib/budget';
import { formatMoney } from '@/lib/money';
import { periodLabel, type Period } from '@/lib/periods';
import { formatPercent, type BudgetEvaluation } from '@/services/budgetCalculation';

export type AlertKind = 'near_limit' | 'exhausted' | 'exceeded' | 'category_exceeded' | 'zero_budget_spent';

export interface BudgetAlert {
  /** Khóa ổn định cho một sự kiện: ngân sách + loại cảnh báo. Dùng để so sánh trước/sau và chống lặp. */
  key: string;
  kind: AlertKind;
  severity: 'warning' | 'danger';
  scope: 'total' | 'category';
  budgetId: string;
  categoryId: string | null;
  periodType: PeriodType;
  period: Period;
  evaluation: BudgetEvaluation;
}

/**
 * Cảnh báo cho MỘT ngân sách, tính từ dữ liệu thật. Không có ngân sách thì không có cảnh báo (không gọi hàm này).
 * - budget = 0 và có chi tiêu -> zero_budget_spent; budget = 0 chưa chi -> exhausted (hết hạn mức, chưa vượt)
 * - < 80% không cảnh báo; 80% đến < 100% near_limit; = 100% exhausted;
 * - > 100%: exceeded (ngân sách tổng) hoặc category_exceeded (ngân sách danh mục).
 */
export function alertFor(ev: BudgetEvaluation): BudgetAlert | null {
  const { budget, status } = ev;
  const scope = budget.category_id === null ? 'total' : 'category';

  let kind: AlertKind | null = null;
  if (status === 'warning') kind = 'near_limit';
  else if (status === 'exhausted') kind = 'exhausted';
  else if (status === 'exceeded') kind = ev.amount === 0 ? 'zero_budget_spent' : scope === 'category' ? 'category_exceeded' : 'exceeded';
  if (kind === null) return null;

  return {
    key: `${budget.id}:${kind}`,
    kind,
    severity: status === 'warning' || status === 'exhausted' ? 'warning' : 'danger',
    scope,
    budgetId: budget.id,
    categoryId: budget.category_id,
    periodType: budget.period_type as PeriodType,
    period: { type: budget.period_type as PeriodType, start: budget.period_start, endExclusive: budget.period_end },
    evaluation: ev,
  };
}

const SEVERITY_ORDER = { danger: 0, warning: 1 } as const;

/** Danh sách cảnh báo, nghiêm trọng nhất lên đầu, rồi theo mức sử dụng giảm dần. */
export function buildAlerts(evaluations: readonly BudgetEvaluation[]): BudgetAlert[] {
  return evaluations
    .map(alertFor)
    .filter((a): a is BudgetAlert => a !== null)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (b.evaluation.usagePercent ?? Number.POSITIVE_INFINITY) - (a.evaluation.usagePercent ?? Number.POSITIVE_INFINITY),
    );
}

/** Cảnh báo có SAU thao tác nhưng chưa có TRƯỚC thao tác: tức là thao tác vừa gây ra (chạm ngưỡng hoặc vượt ngưỡng mới). */
export function diffAlerts(before: readonly BudgetAlert[], after: readonly BudgetAlert[]): BudgetAlert[] {
  const beforeKeys = new Set(before.map((a) => a.key));
  return after.filter((a) => !beforeKeys.has(a.key));
}

export function alertTitle(alert: BudgetAlert, categoryName?: string): string {
  const where = alert.scope === 'total' ? 'Ngân sách tổng' : `Ngân sách ${categoryName ?? 'danh mục'}`;
  return `${where} · ${PERIOD_TYPE_LABEL[alert.periodType].toLowerCase()} · ${periodLabel(alert.period)}`;
}

export function alertMessage(alert: BudgetAlert, currency: string): string {
  const ev = alert.evaluation;
  switch (alert.kind) {
    case 'near_limit':
      return `Đã dùng ${formatPercent(ev.usagePercent)} hạn mức, còn ${formatMoney(ev.remaining, currency)}.`;
    case 'exhausted':
      return ev.amount === 0 ? 'Hạn mức bằng 0 (chưa phát sinh chi tiêu).' : `Đã dùng hết hạn mức ${formatMoney(ev.amount, currency)}.`;
    case 'exceeded':
    case 'category_exceeded':
      return `Đã vượt hạn mức ${formatMoney(ev.overspent, currency)} (${formatPercent(ev.usagePercent)}).`;
    case 'zero_budget_spent':
      return `Hạn mức bằng 0 nhưng đã chi ${formatMoney(ev.spent, currency)}.`;
  }
}
