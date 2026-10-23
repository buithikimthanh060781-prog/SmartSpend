import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatMoney,
  InvalidMoneyError,
  MoneyRangeError,
  parseMoneyInput,
  subtractMoney,
  sumMoney,
  toMoney,
  toMoneyInput,
  tryToMoney,
} from '@/lib/money';

describe('sumMoney - cộng chính xác', () => {
  it('không sai số dấu phẩy động', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // chứng minh phép cộng thường bị sai
    expect(sumMoney([0.1, 0.2], (r) => r)).toBe(0.3);
    expect(sumMoney(['0.10', '0.20', '0.30'], (r) => r)).toBe(0.6);
  });

  it('cộng 10.000 giao dịch 0.1 ra đúng 1000', () => {
    const rows = Array.from({ length: 10_000 }, () => '0.1');
    expect(sumMoney(rows, (r) => r)).toBe(1000);
  });

  it('cộng nhiều giao dịch hỗn hợp number/string', () => {
    expect(sumMoney([1500000, '250000.50', 99.99, '0.01'], (r) => r)).toBe(1750100.5);
  });

  it('danh sách rỗng = 0 (đây là tổng của không có gì, không phải dữ liệu hỏng)', () => {
    expect(sumMoney([], () => 0)).toBe(0);
  });

  it('số lớn trong giới hạn an toàn', () => {
    expect(sumMoney(['9007199254740.99', '0.01'], (r) => r)).toBe(9007199254741);
    expect(toMoney('123456789012.34')).toBe(123456789012.34);
  });

  it('số lớn vượt giới hạn -> ném lỗi thay vì làm tròn âm thầm', () => {
    expect(() => toMoney('9007199254740993')).toThrow(MoneyRangeError);
    expect(() => sumMoney(['9007199254740990', '10'], (r) => r)).toThrow(MoneyRangeError);
    expect(() => toMoney(1e21)).toThrow(MoneyRangeError);
  });

  it('giá trị âm được cộng đúng', () => {
    expect(sumMoney(['-1500.25', '1000', -0.75], (r) => r)).toBe(-501);
    expect(toMoney('-0.5')).toBe(-0.5);
  });

  it('ký hiệu khoa học của number', () => {
    expect(toMoney(1.5e-7)).toBe(1.5e-7);
    expect(toMoney(2e3)).toBe(2000);
  });
});

describe('giá trị không hợp lệ KHÔNG bị đổi thành 0', () => {
  it.each([null, undefined, '', '   ', 'abc', '1,5', '1.2.3', 'NaN', 'Infinity', '12abc', '--5'])('toMoney(%j) ném InvalidMoneyError', (v) => {
    expect(() => toMoney(v as never)).toThrow(InvalidMoneyError);
  });

  it('NaN và Infinity dạng number', () => {
    expect(() => toMoney(Number.NaN)).toThrow(InvalidMoneyError);
    expect(() => toMoney(Number.POSITIVE_INFINITY)).toThrow(InvalidMoneyError);
  });

  it('một dòng hỏng làm cả phép cộng thất bại (không bỏ qua, không tính là 0)', () => {
    expect(() => sumMoney([100, null, 200], (r) => r)).toThrow(InvalidMoneyError);
    expect(() => sumMoney([100, 'abc'], (r) => r)).toThrow(InvalidMoneyError);
  });

  it('quá nhiều chữ số thập phân thì từ chối, không làm tròn âm thầm', () => {
    expect(() => toMoney('0.1234567890123')).toThrow(MoneyRangeError);
    expect(toMoney('0.1000000000000')).toBe(0.1); // số 0 thừa thì hợp lệ
  });

  it('tryToMoney trả null để giao diện báo lỗi', () => {
    expect(tryToMoney('abc')).toBeNull();
    expect(tryToMoney(null)).toBeNull();
    expect(tryToMoney('12.5')).toBe(12.5);
  });

  it('formatAmount hiển thị lỗi rõ ràng thay vì 0 ₫', () => {
    expect(formatAmount('abc')).toBe('Số tiền không hợp lệ');
    expect(formatAmount(null)).toBe('Số tiền không hợp lệ');
    expect(formatAmount(0)).toContain('0');
  });
});

describe('subtractMoney', () => {
  it('trừ chính xác và cho phép kết quả âm', () => {
    expect(subtractMoney(0.3, 0.1)).toBe(0.2);
    expect(subtractMoney(100, 250)).toBe(-150);
    expect(subtractMoney('5000000', '1234567.89')).toBe(3765432.11);
  });
  it('ném lỗi khi thiếu giá trị', () => {
    expect(() => subtractMoney(null, 1)).toThrow(InvalidMoneyError);
  });
});

describe('formatMoney (vi-VN)', () => {
  it('định dạng VND, dấu chấm phân cách nghìn', () => {
    expect(formatMoney(1500000)).toMatch(/1\.500\.000/);
    expect(formatMoney(1500000)).toContain('₫');
  });
  it('số âm', () => {
    expect(formatMoney(-250000)).toMatch(/-.*250\.000/);
  });
});

describe('parseMoneyInput / toMoneyInput', () => {
  it('đọc kiểu Việt Nam: 1.500.000', () => {
    expect(parseMoneyInput('1.500.000')).toBe(1500000);
    expect(parseMoneyInput('1500000,5')).toBe(1500000.5);
    expect(parseMoneyInput(' 250 000 ')).toBe(250000);
  });
  it('từ chối đầu vào sai, số âm, quá 2 chữ số thập phân', () => {
    for (const v of ['', 'abc', '-1', '1,234,5', '12.5.5x', '1,234']) expect(parseMoneyInput(v)).toBeNull();
  });
  it('số quá lớn bị từ chối', () => {
    expect(parseMoneyInput('9.007.199.254.740.993')).toBeNull();
  });
  it('khứ hồi số thập phân không bị hiểu nhầm là phân cách nghìn', () => {
    expect(parseMoneyInput(toMoneyInput(1500000.5))).toBe(1500000.5);
    expect(parseMoneyInput(toMoneyInput('2500000'))).toBe(2500000);
  });
  it('toMoneyInput trả chuỗi rỗng cho giá trị hỏng để người dùng nhập lại', () => {
    expect(toMoneyInput('abc')).toBe('');
  });
});
