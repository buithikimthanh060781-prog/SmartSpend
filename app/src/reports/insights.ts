import { compareMoney, formatMoney } from '@/lib/money';
import { formatPercent, type BudgetEvaluation } from '@/services/budgetCalculation';
import type { CategoryReport } from '@/reports/categories';
import { formatRatio, type Comparison } from '@/reports/comparison';
import type { FinancialSummary } from '@/reports/summary';

export interface Insight {
  id: string;
  /** Nhận xét ngắn gọn, mô tả sự việc, không đưa lời khuyên tài chính. */
  text: string;
  /** Số liệu chứng minh cho nhận xét (luôn có). */
  evidence: string;
  tone: 'info' | 'attention';
}

export interface InsightInput {
  currency: string;
  /** Tên kỳ hiện tại, ví dụ "tháng này". */
  periodWord: string;
  /** Tên kỳ so sánh, ví dụ "tháng trước". */
  previousWord: string;
  summary: FinancialSummary;
  /** Tổng hợp kỳ trước CÙNG SỐ NGÀY (so sánh công bằng); null nếu không có. */
  previousSummary: FinancialSummary | null;
  categories: CategoryReport;
  /** Đánh giá ngân sách tổng của tháng hiện tại; null nếu chưa thiết lập. */
  monthlyBudget: BudgetEvaluation | null;
  expenseChange: Comparison | null;
  unplannedChange: Comparison | null;
}

const MIN_TRANSACTIONS = 3;
const TOP_CATEGORY_MIN_SHARE = 25;

/**
 * Nhận xét tự động dựa trên QUY TẮC tính toán (rule-based analytics), không phải AI dự đoán.
 * Mỗi nhận xét chỉ xuất hiện khi có đủ dữ liệu chứng minh, kèm số liệu. Ngôn ngữ trung tính: tăng chi tiêu không mặc nhiên là xấu.
 * Không đưa lời khuyên đầu tư hay kết luận tài chính.
 */
export function buildInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const { summary: s, currency } = i;
  const enough = s.expenseCount >= MIN_TRANSACTIONS;

  // 1. Danh mục chiếm tỷ trọng lớn nhất
  const top = i.categories.rows[0];
  if (enough && top && top.sharePercent !== null && top.sharePercent >= TOP_CATEGORY_MIN_SHARE && top.total > 0) {
    out.push({
      id: 'top-category',
      text: `Chi tiêu ${top.name} chiếm ${formatRatio(top.sharePercent)} tổng chi ${i.periodWord}.`,
      evidence: `${formatMoney(top.total, currency)} trên tổng ${formatMoney(i.categories.total, currency)} (${top.count} giao dịch).`,
      tone: 'info',
    });
  }

  // 2. Mức sử dụng ngân sách tháng (trạng thái lấy từ so sánh chính xác của engine ngân sách)
  const b = i.monthlyBudget;
  if (b) {
    if (b.status === 'exceeded' && b.amount > 0) {
      out.push({
        id: 'budget-exceeded',
        text: `Chi tiêu đã vượt ngân sách tháng ${formatMoney(b.overspent, currency)}.`,
        evidence: `Đã chi ${formatMoney(b.spent, currency)} / hạn mức ${formatMoney(b.amount, currency)} (${formatPercent(b.usagePercent)}).`,
        tone: 'attention',
      });
    } else if (b.status === 'exhausted' && b.amount > 0) {
      out.push({
        id: 'budget-exhausted',
        text: 'Bạn đã sử dụng hết ngân sách tháng.',
        evidence: `Đã chi ${formatMoney(b.spent, currency)} / hạn mức ${formatMoney(b.amount, currency)}.`,
        tone: 'attention',
      });
    } else if (b.status === 'warning') {
      out.push({
        id: 'budget-warning',
        text: `Bạn đã sử dụng ${formatPercent(b.usagePercent)} ngân sách tháng.`,
        evidence: `Đã chi ${formatMoney(b.spent, currency)} / hạn mức ${formatMoney(b.amount, currency)}, còn ${formatMoney(b.remaining, currency)}.`,
        tone: 'attention',
      });
    }
  }

  // 3. Chi ngoài kế hoạch so với kỳ trước (cùng số ngày)
  const un = i.unplannedChange;
  if (enough && i.previousSummary && i.previousSummary.expenseCount > 0 && un && un.direction === 'up' && compareMoney(un.current, 0) > 0) {
    out.push({
      id: 'unplanned-up',
      text: un.previousIsZero
        ? `Phát sinh chi tiêu ngoài kế hoạch ${formatMoney(un.current, currency)}, trong khi ${i.previousWord} chưa có.`
        : `Chi tiêu ngoài kế hoạch tăng ${formatRatio(un.changePercent)} so với ${i.previousWord}.`,
      evidence: `${formatMoney(un.current, currency)} so với ${formatMoney(un.previous, currency)} (cùng số ngày).`,
      tone: 'info',
    });
  }

  // 4. Tổng chi so với cùng giai đoạn kỳ trước (trung tính, không đánh giá tốt/xấu)
  const ec = i.expenseChange;
  if (enough && i.previousSummary && i.previousSummary.expenseCount > 0 && ec && !ec.previousIsZero && ec.direction !== 'flat') {
    const pct = formatRatio(Math.abs(ec.changePercent ?? 0));
    out.push({
      id: 'expense-vs-previous',
      text: `Chi tiêu ${i.periodWord} ${ec.direction === 'up' ? 'cao hơn' : 'thấp hơn'} ${pct} so với cùng giai đoạn ${i.previousWord}.`,
      evidence: `${formatMoney(ec.current, currency)} so với ${formatMoney(ec.previous, currency)} (cùng số ngày).`,
      tone: 'info',
    });
  }

  // 5. Chi tiêu vượt thu nhập thực nhận (một sự thật về dòng tiền của kỳ)
  if (s.receivedIncome > 0 && s.netCashFlow < 0 && enough) {
    out.push({
      id: 'net-negative',
      text: `Chi tiêu ${i.periodWord} lớn hơn thu nhập thực nhận ${formatMoney(Math.abs(s.netCashFlow), currency)}.`,
      evidence: `Chi ${formatMoney(s.actualExpense, currency)} so với thu nhập thực nhận ${formatMoney(s.receivedIncome, currency)}.`,
      tone: 'attention',
    });
  }

  return out;
}
