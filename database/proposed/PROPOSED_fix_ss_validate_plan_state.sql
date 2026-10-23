-- =====================================================================================================
-- ĐỀ XUẤT SỬA LỖI 42703 `record "new" has no field "status"` - ***CHƯA CHẠY, CHỜ PHÊ DUYỆT***
-- =====================================================================================================
--
-- LỖI
--   Hàm public.ss_validate_plan_state() (trigger dùng chung cho ss_expenses và ss_expense_plans) viết dạng:
--       IF TG_TABLE_NAME = 'ss_expenses' AND NEW.plan_id IS NOT NULL THEN ...
--       ELSIF TG_TABLE_NAME = 'ss_expense_plans' AND NEW.status = 'cancelled' THEN ...
--   Với chi tiêu KHÔNG gắn kế hoạch (plan_id rỗng) nhánh IF sai nên chương trình đánh giá vế ELSIF và đọc NEW.status
--   trên bảng ss_expenses (không có cột status) => 42703. Hậu quả: thêm/sửa chi tiêu ngoài kế hoạch đều lỗi.
--   Chi tiêu có gắn kế hoạch và thao tác trên ss_expense_plans không bị ảnh hưởng.
--
-- CÁCH SỬA (tối thiểu, giữ nguyên 100% quy tắc nghiệp vụ)
--   Tách theo bảng trước, rồi mới xét cột của bảng đó (IF lồng nhau):
--     - ss_expenses có plan_id: cấm ghi chi tiêu vào kế hoạch ĐÃ HỦY của cùng người dùng;
--     - ss_expense_plans chuyển sang 'cancelled': cấm nếu đã có chi tiêu liên kết.
--
-- ẢNH HƯỞNG
--   - Dữ liệu: KHÔNG sửa, xóa hay thêm dòng nào. Không đổi cấu trúc bảng, trigger hay RLS.
--   - Chỉ thay nội dung MỘT hàm của Smart Spend. Không đụng các hàm/bảng của Học Vèo
--     (confirm_email_on_activate, handle_enrollment_update, notify_enrollment_status, prevent_role_change).
--   - Sau khi sửa: thêm/sửa chi tiêu ngoài kế hoạch hoạt động lại; hai quy tắc trên vẫn được cưỡng chế như cũ,
--     cùng thông báo lỗi cũ.
--   - Thực thi tức thời (CREATE OR REPLACE FUNCTION), không khóa bảng lâu.
--
-- HOÀN TÁC
--   Chạy lại đoạn "BẢN GỐC" ở cuối file (chính là hàm đang gây lỗi).
-- =====================================================================================================

-- ----------------------------------------------------------------------------------------------------
-- TRƯỚC KHI CHẠY (chỉ đọc): hàm này gắn vào những bảng nào? Phải chỉ có ss_expenses / ss_expense_plans.
-- ----------------------------------------------------------------------------------------------------
-- select c.relname as bang, t.tgname as trigger_name
-- from pg_trigger t
-- join pg_class c on c.oid = t.tgrelid
-- join pg_proc p on p.oid = t.tgfoid
-- where p.proname = 'ss_validate_plan_state' and not t.tgisinternal
-- order by 1, 2;

-- ----------------------------------------------------------------------------------------------------
-- BẢN SỬA
-- ----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ss_validate_plan_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'ss_expenses' THEN
    IF NEW.plan_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.ss_expense_plans p
        WHERE p.id = NEW.plan_id AND p.user_id = NEW.user_id AND p.status = 'cancelled') THEN
        RAISE EXCEPTION 'Cannot record expense against cancelled plan';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'ss_expense_plans' THEN
    IF NEW.status = 'cancelled' THEN
      IF EXISTS (SELECT 1 FROM public.ss_expenses e WHERE e.plan_id = NEW.id) THEN
        RAISE EXCEPTION 'Cannot cancel plan with linked expenses';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------------------------------
-- SAU KHI CHẠY: kiểm tra an toàn, không để lại thay đổi (ROLLBACK ở cuối). Mỗi lệnh phải KHÔNG lỗi.
-- (Nếu bảng chưa có dòng nào thì lệnh update không ảnh hưởng dòng nào và cũng không lỗi.)
-- ----------------------------------------------------------------------------------------------------
-- begin;
--   -- chi tiêu ngoài kế hoạch (trước đây lỗi 42703):
--   update public.ss_expenses set description = description
--     where id = (select id from public.ss_expenses where plan_id is null limit 1);
--   -- chi tiêu có kế hoạch:
--   update public.ss_expenses set description = description
--     where id = (select id from public.ss_expenses where plan_id is not null limit 1);
--   -- kế hoạch:
--   update public.ss_expense_plans set title = title
--     where id = (select id from public.ss_expense_plans limit 1);
-- rollback;
--
-- Quy tắc vẫn còn hiệu lực (chạy riêng, trong begin ... rollback; mỗi lệnh PHẢI báo đúng lỗi):
--   -- hủy kế hoạch đang có chi tiêu liên kết => Cannot cancel plan with linked expenses
--   update public.ss_expense_plans set status = 'cancelled'
--     where id = (select plan_id from public.ss_expenses where plan_id is not null limit 1);

-- ----------------------------------------------------------------------------------------------------
-- BẢN GỐC (dùng để hoàn tác) - nguyên văn hàm hiện tại trên Production
-- ----------------------------------------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.ss_validate_plan_state()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SET search_path TO ''
-- AS $function$
-- BEGIN
--   IF TG_TABLE_NAME = 'ss_expenses' AND NEW.plan_id IS NOT NULL THEN
--     IF EXISTS (SELECT 1 FROM public.ss_expense_plans p
--       WHERE p.id = NEW.plan_id AND p.user_id = NEW.user_id AND p.status = 'cancelled') THEN
--       RAISE EXCEPTION 'Cannot record expense against cancelled plan';
--     END IF;
--   ELSIF TG_TABLE_NAME = 'ss_expense_plans' AND NEW.status = 'cancelled' THEN
--     IF EXISTS (SELECT 1 FROM public.ss_expenses e WHERE e.plan_id = NEW.id) THEN
--       RAISE EXCEPTION 'Cannot cancel plan with linked expenses';
--     END IF;
--   END IF;
--   RETURN NEW;
-- END;
-- $function$;
