interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

/** Các lỗi do ứng dụng tự tạo, đã có thông điệp tiếng Việt dành cho người dùng. */
const USER_FACING_ERRORS = ['BusinessRuleError', 'InvalidMoneyError', 'MoneyRangeError', 'DuplicateCategoryError', 'CategoryInUseError', 'DuplicateBudgetError', 'RowLimitError'];

function isUserFacing(e: ErrorLike): boolean {
  return USER_FACING_ERRORS.includes(e.name ?? '');
}

/**
 * Thông báo cho thao tác ghi (thêm/sửa/xóa). Dịch các lỗi ràng buộc của database sang tiếng Việt rõ ràng.
 * Với lỗi do trigger (P0001) giữ lại nội dung gốc từ database để người dùng biết quy tắc nào bị vi phạm.
 */
export function toMutationMessage(error: unknown, fallback = 'Không lưu được. Vui lòng thử lại.'): string {
  const e = (error ?? {}) as ErrorLike & { details?: string };
  if (isUserFacing(e)) return e.message ?? fallback;
  switch (e.code) {
    case '23505':
      return 'Dữ liệu bị trùng với bản ghi đã có.';
    case '23503':
      return 'Dữ liệu đang được liên kết với bản ghi khác (hoặc liên kết không hợp lệ), không thể thực hiện.';
    case '23514':
      return 'Giá trị không thỏa ràng buộc dữ liệu. Vui lòng kiểm tra lại các trường đã nhập.';
    case '23502':
      return 'Thiếu thông tin bắt buộc.';
    case '42501':
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 'P0001':
      return `Thao tác bị từ chối bởi quy tắc dữ liệu${e.message ? `: ${e.message}` : '.'}`;
    default: {
      const base = toUserMessage(error, fallback);
      // Lỗi không nhận dạng được: kèm mã và nội dung gốc thay vì câu chung chung, để biết database/mạng từ chối vì lý do gì.
      if (base === fallback && (e.code || e.message)) {
        console.error('[Smart Spend] Thao tác ghi thất bại:', error);
        return `${fallback} (${e.code ? `${e.code}: ` : ''}${e.message ?? 'không rõ nguyên nhân'})`;
      }
      return base;
    }
  }
}

/** Lỗi tạm thời (mạng, máy chủ quá tải) - đáng để tự thử lại. Lỗi quyền/hàm không tồn tại thì không. */
export function isTransientError(error: unknown): boolean {
  const e = (error ?? {}) as ErrorLike & { cause?: unknown };
  if (e.name === 'AccountInitError' && e.cause) return isTransientError(e.cause);
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) return true;
  return typeof e.status === 'number' && (e.status >= 500 || e.status === 429);
}

/** Chuyển lỗi Supabase / mạng sang thông báo tiếng Việt cho người dùng. */
export function toUserMessage(error: unknown, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string {
  const e = (error ?? {}) as ErrorLike;
  const msg = (e.message ?? '').toLowerCase();

  // Lỗi dữ liệu tiền và quy tắc nghiệp vụ đã mang sẵn thông điệp tiếng Việt cho người dùng.
  if (isUserFacing(e)) return e.message ?? fallback;

  // Lỗi khởi tạo tài khoản đã mang sẵn thông điệp chi tiết, nhưng vẫn ưu tiên lỗi mạng/quyền cho người dùng.
  if (e.name === 'AccountInitError') {
    const cause = ((error as { cause?: unknown }).cause ?? {}) as ErrorLike;
    if (isTransientError(cause)) return toUserMessage(cause, fallback);
    if (cause.code === 'PGRST202' || cause.code === '42883') return toUserMessage(cause, fallback);
    return e.message ?? fallback;
  }

  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
    return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  }
  if (msg.includes('invalid login credentials')) return 'Email hoặc mật khẩu không đúng.';
  if (msg.includes('email not confirmed')) return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.';
  if (e.status === 429 || msg.includes('rate limit')) return 'Thao tác quá nhanh. Vui lòng đợi một lát rồi thử lại.';
  if (e.code === 'PGRST202' || e.code === '42883') return 'Không tìm thấy hàm khởi tạo tài khoản trên máy chủ.';
  if (e.code === '42501' || e.code === 'PGRST301' || msg.includes('jwt')) {
    return 'Phiên đăng nhập không hợp lệ hoặc không có quyền. Vui lòng đăng nhập lại.';
  }
  return fallback;
}

