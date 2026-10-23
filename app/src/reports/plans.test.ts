import { describe, expect, it } from 'vitest';
import { buildPlanReport } from '@/reports/plans';
import type { SsExpensePlan } from '@/types/db';

const plan = (id: string, planned: number | string, status: string): SsExpensePlan => ({
  id, user_id: 'u', category_id: 'c', title: id, planned_date: '2026-10-10', planned_amount: planned, status, note: null, created_at: '', updated_at: '',
});
const link = (plan_id: string | null, amount: number | string) => ({ plan_id, amount });

describe('báo cáo kế hoạch', () => {
  const plans = [plan('a', 1000, 'in_progress'), plan('b', 500, 'completed'), plan('c', 300, 'planned'), plan('d', 9999, 'cancelled')];
  const linked = [link('a', 600), link('a', 500), link('b', 500), link('c', 100)];
  const r = buildPlanReport(plans, linked);

  it('đếm theo trạng thái', () => {
    expect(r.total).toBe(4);
    expect(r.byStatus).toEqual({ planned: 1, in_progress: 1, completed: 1, cancelled: 1 });
  });

  it('tổng dự kiến không gồm kế hoạch đã hủy; thực chi chỉ gồm giao dịch liên kết', () => {
    expect(r.plannedAmount).toBe(1800); // 1000 + 500 + 300
    expect(r.actualLinked).toBe(1700); // 1100 + 500 + 100
    expect(r.variance).toBe(-100); // actual - planned
  });

  it('planVariance = thực chi liên kết - dự kiến, theo từng kế hoạch', () => {
    const a = r.rows.find((x) => x.plan.id === 'a')!;
    expect(a).toMatchObject({ planned: 1000, actual: 1100, linkedCount: 2, variance: 100, overrun: true });
    const c = r.rows.find((x) => x.plan.id === 'c')!;
    expect(c).toMatchObject({ actual: 100, variance: -200, overrun: false });
  });

  it('bằng đúng dự kiến không phải là vượt; chỉ vượt khi lớn hơn', () => {
    const b = r.rows.find((x) => x.plan.id === 'b')!;
    expect(b).toMatchObject({ actual: 500, variance: 0, overrun: false });
    expect(r.overrunCount).toBe(1);
  });

  it('kế hoạch đã hủy không được tính là vượt dù có số liệu', () => {
    const d = r.rows.find((x) => x.plan.id === 'd')!;
    expect(d.overrun).toBe(false);
    const bad = buildPlanReport([plan('x', 100, 'cancelled')], [link('x', 500)]);
    expect(bad.overrunCount).toBe(0);
  });

  it('planned_amount KHÔNG được cộng vào chi tiêu thực tế: kế hoạch chưa có giao dịch có thực chi = 0', () => {
    const r2 = buildPlanReport([plan('n', 5_000_000, 'planned')], []);
    expect(r2.actualLinked).toBe(0);
    expect(r2.rows[0]).toMatchObject({ actual: 0, linkedCount: 0, variance: -5_000_000, overrun: false });
  });

  it('bỏ qua giao dịch không liên kết kế hoạch', () => {
    const r2 = buildPlanReport([plan('a', 100, 'planned')], [link(null, 999), link('a', 10)]);
    expect(r2.actualLinked).toBe(10);
  });

  it('không có kế hoạch: báo cáo rỗng hợp lệ', () => {
    expect(buildPlanReport([], [])).toMatchObject({ total: 0, plannedAmount: 0, actualLinked: 0, variance: 0, overrunCount: 0, rows: [] });
  });

  it('cộng thập phân chính xác', () => {
    const r2 = buildPlanReport([plan('a', '0.3', 'planned')], [link('a', '0.1'), link('a', '0.2')]);
    expect(r2.rows[0]).toMatchObject({ actual: 0.3, variance: 0, overrun: false });
  });
});
