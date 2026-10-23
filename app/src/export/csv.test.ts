import { describe, expect, it } from 'vitest';
import { buildCsv, buildKeyValueCsv, CSV_BOM, escapeCsvField, formatCsvCell } from '@/export/csv';
import { formatDateVi, sanitizeText } from '@/export/sanitize';
import type { ExportColumn } from '@/export/types';
import { sumMoney } from '@/lib/money';

/** Bộ phân tích CSV tối giản (RFC 4180) để kiểm tra khứ hồi: xuất ra rồi đọc lại phải ra đúng dữ liệu gốc. */
function parseCsv(text: string): string[][] {
  const src = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r' && src[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

interface Tx { date: string; desc: string; amount: number; ratio: number | null }
const columns: ExportColumn<Tx>[] = [
  { header: 'Ngày', kind: 'date', value: (r) => r.date },
  { header: 'Mô tả', kind: 'text', value: (r) => r.desc },
  { header: 'Số tiền', kind: 'money', value: (r) => r.amount },
  { header: 'Tỷ lệ (%)', kind: 'percent', value: (r) => r.ratio },
];

describe('chống formula injection', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+84901234567', "'+84901234567"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1:A9)', "'@SUM(A1:A9)"],
    ['=HYPERLINK("http://evil","x")', `'=HYPERLINK("http://evil","x")`],
    ['\t=cmd', "'\t=cmd"],
    ['\r=cmd', "'\r=cmd"], // CR được giữ nguyên nhưng ô vẫn được đánh dấu là văn bản
    ['  =1+1', "'  =1+1"],
    ['\u0007=1+1', "'=1+1"], // ký tự điều khiển bị loại bỏ trước khi kiểm tra
  ])('%j', (input, expected) => {
    expect(sanitizeText(input)).toBe(expected);
  });

  it('văn bản bình thường (kể cả tiếng Việt và dấu gạch ngang ở giữa) không bị đổi', () => {
    for (const s of ['Cà phê sáng', 'Mua gạo - 5kg', 'a=b', 'user@mail.com', 'Ăn trưa (công ty)', '']) expect(sanitizeText(s)).toBe(s);
  });

  it('loại bỏ ký tự điều khiển nhưng giữ xuống dòng và tab giữa chữ', () => {
    expect(sanitizeText('a\u0000b\u001Fc')).toBe('abc');
    expect(sanitizeText('dòng 1\ndòng 2')).toBe('dòng 1\ndòng 2');
  });

  it('CSV: ô văn bản nguy hiểm được xuất an toàn, ô số âm KHÔNG bị thêm dấu nháy', () => {
    const csv = buildCsv(columns, [{ date: '2026-10-05', desc: '=HYPERLINK("x")', amount: -150000, ratio: null }]);
    const [, data] = parseCsv(csv);
    expect(data[1]).toBe(`'=HYPERLINK("x")`);
    expect(data[2]).toBe('-150000'); // số, không phải văn bản người dùng nhập
  });

  it('tiêu đề cột cũng được làm sạch', () => {
    expect(buildCsv([{ header: '=evil', kind: 'text', value: () => 'x' }], [1]).split('\r\n')[0]).toBe(`${CSV_BOM}'=evil`);
  });
});

describe('escape CSV', () => {
  it('dấu phẩy, nháy kép và xuống dòng được đặt trong nháy kép; nháy kép được nhân đôi', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('nói "xin chào"')).toBe('"nói ""xin chào"""');
    expect(escapeCsvField('dòng 1\ndòng 2')).toBe('"dòng 1\ndòng 2"');
    expect(escapeCsvField('dòng 1\r\ndòng 2')).toBe('"dòng 1\r\ndòng 2"');
    expect(escapeCsvField('bình thường')).toBe('bình thường');
  });

  it('khứ hồi: dữ liệu khó (phẩy, nháy, xuống dòng, tiếng Việt) đọc lại đúng nguyên vẹn', () => {
    const tricky = ['Cà phê, bánh "mì"', 'Dòng 1\nDòng 2', 'Ghi chú: 50%, "ok"', 'Tiếng Việt: ắằẳẵặ ĐđƠơƯư', ',,,', '"'];
    const rows: Tx[] = tricky.map((desc, i) => ({ date: '2026-10-05', desc, amount: 1000 + i, ratio: null }));
    const parsed = parseCsv(buildCsv(columns, rows));
    expect(parsed).toHaveLength(1 + rows.length);
    parsed.slice(1).forEach((cells, i) => {
      expect(cells).toHaveLength(columns.length);
      expect(cells[1]).toBe(tricky[i]);
    });
  });
});

describe('định dạng file CSV', () => {
  const rows: Tx[] = [{ date: '2026-02-09', desc: 'Lương', amount: 1500000.5, ratio: 32.456 }];

  it('có BOM UTF-8, header tiếng Việt, xuống dòng CRLF', () => {
    const csv = buildCsv(columns, rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.startsWith(`${CSV_BOM}Ngày,Mô tả,Số tiền,Tỷ lệ (%)\r\n`)).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(3);
  });

  it('ngày dd/MM/yyyy không lệch múi giờ; tiền là số thuần chính xác; phần trăm làm tròn 2 chữ số', () => {
    const [, data] = parseCsv(buildCsv(columns, rows));
    expect(data).toEqual(['09/02/2026', 'Lương', '1500000.5', '32.46']);
    expect(formatDateVi('2028-02-29')).toBe('29/02/2028');
  });

  it('không mất chữ số với số tiền lớn và tổng thập phân chính xác', () => {
    const big = [{ date: '2026-10-05', desc: 'a', amount: 9007199254740.99, ratio: null }];
    expect(parseCsv(buildCsv(columns, big))[1][2]).toBe('9007199254740.99');
    const cents = Array.from({ length: 10 }, () => 0.1);
    expect(formatCsvCell(sumMoney(cents, (x) => x), 'money')).toBe('1');
  });

  it('ô rỗng (null) xuất thành trống, số 0 vẫn xuất là 0', () => {
    const [, data] = parseCsv(buildCsv(columns, [{ date: '2026-10-05', desc: '', amount: 0, ratio: null }]));
    expect(data).toEqual(['05/10/2026', '', '0', '']);
  });

  it('hàng tổng cộng', () => {
    const csv = buildCsv(columns, rows, [['Tổng', null, 1500000.5, null]]);
    expect(parseCsv(csv)[2]).toEqual(['Tổng', '', '1500000.5', '']);
  });

  it('nhãn chữ trong ô số (ví dụ "Không áp dụng") được xuất như văn bản an toàn', () => {
    expect(formatCsvCell('Không áp dụng', 'percent')).toBe('Không áp dụng');
    expect(formatCsvCell('=1+1', 'money')).toBe("'=1+1");
  });

  it('CSV dạng chỉ tiêu - giá trị', () => {
    const csv = buildKeyValueCsv([
      { label: 'Thu nhập thực nhận', value: 1000, kind: 'money', note: 'Chỉ "Đã nhận"' },
      { label: 'Tỷ lệ', value: 'Không áp dụng', kind: 'percent' },
    ]);
    expect(parseCsv(csv)).toEqual([['Chỉ tiêu', 'Giá trị', 'Ghi chú'], ['Thu nhập thực nhận', '1000', 'Chỉ "Đã nhận"'], ['Tỷ lệ', 'Không áp dụng', '']]);
  });

  it('danh sách rỗng chỉ có dòng tiêu đề', () => {
    expect(parseCsv(buildCsv(columns, []))).toEqual([['Ngày', 'Mô tả', 'Số tiền', 'Tỷ lệ (%)']]);
  });
});
