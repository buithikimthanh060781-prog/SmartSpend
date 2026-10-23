import { describe, expect, it } from 'vitest';
import { InvalidMoneyError, MoneyRangeError } from '@/lib/money';
import { compareValues, formatRatio, percentOf } from '@/reports/comparison';
import { resolvePreset } from '@/reports/ranges';
import { buildFinancialSummary, type ExpenseRow, type IncomeRow } from '@/reports/summary';

const TODAY = '2026-10-18';
const MONTH = resolvePreset('thisMonth', TODAY)!;

const inc = (date: string, amount: number | string, status = 'received'): IncomeRow => ({ amount, status, income_date: date });
const exp = (date: string, amount: number | string, plan: string | null = null, category = 'food'): ExpenseRow => ({ amount, plan_id: plan, expense_date: date, category_id: category });

describe('tổng hợp tài chính', () => {
  const incomes = [inc('2026-10-01', 20_000_000), inc('2026-10-05', 500_000.5), inc('2026-10-06', 9_999_999, 'expected')];
  const expenses = [exp('2026-10-02', 1_000_000), exp('2026-10-02', 250_000.25, 'p1'), exp('2026-10-10', 750_000, 'p1'), exp('2026-10-12', 100_000)];

  it('thu nhập thực nhận chỉ tính received; expected tách riêng', () => {
    const s = buildFinancialSummary(incomes, expenses, MONTH, TODAY);
    expect(s.receivedIncome).toBe(20_500_000.5);
    expect(s.expectedIncome).toBe(9_999_999);
    expect(s.incomeCount).toBe(1 + 1);
  });

  it('chi tiêu thực tế, chi trong/ngoài kế hoạch (plan_id) và chênh lệch thu chi', () => {
    const s = buildFinancialSummary(incomes, expenses, MONTH, TODAY);
    expect(s.actualExpense).toBe(2_100_000.25);
    expect(s.plannedExpense).toBe(1_000_000.25);
    expect(s.unplannedExpense).toBe(1_100_000);
    expect(s.netCashFlow).toBe(18_400_000.25);
  });

  it('tỷ lệ chi/thu và tỷ trọng chi ngoài kế hoạch', () => {
    const s = buildFinancialSummary([inc('2026-10-01', 1000)], [exp('2026-10-02', 250), exp('2026-10-03', 250, 'p')], MONTH, TODAY);
    expect(s.expenseToIncomeRatio).toBe(50);
    expect(s.unplannedExpenseRatio).toBe(50);
  });

  it('số ngày có chi tiêu và trung bình mỗi ngày (theo số ngày đã trôi qua của kỳ đang diễn ra)', () => {
    const s = buildFinancialSummary(incomes, expenses, MONTH, TODAY);
    expect(s.daysWithExpense).toBe(3); // 02, 10, 12
    expect(s.elapsedDays).toBe(18); // tháng 10 mới đến ngày 18
    expect(s.avgExpensePerDay).toBe(116_666.68); // 2.100.000,25 / 18 làm tròn 2 chữ số (chỉ số phái sinh)
  });

  it('kỳ đã kết thúc chia cho toàn bộ số ngày của kỳ', () => {
    const sep = resolvePreset('lastMonth', TODAY)!;
    const s = buildFinancialSummary([], [exp('2026-09-10', 3000)], sep, TODAY);
    expect(s.elapsedDays).toBe(30);
    expect(s.avgExpensePerDay).toBe(100);
  });

  it('mẫu số bằng 0: không chia cho 0, trả về null (không áp dụng)', () => {
    const noIncome = buildFinancialSummary([], [exp('2026-10-02', 500)], MONTH, TODAY);
    expect(noIncome.expenseToIncomeRatio).toBeNull();
    expect(noIncome.netCashFlow).toBe(-500);
    const noExpense = buildFinancialSummary([inc('2026-10-01', 500)], [], MONTH, TODAY);
    expect(noExpense.unplannedExpenseRatio).toBeNull();
    expect(noExpense.expenseToIncomeRatio).toBe(0);
    expect(noExpense.daysWithExpense).toBe(0);
  });

  it('thu nhập expected không bao giờ làm tăng thực nhận hay giảm chênh lệch', () => {
    const onlyExpected = buildFinancialSummary([inc('2026-10-01', 5_000_000, 'expected')], [exp('2026-10-02', 100)], MONTH, TODAY);
    expect(onlyExpected.receivedIncome).toBe(0);
    expect(onlyExpected.netCashFlow).toBe(-100);
    expect(onlyExpected.expenseToIncomeRatio).toBeNull();
  });

  it('kế hoạch không bao giờ được cộng vào chi tiêu: chỉ giao dịch thật', () => {
    // Summary không có đầu vào nào cho planned_amount; chi trong kế hoạch chỉ là giao dịch có plan_id.
    const s = buildFinancialSummary([], [exp('2026-10-02', 100, 'p1')], MONTH, TODAY);
    expect(s.actualExpense).toBe(100);
    expect(s.plannedExpense).toBe(100);
  });

  it('bỏ qua dòng ngoài khoảng (nửa mở: ngày 01 tháng sau không tính)', () => {
    const s = buildFinancialSummary([inc('2026-11-01', 100), inc('2026-09-30', 100)], [exp('2026-11-01', 5), exp('2026-09-30', 5), exp('2026-10-31', 7)], MONTH, TODAY);
    expect(s.receivedIncome).toBe(0);
    expect(s.actualExpense).toBe(7);
  });

  it('dữ liệu rỗng cho kết quả bằng 0 hợp lệ', () => {
    const s = buildFinancialSummary([], [], MONTH, TODAY);
    expect(s).toMatchObject({ receivedIncome: 0, actualExpense: 0, netCashFlow: 0, expenseCount: 0, daysWithExpense: 0, expenseToIncomeRatio: null, unplannedExpenseRatio: null });
  });

  it('cộng chính xác nhiều giao dịch thập phân và số tiền lớn', () => {
    const many = Array.from({ length: 1000 }, (_, i) => exp('2026-10-05', '0.1', null, `c${i % 3}`));
    expect(buildFinancialSummary([], many, MONTH, TODAY).actualExpense).toBe(100);
    expect(buildFinancialSummary([inc('2026-10-01', '9007199254740.99')], [exp('2026-10-02', '0.99')], MONTH, TODAY).netCashFlow).toBe(9007199254740);
  });

  it('dữ liệu tiền không hợp lệ làm hàm ném lỗi, không bị coi là 0', () => {
    expect(() => buildFinancialSummary([inc('2026-10-01', 'abc')], [], MONTH, TODAY)).toThrow(InvalidMoneyError);
    expect(() => buildFinancialSummary([], [exp('2026-10-01', null as never)], MONTH, TODAY)).toThrow(InvalidMoneyError);
    expect(() => buildFinancialSummary([], [exp('2026-10-01', '9007199254740993')], MONTH, TODAY)).toThrow(MoneyRangeError);
  });
});

describe('so sánh và tỷ lệ', () => {
  it('tăng, giảm, không đổi', () => {
    expect(compareValues(150, 100)).toMatchObject({ delta: 50, changePercent: 50, direction: 'up', previousIsZero: false });
    expect(compareValues(50, 100)).toMatchObject({ delta: -50, changePercent: -50, direction: 'down' });
    expect(compareValues(100, 100)).toMatchObject({ delta: 0, changePercent: 0, direction: 'flat' });
  });
  it('kỳ trước bằng 0: không có tỷ lệ tăng trưởng vô hạn', () => {
    const c = compareValues(500, 0);
    expect(c.changePercent).toBeNull();
    expect(c.previousIsZero).toBe(true);
    expect(c.direction).toBe('up');
    expect(c.delta).toBe(500);
    expect(compareValues(0, 0)).toMatchObject({ changePercent: null, direction: 'flat', previousIsZero: true });
  });
  it('chênh lệch thập phân chính xác', () => {
    expect(compareValues(0.3, 0.1).delta).toBe(0.2);
  });
  it('percentOf và định dạng', () => {
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(5, 0)).toBeNull();
    expect(formatRatio(32.456)).toBe('32,5%');
    expect(formatRatio(null)).toBe('—');
    expect(formatRatio(null, 'Không đủ dữ liệu')).toBe('Không đủ dữ liệu');
  });
});
