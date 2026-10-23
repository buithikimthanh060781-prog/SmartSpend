import { PLAN_STATUSES, type PlanStatus } from '@/lib/constants';
import { compareMoney, subtractMoney, sumMoney, toMoney, type NumericValue } from '@/lib/money';
import type { SsExpensePlan } from '@/types/db';

/** Giao dịch chi tiêu có liên kết kế hoạch (chỉ các cột cần thiết). */
export interface LinkedExpense {
  plan_id: string | null;
  amount: NumericValue;
}

export interface PlanReportRow {
  plan: SsExpensePlan;
  planned: number;
  /** Tổng THỰC CHI của các giao dịch liên kết với kế hoạch này. */
  actual: number;
  linkedCount: number;
  /** actual - planned. Dương = chi vượt dự kiến. */
  variance: number;
  /** Chi thực tế vượt dự kiến (chỉ xét kế hoạch chưa hủy). */
  overrun: boolean;
}

export interface PlanReport {
  total: number;
  byStatus: Record<PlanStatus, number>;
  /** Tổng tiền dự kiến của các kế hoạch KHÔNG bị hủy (kế hoạch đã hủy sẽ không diễn ra nên không cộng). */
  plannedAmount: number;
  /** Tổng thực chi của các giao dịch có plan_id liên kết với các kế hoạch trong phạm vi. */
  actualLinked: number;
  /** actualLinked - plannedAmount. */
  variance: number;
  overrunCount: number;
  rows: PlanReportRow[];
}

/**
 * Báo cáo kế hoạch. plannedAmount KHÔNG bao giờ được cộng vào chi tiêu thực tế; chỉ giao dịch thật có plan_id mới là thực chi.
 * PHẠM VI: `plans` là các kế hoạch có planned_date trong kỳ báo cáo; `linkedExpenses` phải là MỌI giao dịch liên kết với đúng
 * các kế hoạch đó (không giới hạn theo ngày giao dịch), để so sánh dự kiến và thực chi trên cùng một tập kế hoạch.
 */
export function buildPlanReport(plans: readonly SsExpensePlan[], linkedExpenses: readonly LinkedExpense[]): PlanReport {
  const byStatus = Object.fromEntries(PLAN_STATUSES.map((s) => [s, 0])) as Record<PlanStatus, number>;
  const spentBy = new Map<string, LinkedExpense[]>();
  for (const e of linkedExpenses) {
    if (e.plan_id === null) continue;
    (spentBy.get(e.plan_id) ?? spentBy.set(e.plan_id, []).get(e.plan_id)!).push(e);
  }

  const rows: PlanReportRow[] = plans.map((plan) => {
    if (plan.status in byStatus) byStatus[plan.status as PlanStatus] += 1;
    const linked = spentBy.get(plan.id) ?? [];
    const actual = sumMoney(linked, (e) => e.amount);
    const variance = subtractMoney(actual, plan.planned_amount);
    return {
      plan,
      planned: toMoney(plan.planned_amount),
      actual,
      linkedCount: linked.length,
      variance,
      overrun: plan.status !== 'cancelled' && compareMoney(actual, plan.planned_amount) > 0,
    };
  });

  const active = rows.filter((r) => r.plan.status !== 'cancelled');
  const plannedAmount = sumMoney(active, (r) => r.planned);
  const actualLinked = sumMoney(rows, (r) => r.actual);
  return {
    total: plans.length,
    byStatus,
    plannedAmount,
    actualLinked,
    variance: subtractMoney(actualLinked, plannedAmount),
    overrunCount: rows.filter((r) => r.overrun).length,
    rows,
  };
}
