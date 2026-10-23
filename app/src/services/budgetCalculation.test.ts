import { describe, expect, it } from 'vitest';
import { compareMoney, comparePercent, sumMoney } from '@/lib/money';
import { periodContaining } from '@/lib/periods';
import {
  computeSpent,
  evaluateBudget,
  evaluateBudgets,
  expensesOfBudget,
  formatPercent,
  isMajorChange,
  statusOf,
  type ExpenseLite,
} from '@/services/budgetCalculation';
import type { SsBudget } from '@/types/db';

const U = 'u1';

function budget(type: 'daily' | 'weekly' | 'monthly', anchor: string, amount: number | string, category: string | null = null, id = `${type}-${category ?? 'total'}`): SsBudget {
  const p = periodContaining(type, anchor);
  return { id, user_id: U, category_id: category, period_type: type, period_start: p.start, period_end: p.endExclusive, amount, created_at: '', updated_at: '' };
}

const exp = (date: string, amount: number | string, category = 'food', user = U): ExpenseLite => ({ user_id: user, category_id: category, amount, expense_date: date });

describe('tổng thực chi', () => {
  it('ngân sách ngày: chỉ tính đúng ngày, endExclusive không được tính', () => {
    const b = budget('daily', '2026-10-18', 1000);
    const list = [exp('2026-10-17', 1), exp('2026-10-18', 100), exp('2026-10-18', 50.5), exp('2026-10-19', 999)];
    expect(computeSpent(b, list)).toBe(150.5);
  });

  it('ngân sách tuần ISO: gồm Thứ Hai, gồm Chủ Nhật, loại Thứ Hai kế tiếp', () => {
    const b = budget('weekly', '2026-10-28', 1000); // tuần 26/10 - 01/11
    const list = [exp('2026-10-25', 1), exp('2026-10-26', 10), exp('2026-11-01', 20), exp('2026-11-02', 999)];
    expect(computeSpent(b, list)).toBe(30);
  });

  it('ngân sách tháng: ngày 01 tính, ngày 01 tháng sau không tính', () => {
    const b = budget('monthly', '2026-10-15', 1000);
    expect(computeSpent(b, [exp('2026-09-30', 1), exp('2026-10-01', 5), exp('2026-10-31', 7), exp('2026-11-01', 999)])).toBe(12);
  });

  it('tháng 2 năm nhuận: 29/02 tính vào tháng 2, 01/03 thì không', () => {
    const feb = budget('monthly', '2028-02-10', 1000);
    expect(computeSpent(feb, [exp('2028-02-29', 40), exp('2028-03-01', 999)])).toBe(40);
  });

  it('tháng 2 thường (28 ngày): 28/02 tính, 01/03 không', () => {
    const feb = budget('monthly', '2026-02-10', 1000);
    expect(computeSpent(feb, [exp('2026-02-28', 3), exp('2026-03-01', 999)])).toBe(3);
  });

  it('tuần giao hai tháng: ngân sách tuần gồm cả ngày cuối tháng 10 và đầu tháng 11', () => {
    const week = budget('weekly', '2026-10-31', 1000);
    expect(computeSpent(week, [exp('2026-10-31', 100), exp('2026-11-01', 50)])).toBe(150);
    // còn ngân sách tháng 10 / tháng 11 chỉ thấy phần của mình
    const oct = budget('monthly', '2026-10-31', 1000);
    const nov = budget('monthly', '2026-11-01', 1000);
    const list = [exp('2026-10-31', 100), exp('2026-11-01', 50)];
    expect(computeSpent(oct, list)).toBe(100);
    expect(computeSpent(nov, list)).toBe(50);
  });

  it('ngân sách danh mục chỉ tính đúng danh mục; ngân sách tổng tính tất cả danh mục', () => {
    const list = [exp('2026-10-18', 100, 'food'), exp('2026-10-18', 40, 'taxi'), exp('2026-10-18', 10, 'rent')];
    expect(computeSpent(budget('daily', '2026-10-18', 1000, 'food'), list)).toBe(100);
    expect(computeSpent(budget('daily', '2026-10-18', 1000, 'taxi'), list)).toBe(40);
    expect(computeSpent(budget('daily', '2026-10-18', 1000, null), list)).toBe(150);
  });

  it('không tính chi tiêu của người dùng khác', () => {
    const b = budget('daily', '2026-10-18', 1000);
    expect(computeSpent(b, [exp('2026-10-18', 100), exp('2026-10-18', 900, 'food', 'someone-else')])).toBe(100);
  });

  it('tính cả chi trong và ngoài kế hoạch; engine không có đường nào nhận planned_amount', () => {
    // ExpenseLite không có plan_id/planned_amount: cả hai loại chi đều chỉ là một dòng chi tiêu.
    const b = budget('monthly', '2026-10-01', 1000);
    expect(expensesOfBudget(b, [exp('2026-10-05', 10), exp('2026-10-06', 20)])).toHaveLength(2);
    expect(computeSpent(b, [{ category_id: 'x', amount: 10, expense_date: '2026-10-05' }, { category_id: 'x', amount: 20, expense_date: '2026-10-06' }])).toBe(30);
  });

  it('cộng thập phân chính xác', () => {
    const b = budget('monthly', '2026-10-01', 1000);
    expect(computeSpent(b, [exp('2026-10-01', 0.1), exp('2026-10-02', 0.2)])).toBe(0.3);
  });

  it('không có chi tiêu = 0', () => {
    expect(computeSpent(budget('daily', '2026-10-18', 100), [])).toBe(0);
  });
});

describe('công thức và trạng thái', () => {
  it('remaining, overspent, usagePercent', () => {
    const ev = evaluateBudget(budget('daily', '2026-10-18', 1000), [exp('2026-10-18', 250)]);
    expect(ev).toMatchObject({ amount: 1000, spent: 250, remaining: 750, overspent: 0, usagePercent: 25, status: 'safe' });
    const over = evaluateBudget(budget('daily', '2026-10-18', 1000), [exp('2026-10-18', 1250.5)]);
    expect(over).toMatchObject({ remaining: -250.5, overspent: 250.5, status: 'exceeded' });
  });

  it('đúng 80% là warning; dưới 80% là safe', () => {
    expect(statusOf(1000, 799.99)).toBe('safe');
    expect(statusOf(1000, 800)).toBe('warning');
    expect(statusOf('1000.00', '800.0')).toBe('warning');
    expect(statusOf(1000, 999.99)).toBe('warning');
  });

  it('đúng 100% là exhausted; vượt 100% là exceeded', () => {
    expect(statusOf(1000, 1000)).toBe('exhausted');
    expect(statusOf(1000, 1000.01)).toBe('exceeded');
    expect(statusOf(1000, 5000)).toBe('exceeded');
  });

  it('không làm tròn phần trăm trước khi xác định trạng thái', () => {
    // 79,9999% làm tròn thành 80% nhưng phải vẫn là safe
    expect(statusOf(1_000_000, 799_999.9)).toBe('safe');
    // 99,99999% làm tròn thành 100% nhưng phải vẫn là warning
    expect(statusOf(1_000_000, 999_999.99)).toBe('warning');
    // 100,00001% phải là exceeded
    expect(statusOf(1_000_000, 1_000_000.1)).toBe('exceeded');
    // tổng thập phân tính chính xác (0.1 + 0.2 = 0.3) chạm đúng 100%
    expect(statusOf(0.3, sumMoney([0.1, 0.2], (r) => r))).toBe('exhausted');
  });

  it('số dấu phẩy động nhiễu (0.30000000000000004) bị từ chối thay vì làm tròn âm thầm', () => {
    expect(() => statusOf(0.3, 0.1 + 0.2)).toThrow(/quá nhiều chữ số thập phân/);
  });

  it('hiển thị phần trăm làm tròn xuống, không bao giờ hiện 100% khi chưa chạm', () => {
    expect(formatPercent(99.96)).toBe('99,9%');
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(null)).toBe('—');
  });

  it('ngân sách bằng 0: chưa chi = hết hạn mức nhưng chưa vượt; có chi = vượt; không chia cho 0', () => {
    const none = evaluateBudget(budget('daily', '2026-10-18', 0), []);
    expect(none).toMatchObject({ amount: 0, spent: 0, remaining: 0, overspent: 0, usagePercent: null, status: 'exhausted' });
    const spent = evaluateBudget(budget('daily', '2026-10-18', 0), [exp('2026-10-18', 5)]);
    expect(spent).toMatchObject({ amount: 0, spent: 5, remaining: -5, overspent: 5, usagePercent: null, status: 'exceeded' });
    expect(Number.isFinite(none.remaining)).toBe(true);
  });

  it('so sánh số học chính xác', () => {
    expect(compareMoney('0.30', 0.3)).toBe(0);
    expect(compareMoney(1, 2)).toBe(-1);
    expect(comparePercent(80, 100, 80)).toBe(0);
    expect(comparePercent('79.99', 100, 80)).toBe(-1);
  });
});

describe('các ngân sách độc lập, không cộng gộp', () => {
  const list = [exp('2026-10-26', 300, 'food'), exp('2026-10-28', 200, 'food'), exp('2026-10-28', 100, 'taxi')];
  const budgets = [
    budget('daily', '2026-10-28', 1000, null),
    budget('weekly', '2026-10-28', 1000, null),
    budget('monthly', '2026-10-28', 1000, null),
    budget('monthly', '2026-10-28', 500, 'food'),
  ];

  it('một khoản chi được tính vào từng ngân sách tương ứng, mỗi cái một tổng riêng', () => {
    const [day, week, month, food] = evaluateBudgets(budgets, list);
    expect(day.spent).toBe(300); // 28/10: 200 food + 100 taxi
    expect(week.spent).toBe(600); // cả tuần: 300 + 200 + 100
    expect(month.spent).toBe(600);
    expect(food.spent).toBe(500); // food trong tháng: 300 + 200
  });

  it('tổng các thực chi của các ngân sách KHÔNG bằng tổng chi thực tế (không được cộng gộp)', () => {
    const total = evaluateBudgets(budgets, list).reduce((s, e) => s + e.spent, 0);
    expect(total).toBe(2000); // chỉ để chứng minh: cộng gộp sẽ cho số sai (chi thực tế chỉ 600)
    expect(total).not.toBe(600);
  });

  it('trạng thái mỗi ngân sách độc lập với nhau', () => {
    const [day, week, month, food] = evaluateBudgets(budgets, list);
    expect([day.status, week.status, month.status, food.status]).toEqual(['safe', 'safe', 'safe', 'exhausted']);
  });
});

describe('sửa hạn mức: khi nào cần xác nhận', () => {
  it('không đổi thì không cần', () => expect(isMajorChange(1000, 1000, 300)).toBe(false));
  it('đổi nhỏ (dưới 50%) và vẫn cao hơn đã chi thì không cần', () => expect(isMajorChange(1000, 1200, 300)).toBe(false));
  it('đổi từ 50% trở lên cần xác nhận', () => {
    expect(isMajorChange(1000, 500, 100)).toBe(true);
    expect(isMajorChange(1000, 1500, 100)).toBe(true);
  });
  it('hạ xuống dưới mức đã chi cần xác nhận', () => expect(isMajorChange(1000, 900, 950)).toBe(true));
  it('đưa về 0 khi đã có chi tiêu cần xác nhận', () => expect(isMajorChange(1000, 0, 10)).toBe(true));
  it('từ 0 lên một mức mới khi chưa chi thì không cần', () => expect(isMajorChange(0, 500, 0)).toBe(false));
});
