import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { summaryWorkbookSheets, categoryNamer, type SummaryWorkbookInput } from '@/export/datasets';
import { buildWorkbook, moneyFormat, workbookToBuffer } from '@/export/xlsx';
import { periodContaining } from '@/lib/periods';
import { buildCategoryReport } from '@/reports/categories';
import { buildPeriodComparison } from '@/reports/periodComparison';
import { buildPlanReport } from '@/reports/plans';
import { resolveComparison, resolvePreset } from '@/reports/ranges';
import { buildFinancialSummary } from '@/reports/summary';
import { evaluateAmounts } from '@/services/budgetCalculation';
import type { SsBudget, SsExpensePlan } from '@/types/db';

const TODAY = '2026-10-18';
const RANGE = resolvePreset('thisMonth', TODAY)!;

const incomes = [
  { income_date: '2026-10-01', category_id: 'sal', description: 'Lương', amount: 20_000_000, status: 'received', note: null },
  { income_date: '2026-10-05', category_id: 'sal', description: '=HYPERLINK("http://evil","x")', amount: 500_000.5, status: 'received', note: '@note' },
  { income_date: '2026-10-09', category_id: 'sal', description: 'Thưởng dự kiến', amount: 3_000_000, status: 'expected', note: null },
];
const expenses = [
  { expense_date: '2026-10-02', category_id: 'food', description: 'Ăn trưa, "công ty"', amount: 1_000_000, payment_method: 'cash', plan_id: null, note: 'dòng 1\ndòng 2', planTitle: undefined },
  { expense_date: '2026-10-10', category_id: 'old', description: '+84 gọi xe', amount: 750_000.25, payment_method: 'card', plan_id: 'p1', note: null, planTitle: 'Du lịch' },
];
const plan: SsExpensePlan = { id: 'p1', user_id: 'u', category_id: 'food', title: 'Du lịch', planned_date: '2026-10-20', planned_amount: 2_000_000, status: 'in_progress', note: null, created_at: '', updated_at: '' };
const budget = (type: 'daily' | 'monthly', cat: string | null, amount: number): SsBudget => {
  const p = periodContaining(type, TODAY);
  return { id: `${type}-${cat}`, user_id: 'u', category_id: cat, period_type: type, period_start: p.start, period_end: p.endExclusive, amount, created_at: '', updated_at: '' };
};

function sampleInput(over: Partial<SummaryWorkbookInput> = {}): SummaryWorkbookInput {
  const cats = [{ id: 'food', name: 'Ăn uống', is_active: true, color: null, icon: null }, { id: 'old', name: 'Danh mục cũ', is_active: false, color: null, icon: null }, { id: 'sal', name: 'Lương', is_active: true, color: null, icon: null }];
  const rows = expenses.map((e) => ({ amount: e.amount, plan_id: e.plan_id, expense_date: e.expense_date, category_id: e.category_id }));
  const spec = resolveComparison('month', 'toDate', TODAY)!;
  return {
    range: RANGE,
    generatedOn: TODAY,
    summary: buildFinancialSummary(incomes, rows, RANGE, TODAY),
    comparison: buildPeriodComparison(spec, incomes, rows, cats, TODAY),
    incomes,
    expenses,
    planReport: buildPlanReport([plan], [{ plan_id: 'p1', amount: 750_000.25 }]),
    budgetEvaluations: [evaluateAmounts(budget('monthly', null, 5_000_000), 1_750_000.25), evaluateAmounts(budget('daily', 'food', 0), 0)],
    budgetNote: 'Ngân sách của các kỳ chứa ngày 18/10/2026.',
    categoryReport: buildCategoryReport(rows, cats),
    nameOf: categoryNamer(cats),
    ...over,
  };
}

async function roundTrip(input: SummaryWorkbookInput) {
  const wb = await buildWorkbook(summaryWorkbookSheets(input), { currency: 'VND', created: new Date('2026-10-18T00:00:00Z') });
  const buffer = await workbookToBuffer(wb);
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer as ArrayBuffer);
  return loaded;
}

describe('file Excel báo cáo tổng hợp', () => {
  it('có đúng 6 sheet theo thứ tự yêu cầu', async () => {
    const wb = await roundTrip(sampleInput());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tổng quan', 'Thu nhập', 'Chi tiêu', 'Kế hoạch', 'Ngân sách', 'Chi tiêu theo danh mục']);
  });

  it('tiêu đề sheet, header nổi bật (nền Navy, chữ trắng, đậm), freeze header và auto filter', async () => {
    const wb = await roundTrip(sampleInput());
    for (const ws of wb.worksheets) {
      expect(String(ws.getCell(1, 1).value).length, ws.name).toBeGreaterThan(3);
      const head = ws.getCell(4, 1);
      expect(head.font?.bold, ws.name).toBe(true);
      expect(head.fill).toMatchObject({ type: 'pattern', fgColor: { argb: 'FF142B49' } });
      expect(head.font?.color?.argb).toBe('FFFFFFFF');
      expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
      expect(ws.autoFilter, ws.name).toBeTruthy();
      expect(JSON.stringify(ws.autoFilter)).toContain('A4');
      for (let c = 1; c <= ws.columnCount; c++) expect(ws.getColumn(c).width ?? 0, `${ws.name} cột ${c}`).toBeGreaterThan(5);
    }
  });

  it('sheet Thu nhập: header, ngày dd/MM/yyyy thật, tiền VNĐ, tổng thực nhận và dự kiến tách riêng', async () => {
    const ws = (await roundTrip(sampleInput())).getWorksheet('Thu nhập')!;
    expect([1, 2, 3, 4, 5, 6].map((c) => ws.getCell(4, c).value)).toEqual(['Ngày', 'Danh mục', 'Mô tả', 'Số tiền', 'Trạng thái', 'Ghi chú']);
    const date = ws.getCell(5, 1);
    expect(date.numFmt).toBe('dd/mm/yyyy');
    expect((date.value as Date).toISOString().slice(0, 10)).toBe('2026-10-01'); // không lệch múi giờ
    expect(ws.getCell(5, 4).numFmt).toBe(moneyFormat('VND'));
    expect(ws.getCell(6, 4).value).toBe(500_000.5);
    expect(ws.getCell(7, 5).value).toBe('Dự kiến');
    // hàng tổng cộng: sau 3 dòng dữ liệu (dòng 5-7) là dòng 8 và 9
    expect(ws.getCell(8, 1).value).toBe('Tổng thực nhận (Đã nhận)');
    expect(ws.getCell(8, 4).value).toBe(20_500_000.5);
    expect(ws.getCell(9, 1).value).toBe('Tổng dự kiến (không tính vào thực nhận)');
    expect(ws.getCell(9, 4).value).toBe(3_000_000);
    expect(ws.getCell(8, 4).font?.bold).toBe(true);
  });

  it('chống formula injection trong ô văn bản (mô tả, ghi chú)', async () => {
    const ws = (await roundTrip(sampleInput())).getWorksheet('Thu nhập')!;
    expect(ws.getCell(6, 3).value).toBe(`'=HYPERLINK("http://evil","x")`);
    expect(ws.getCell(6, 6).value).toBe("'@note");
    const chi = (await roundTrip(sampleInput())).getWorksheet('Chi tiêu')!;
    expect(chi.getCell(6, 3).value).toBe("'+84 gọi xe");
    expect(chi.getCell(5, 3).value).toBe('Ăn trưa, "công ty"'); // dấu phẩy và nháy kép không cần đổi trong Excel
  });

  it('sheet Chi tiêu: tổng chi chính xác, trong/ngoài kế hoạch, tên kế hoạch', async () => {
    const ws = (await roundTrip(sampleInput())).getWorksheet('Chi tiêu')!;
    expect(ws.getCell(5, 6).value).toBe('Ngoài kế hoạch');
    expect(ws.getCell(6, 6).value).toBe('Trong kế hoạch');
    expect(ws.getCell(6, 7).value).toBe('Du lịch');
    expect(ws.getCell(7, 1).value).toBe('Tổng chi');
    expect(ws.getCell(7, 4).value).toBe(1_750_000.25);
    expect(ws.getCell(5, 8).value).toBe('dòng 1\ndòng 2');
  });

  it('sheet Kế hoạch: dự kiến, thực chi liên kết, chênh lệch, tổng', async () => {
    const ws = (await roundTrip(sampleInput())).getWorksheet('Kế hoạch')!;
    expect(ws.getCell(5, 1).value).toBe('Du lịch');
    expect(ws.getCell(5, 5).value).toBe(2_000_000);
    expect(ws.getCell(5, 6).value).toBe(750_000.25);
    expect(ws.getCell(5, 7).value).toBe(-1_249_999.75);
    expect(ws.getCell(6, 5).value).toBe(2_000_000);
    expect(ws.getCell(6, 6).value).toBe(750_000.25);
  });

  it('sheet Ngân sách: tỷ lệ là phần trăm, trạng thái, KHÔNG có hàng tổng (các hạn mức không cộng gộp)', async () => {
    const ws = (await roundTrip(sampleInput())).getWorksheet('Ngân sách')!;
    expect(ws.getCell(5, 1).value).toBe('Tháng');
    expect(ws.getCell(5, 10).numFmt).toBe('0.0%');
    expect(ws.getCell(5, 10).value).toBeCloseTo(0.35000005, 8); // 1.750.000,25 / 5.000.000
    expect(ws.getCell(5, 11).value).toBe('An toàn');
    expect(ws.getCell(6, 6).value).toBe(0);
    expect(ws.getCell(6, 10).value).toBeNull(); // hạn mức 0: không có tỷ lệ
    expect(ws.getCell(6, 11).value).toBe('Hết hạn mức');
    expect(ws.getCell(7, 1).value).toBeNull(); // không có hàng tổng
    expect(String(ws.getCell(2, 1).value)).toMatch(/không cộng gộp/);
  });

  it('sheet Chi tiêu theo danh mục: danh mục đã ngừng hoạt động vẫn có mặt, tỷ trọng, tổng 100%', async () => {
    const ws = (await roundTrip(sampleInput())).getWorksheet('Chi tiêu theo danh mục')!;
    const names = [5, 6].map((r) => ws.getCell(r, 1).value);
    expect(names).toEqual(['Ăn uống', 'Danh mục cũ']);
    expect(ws.getCell(6, 2).value).toBe('Đã ngừng hoạt động');
    expect(ws.getCell(5, 5).numFmt).toBe('0.0%');
    expect(ws.getCell(7, 1).value).toBe('Tổng cộng');
    expect(ws.getCell(7, 3).value).toBe(1_750_000.25);
    expect(ws.getCell(7, 5).value).toBe(1);
  });

  it('sheet Tổng quan: các chỉ tiêu đúng; mẫu số 0 ghi "Không áp dụng" thay vì 0', async () => {
    const wb = await roundTrip(sampleInput());
    const ws = wb.getWorksheet('Tổng quan')!;
    const kv = new Map<string, unknown>();
    ws.eachRow((row, n) => { if (n >= 5) kv.set(String(row.getCell(1).value), row.getCell(2).value); });
    expect(kv.get('Thu nhập thực nhận')).toBe(20_500_000.5);
    expect(kv.get('Thu nhập dự kiến')).toBe(3_000_000);
    expect(kv.get('Tổng chi tiêu thực tế')).toBe(1_750_000.25);
    expect(kv.get('Chênh lệch thu chi')).toBe(18_750_000.25);
    expect(kv.get('Chi trong kế hoạch')).toBe(750_000.25);
    expect(kv.get('Chi ngoài kế hoạch')).toBe(1_000_000);

    const empty = (await roundTrip(sampleInput({ summary: buildFinancialSummary([], [], RANGE, TODAY), comparison: null }))).getWorksheet('Tổng quan')!;
    const kv2 = new Map<string, unknown>();
    empty.eachRow((row, n) => { if (n >= 5) kv2.set(String(row.getCell(1).value), row.getCell(2).value); });
    expect(kv2.get('Tỷ lệ chi tiêu / thu nhập (%)')).toBe('Không áp dụng');
    expect(kv2.get('Tỷ trọng chi ngoài kế hoạch (%)')).toBe('Không áp dụng');
    expect(kv2.get('Thu nhập thực nhận')).toBe(0);
  });

  it('dữ liệu rỗng vẫn tạo file hợp lệ với đủ sheet và header', async () => {
    const wb = await roundTrip(sampleInput({
      incomes: [], expenses: [], planReport: buildPlanReport([], []), budgetEvaluations: [], categoryReport: buildCategoryReport([], []),
      summary: buildFinancialSummary([], [], RANGE, TODAY), comparison: null,
    }));
    expect(wb.worksheets).toHaveLength(6);
    expect(wb.getWorksheet('Chi tiêu')!.getCell(4, 4).value).toBe('Số tiền');
    expect(wb.getWorksheet('Chi tiêu')!.getCell(5, 1).value).toBe('Tổng chi');
    expect(wb.getWorksheet('Chi tiêu')!.getCell(5, 4).value).toBe(0);
  });

  it('khối lượng lớn (5.000 dòng) tạo file đúng và đủ dòng', async () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({
      expense_date: '2026-10-05', category_id: 'food', description: `GD ${i}`, amount: 1000.5, payment_method: 'cash', plan_id: null, note: null, planTitle: undefined,
    }));
    const wb = await roundTrip(sampleInput({ expenses: many }));
    const ws = wb.getWorksheet('Chi tiêu')!;
    expect(ws.rowCount).toBe(4 + 5000 + 1);
    expect(ws.getCell(4 + 5000 + 1, 4).value).toBe(5_002_500); // 5000 * 1000,5
  });

  it('ngoại tệ khác VND dùng định dạng 2 chữ số thập phân', () => {
    expect(moneyFormat('VND')).toContain('₫');
    expect(moneyFormat('USD')).toContain('0.00');
    expect(moneyFormat('USD')).toContain('USD');
  });
});
