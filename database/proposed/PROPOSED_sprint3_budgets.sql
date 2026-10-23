-- =====================================================================================================
-- ***ĐÃ THAY THẾ - KHÔNG CHẠY FILE NÀY***
-- Chủ dự án xác nhận database Production ĐÃ CÓ: ss_budgets_category_unique, ss_budgets_total_unique, ss_budget_audit,
-- ss_budgets_category_type và ss_budgets_guard. File dưới đây chỉ còn để lưu lại lịch sử đề xuất của Sprint 3.
-- Chạy nó sẽ tạo index/trigger trùng lặp với các thành phần đã có.
-- =====================================================================================================

-- =====================================================================================================
-- ĐỀ XUẤT MIGRATION SPRINT 3 - ***CHƯA CHẠY, CHỜ PHÊ DUYỆT***
-- Không được tự động chạy. Mỗi phần là ĐỘC LẬP và CÓ ĐIỀU KIỆN: chỉ chạy phần mà database/verify_sprint3.sql
-- chứng minh là đang thiếu. Không đụng bảng Học Vèo, không đổi RLS, không đổi cột/kiểu dữ liệu hiện có.
-- =====================================================================================================

-- =====================================================================================================
-- PHẦN A. UNIQUE chống trùng ngân sách (chỉ chạy nếu verify_sprint3.sql mục 2 cho thấy CHƯA có)
-- -----------------------------------------------------------------------------------------------------
-- Lý do: giao diện đã chặn trùng, nhưng hai tab/thiết bị tạo cùng lúc vẫn có thể lọt. Ràng buộc UNIQUE thông thường
-- trên (user_id, period_type, period_start, category_id) KHÔNG chặn trùng ngân sách TỔNG vì category_id = NULL
-- (trong PostgreSQL NULL khác NULL). Do đó dùng hai index riêng.
-- Ảnh hưởng dữ liệu hiện tại: nếu verify_sprint3.sql mục 9 trả về dòng nào thì lệnh CREATE UNIQUE INDEX sẽ THẤT BẠI
-- (không mất dữ liệu). Phải xử lý các bản ghi trùng trước (giữ một, xóa/gộp các dòng còn lại) rồi mới chạy lại.
-- Ảnh hưởng ứng dụng: lỗi 23505 đã được frontend dịch thành "Đã có ngân sách cùng loại kỳ...".
-- Hoàn tác: DROP INDEX ... (xem cuối phần).
-- =====================================================================================================
-- Kiểm tra trước (phải trả về 0 dòng):
--   select user_id, period_type, period_start, category_id, count(*) from public.ss_budgets
--   group by 1,2,3,4 having count(*) > 1;

create unique index concurrently if not exists uq_ss_budgets_category_period
  on public.ss_budgets (user_id, period_type, period_start, category_id)
  where category_id is not null;

create unique index concurrently if not exists uq_ss_budgets_total_period
  on public.ss_budgets (user_id, period_type, period_start)
  where category_id is null;

-- Hoàn tác phần A:
--   drop index if exists public.uq_ss_budgets_category_period;
--   drop index if exists public.uq_ss_budgets_total_period;

-- =====================================================================================================
-- PHẦN B. Trigger ghi audit log (chỉ chạy nếu verify_sprint3.sql mục 4/5 cho thấy CHƯA có trigger ghi ss_budget_audit_logs)
-- -----------------------------------------------------------------------------------------------------
-- Lý do: yêu cầu "lịch sử điều chỉnh ngân sách" cần database tự ghi nhận; frontend KHÔNG được ghi bảng audit.
-- Thiết kế: hàm SECURITY DEFINER (chạy với quyền chủ sở hữu) để ghi log kể cả khi authenticated không có quyền INSERT
-- vào bảng audit. Dùng user_id của bản ghi ngân sách. Chỉ ghi khi tạo, khi amount thay đổi, và khi xóa.
-- LƯU Ý QUAN TRỌNG VỀ KHÓA NGOẠI: nếu ss_budget_audit_logs.budget_id có FK tới ss_budgets (verify mục 6):
--   * ON DELETE CASCADE  -> log 'delete' sẽ bị xóa cùng ngân sách (mất lịch sử); không nên ghi log DELETE.
--   * không có ON DELETE / RESTRICT -> không xóa được ngân sách đã có log; cần cân nhắc đổi FK (KHÔNG nằm trong đề xuất này).
--   * không có FK -> ghi log DELETE bình thường.
-- Vì vậy phần DELETE dưới đây được TẮT mặc định (comment). Chỉ bật sau khi bạn quyết định theo kết quả mục 6.
-- Ảnh hưởng dữ liệu hiện tại: không sửa dữ liệu cũ; chỉ ghi log cho thay đổi TỪ SAU KHI tạo trigger.
-- Hoàn tác: DROP TRIGGER + DROP FUNCTION (xem cuối phần).
-- Giá trị cột `action`: xem verify_sprint3.sql mục 11 để dùng đúng giá trị/CHECK nếu bảng audit đã có ràng buộc.
-- =====================================================================================================
create or replace function public.ss_budgets_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ss_budget_audit_logs (user_id, budget_id, action, old_amount, new_amount)
    values (new.user_id, new.id, 'INSERT', null, new.amount);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.amount is distinct from old.amount then
      insert into public.ss_budget_audit_logs (user_id, budget_id, action, old_amount, new_amount)
      values (new.user_id, new.id, 'UPDATE', old.amount, new.amount);
    end if;
    return new;
  end if;
  -- DELETE: bật chỉ sau khi quyết định theo kết quả FK (xem cảnh báo ở trên)
  -- elsif tg_op = 'DELETE' then
  --   insert into public.ss_budget_audit_logs (user_id, budget_id, action, old_amount, new_amount)
  --   values (old.user_id, old.id, 'DELETE', old.amount, null);
  --   return old;
  -- end if;
  return null;
end;
$$;

drop trigger if exists trg_ss_budgets_audit on public.ss_budgets;
create trigger trg_ss_budgets_audit
  after insert or update on public.ss_budgets
  for each row execute function public.ss_budgets_audit();

-- Không cấp quyền thực thi hàm cho anon/authenticated: hàm chỉ chạy qua trigger.
revoke all on function public.ss_budgets_audit() from public, anon, authenticated;

-- Hoàn tác phần B:
--   drop trigger if exists trg_ss_budgets_audit on public.ss_budgets;
--   drop function if exists public.ss_budgets_audit();

-- =====================================================================================================
-- KHÔNG đề xuất: thay đổi RLS, khóa ngoại, hay quyền của bảng audit. Nếu verify mục 7 cho thấy authenticated đang có
-- quyền INSERT/UPDATE/DELETE trên ss_budget_audit_logs, hãy báo lại để cân nhắc riêng (đó là vấn đề bảo mật).
-- =====================================================================================================
