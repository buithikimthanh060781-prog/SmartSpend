import { describe, expect, it } from 'vitest';
import { periodContaining } from '@/lib/periods';
import { AlertSession, getAlertSession, resetAlertSessions } from '@/services/alertSession';
import { alertFor, alertMessage, buildAlerts, diffAlerts } from '@/services/budgetAlerts';
import { evaluateBudget, type ExpenseLite } from '@/services/budgetCalculation';
import type { SsBudget } from '@/types/db';

function budget(amount: number, category: string | null = null, id = category ?? 'total'): SsBudget {
  const p = periodContaining('monthly', '2026-10-15');
  return { id, user_id: 'u', category_id: category, period_type: 'monthly', period_start: p.start, period_end: p.endExclusive, amount, created_at: '', updated_at: '' };
}
const spend = (amount: number, category = 'food'): ExpenseLite => ({ user_id: 'u', category_id: category, amount, expense_date: '2026-10-10' });
const alertOf = (b: SsBudget, expenses: ExpenseLite[]) => alertFor(evaluateBudget(b, expenses));

describe('các loại cảnh báo (tính từ dữ liệu thật)', () => {
  it('dưới 80%: không cảnh báo', () => {
    expect(alertOf(budget(1000), [spend(799)])).toBeNull();
  });
  it('từ 80% đến dưới 100%: sắp hết ngân sách', () => {
    expect(alertOf(budget(1000), [spend(800)])?.kind).toBe('near_limit');
    expect(alertOf(budget(1000), [spend(999.99)])?.kind).toBe('near_limit');
  });
  it('đúng 100%: hết ngân sách', () => {
    expect(alertOf(budget(1000), [spend(1000)])?.kind).toBe('exhausted');
  });
  it('trên 100%: vượt ngân sách tổng', () => {
    const a = alertOf(budget(1000), [spend(1001)]);
    expect(a).toMatchObject({ kind: 'exceeded', severity: 'danger', scope: 'total' });
  });
  it('trên 100% của ngân sách danh mục: chi tiêu vượt ngân sách danh mục', () => {
    const a = alertOf(budget(100, 'food'), [spend(150, 'food')]);
    expect(a).toMatchObject({ kind: 'category_exceeded', severity: 'danger', scope: 'category', categoryId: 'food' });
  });
  it('ngân sách bằng 0 nhưng phát sinh chi tiêu', () => {
    expect(alertOf(budget(0), [spend(5)])?.kind).toBe('zero_budget_spent');
  });
  it('ngân sách bằng 0, chưa chi: hết hạn mức (cảnh báo nhẹ), không phải vượt', () => {
    const a = alertOf(budget(0), []);
    expect(a?.kind).toBe('exhausted');
    expect(a?.severity).toBe('warning');
  });
  it('không có ngân sách thì không có cảnh báo nào', () => {
    expect(buildAlerts([])).toEqual([]);
  });
  it('khóa cảnh báo gồm ngân sách và loại', () => {
    expect(alertOf(budget(1000, null, 'b1'), [spend(900)])?.key).toBe('b1:near_limit');
  });
  it('sắp xếp: nghiêm trọng trước, rồi mức sử dụng cao trước', () => {
    const evs = [
      evaluateBudget(budget(1000, null, 'warn'), [spend(850)]),
      evaluateBudget(budget(100, 'food', 'over'), [spend(300, 'food')]),
      evaluateBudget(budget(1000, 'taxi', 'warn2'), [spend(950, 'taxi')]),
    ];
    expect(buildAlerts(evs).map((a) => a.budgetId)).toEqual(['over', 'warn2', 'warn']);
  });
  it('thông điệp lấy số liệu thật', () => {
    const a = alertOf(budget(1000), [spend(1250)]);
    expect(alertMessage(a!, 'VND')).toMatch(/vượt hạn mức/);
    expect(alertMessage(a!, 'VND')).toMatch(/250/);
  });
});

describe('diffAlerts: chỉ cảnh báo những gì thao tác vừa gây ra', () => {
  it('chạm 80% bởi khoản chi mới', () => {
    const before = buildAlerts([evaluateBudget(budget(1000), [spend(700)])]);
    const after = buildAlerts([evaluateBudget(budget(1000), [spend(700), spend(100)])]);
    expect(diffAlerts(before, after).map((a) => a.kind)).toEqual(['near_limit']);
  });
  it('vượt từ near_limit sang exceeded: báo cảnh báo vượt mới, không báo lại near_limit', () => {
    const before = buildAlerts([evaluateBudget(budget(1000), [spend(900)])]);
    const after = buildAlerts([evaluateBudget(budget(1000), [spend(900), spend(200)])]);
    expect(diffAlerts(before, after).map((a) => a.kind)).toEqual(['exceeded']);
  });
  it('đã ở trạng thái cảnh báo từ trước và không đổi: không có sự kiện mới', () => {
    const state = buildAlerts([evaluateBudget(budget(1000), [spend(850)])]);
    expect(diffAlerts(state, state)).toEqual([]);
  });
});

describe('cảnh báo không lặp toast', () => {
  const nearBefore = buildAlerts([evaluateBudget(budget(1000), [spend(700)])]);
  const nearAfter = buildAlerts([evaluateBudget(budget(1000), [spend(700), spend(150)])]);

  it('cùng một sự kiện chỉ báo một lần: thao tác lặp ngay sau đó (điều kiện vẫn còn) không báo lại', () => {
    const s = new AlertSession();
    expect(s.resolve(nearBefore, nearAfter)).toHaveLength(1);
    // lần ghi kế tiếp: mốc "trước" đã chứa cảnh báo vì thao tác đầu đã được lưu
    expect(s.resolve(nearAfter, nearAfter)).toHaveLength(0);
    expect(s.resolve(nearAfter, nearAfter)).toHaveLength(0);
  });

  it('thao tác tiếp theo khi điều kiện vẫn còn (before đã có cảnh báo) không báo lại', () => {
    const s = new AlertSession();
    s.resolve(nearBefore, nearAfter);
    expect(s.resolve(nearAfter, nearAfter)).toHaveLength(0);
  });

  it('khi điều kiện đã hết rồi chạm lại thì là sự kiện mới và được báo lại', () => {
    const s = new AlertSession();
    expect(s.resolve(nearBefore, nearAfter)).toHaveLength(1);
    // người dùng xóa bớt chi tiêu: trước thao tác kế tiếp, ngân sách đã dưới 80% (before rỗng)
    expect(s.resolve([], nearAfter)).toHaveLength(1);
  });

  it('không có cảnh báo mới thì không báo gì', () => {
    expect(new AlertSession().resolve([], [])).toEqual([]);
  });

  it('phiên của mỗi người dùng tách biệt và bị xóa khi đổi tài khoản', () => {
    resetAlertSessions();
    const a = getAlertSession('A');
    expect(a.resolve(nearBefore, nearAfter)).toHaveLength(1);
    expect(getAlertSession('A')).toBe(a); // cùng người dùng dùng chung một phiên
    expect(getAlertSession('B')).not.toBe(a); // B có phiên riêng, không bị ảnh hưởng bởi A
    expect(getAlertSession('B').resolve(nearBefore, nearAfter)).toHaveLength(1);
    resetAlertSessions();
    expect(getAlertSession('A')).not.toBe(a); // đổi tài khoản/đăng xuất: phiên cũ bị bỏ
  });
});
