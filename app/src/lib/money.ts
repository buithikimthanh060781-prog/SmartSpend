// Tính tiền bằng số thập phân chính xác (BigInt + số chữ số thập phân), không dùng số dấu phẩy động.
// Giá trị không hợp lệ KHÔNG bị âm thầm đổi thành 0: hàm ném InvalidMoneyError / MoneyRangeError.
//
// Giới hạn đã biết: PostgREST trả cột NUMERIC dạng số JSON, nên giá trị vượt ~15 chữ số có nghĩa đã mất độ chính xác
// trước khi tới frontend. Dưới ngưỡng đó (đủ cho VND và ngoại tệ thông thường) phép tính ở đây là chính xác tuyệt đối.
export type NumericValue = number | string | null | undefined;

export class InvalidMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoneyError';
  }
}

export class MoneyRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyRangeError';
  }
}

interface Decimal {
  units: bigint; // giá trị = units / 10^scale
  scale: number;
}

const MAX_SCALE = 12; // 10^12 vẫn biểu diễn chính xác trong số dấu phẩy động
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;

function parseDecimal(value: NumericValue): Decimal {
  if (value === null || value === undefined) throw new InvalidMoneyError('Thiếu giá trị số tiền.');

  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new InvalidMoneyError(`Số tiền không hợp lệ: ${String(value)}`);
    text = String(value);
  } else if (typeof value === 'string') {
    text = value.trim();
  } else {
    throw new InvalidMoneyError('Số tiền phải là số hoặc chuỗi số.');
  }

  const match = DECIMAL_PATTERN.exec(text);
  if (!match) throw new InvalidMoneyError(`Số tiền không hợp lệ: "${text}"`);
  const [, sign, intPart, fracPart = '', expPart = '0'] = match;

  const exponent = Number(expPart);
  if (Math.abs(exponent) > 40) throw new MoneyRangeError(`Số tiền ngoài phạm vi hỗ trợ: "${text}"`);

  let digits = intPart + fracPart;
  let scale = fracPart.length - exponent;
  if (scale < 0) {
    digits += '0'.repeat(-scale);
    scale = 0;
  }
  // Bỏ các số 0 thừa ở cuối phần thập phân; nếu vẫn quá nhiều chữ số thập phân thì từ chối thay vì làm tròn âm thầm.
  while (scale > MAX_SCALE && digits.endsWith('0')) {
    digits = digits.slice(0, -1);
    scale -= 1;
  }
  if (scale > MAX_SCALE) throw new MoneyRangeError(`Số tiền có quá nhiều chữ số thập phân: "${text}"`);

  const units = BigInt(digits) * (sign === '-' ? -1n : 1n);
  return { units, scale };
}

function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

function add(a: Decimal, b: Decimal): Decimal {
  const scale = Math.max(a.scale, b.scale);
  return { units: a.units * pow10(scale - a.scale) + b.units * pow10(scale - b.scale), scale };
}

function negate(a: Decimal): Decimal {
  return { units: -a.units, scale: a.scale };
}

function toNumber(d: Decimal): number {
  let { units, scale } = d;
  while (scale > 0 && units % 10n === 0n) {
    units /= 10n;
    scale -= 1;
  }
  if (units > MAX_SAFE || units < -MAX_SAFE) {
    throw new MoneyRangeError('Số tiền vượt giới hạn có thể biểu diễn chính xác.');
  }
  // Chia hai số đều biểu diễn chính xác -> kết quả là số thực gần nhất với giá trị thập phân thật.
  return Number(units) / 10 ** scale;
}

/** Đọc một giá trị NUMERIC từ database. Ném lỗi nếu null/không hợp lệ/ngoài phạm vi. */
export function toMoney(value: NumericValue): number {
  return toNumber(parseDecimal(value));
}

/** Như toMoney nhưng trả về null khi không hợp lệ (để giao diện báo lỗi thay vì hiển thị 0). */
export function tryToMoney(value: NumericValue): number | null {
  try {
    return toMoney(value);
  } catch {
    return null;
  }
}

export function sumMoney<T>(rows: readonly T[], pick: (row: T) => NumericValue): number {
  let total: Decimal = { units: 0n, scale: 0 };
  for (const row of rows) total = add(total, parseDecimal(pick(row)));
  return toNumber(total);
}

export function subtractMoney(a: NumericValue, b: NumericValue): number {
  return toNumber(add(parseDecimal(a), negate(parseDecimal(b))));
}

/**
 * Làm tròn 2 chữ số thập phân cho các chỉ số PHÁI SINH chỉ để hiển thị (trung bình mỗi ngày, mỗi giao dịch).
 * Không dùng cho tổng tiền hay so sánh ngưỡng: những phép đó luôn dùng số thập phân chính xác.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** So sánh chính xác hai số tiền: -1 nếu a < b, 0 nếu bằng, 1 nếu a > b. */
export function compareMoney(a: NumericValue, b: NumericValue): -1 | 0 | 1 {
  const diff = add(parseDecimal(a), negate(parseDecimal(b))).units;
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}

/**
 * So sánh chính xác tỷ lệ spent/amount với một ngưỡng phần trăm NGUYÊN (80, 100...) mà không chia và không làm tròn:
 * so sánh spent*100 với amount*percent bằng số nguyên lớn. Dùng để xác định trạng thái ngân sách.
 * amount phải > 0 (nếu amount = 0 thì tỷ lệ không xác định, người gọi phải xử lý riêng).
 */
export function comparePercent(spent: NumericValue, amount: NumericValue, percent: number): -1 | 0 | 1 {
  if (!Number.isInteger(percent) || percent < 0) throw new InvalidMoneyError('Ngưỡng phần trăm phải là số nguyên không âm.');
  const s = parseDecimal(spent);
  const a = parseDecimal(amount);
  const lhs: Decimal = { units: s.units * 100n, scale: s.scale };
  const rhs: Decimal = { units: a.units * BigInt(percent), scale: a.scale };
  const diff = add(lhs, negate(rhs)).units;
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}

/**
 * Đọc số tiền người dùng nhập theo kiểu Việt Nam: "1.500.000" hoặc "1500000,5".
 * Dấu chấm/khoảng trắng là phân cách hàng nghìn, dấu phẩy là thập phân. Trả về null nếu không hợp lệ.
 */
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/[\s.]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return tryToMoney(cleaned);
}

/** Ngược lại với parseMoneyInput: đưa số từ database vào ô nhập (dấu phẩy thập phân, không phân cách nghìn). */
export function toMoneyInput(value: NumericValue): string {
  const n = tryToMoney(value);
  if (n === null) {
    console.warn('[Smart Spend] Không đọc được số tiền để sửa, để trống ô nhập:', value);
    return '';
  }
  return String(n).replace('.', ',');
}

export function formatMoney(value: number, currency = 'VND'): string {
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat('vi-VN').format(value);
  }
}

/** Định dạng trực tiếp một giá trị NUMERIC từ database; giá trị hỏng hiển thị rõ ràng, không phải "0 ₫". */
export function formatAmount(value: NumericValue, currency = 'VND'): string {
  const n = tryToMoney(value);
  return n === null ? 'Số tiền không hợp lệ' : formatMoney(n, currency);
}
