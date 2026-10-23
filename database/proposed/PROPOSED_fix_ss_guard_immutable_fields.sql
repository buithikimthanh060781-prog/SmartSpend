-- =====================================================================================================
-- ĐỀ XUẤT SỬA LỖI 42703 `record "new" has no field "type"` - ***CHƯA CHẠY, CHỜ PHÊ DUYỆT***
-- =====================================================================================================
--
-- LỖI
--   Hàm public.ss_guard_immutable_fields() (trigger BEFORE UPDATE dùng chung cho nhiều bảng ss_*) có đoạn:
--       IF TG_TABLE_NAME = 'ss_categories' AND NEW.type IS DISTINCT FROM OLD.type THEN ...
--   PL/pgSQL kiểm tra tên cột NEW.type khi biên dịch cả biểu thức, KHÔNG phụ thuộc vế `TG_TABLE_NAME = 'ss_categories'`
--   đứng trước (không có "short-circuit" đảm bảo). Với mọi bảng KHÔNG có cột `type` (ss_incomes, ss_expenses,
--   ss_expense_plans, ss_budgets) mọi câu UPDATE đều thất bại với lỗi 42703.
--
-- CÁCH SỬA (tối thiểu, không đổi hành vi nghiệp vụ)
--   Chỉ thay hàm bằng CREATE OR REPLACE: đưa so sánh NEW.type vào một khối IF LỒNG BÊN TRONG, chỉ được đánh giá
--   khi đang ở bảng ss_categories. Toàn bộ quy tắc khác giữ nguyên:
--     - không đổi id / user_id (ss_settings: không đổi user_id);
--     - ss_categories không được đổi type;
--     - tự cập nhật updated_at.
--
-- ẢNH HƯỞNG
--   - Dữ liệu: KHÔNG sửa, xóa hay thêm dòng nào. Không đổi cấu trúc bảng, không tạo/xóa trigger, không đụng RLS.
--   - Hàm: chỉ thay nội dung một hàm. Trigger đang gắn vẫn gọi đúng tên hàm này.
--   - Hành vi sau khi sửa: sửa thu nhập/chi tiêu/kế hoạch/ngân sách hoạt động lại; sửa danh mục và ss_settings giữ nguyên
--     như hiện tại; đổi type của danh mục vẫn bị chặn với đúng thông báo cũ.
--   - Bảng Học Vèo: không liên quan (hàm này chỉ do các trigger ss_* gọi). Kiểm tra mục TRƯỚC KHI CHẠY để chắc chắn.
--   - Thực thi: CREATE OR REPLACE FUNCTION là thao tác tức thời, không khóa bảng lâu.
--
-- HOÀN TÁC
--   Chạy lại đoạn "BẢN GỐC" ở cuối file (nguyên văn hàm hiện tại do bạn gửi). Lưu ý bản gốc chính là bản đang gây lỗi.
-- =====================================================================================================

-- ----------------------------------------------------------------------------------------------------
-- TRƯỚC KHI CHẠY (chỉ đọc): hàm này đang gắn vào những bảng nào? Phải chỉ có bảng ss_*.
-- ----------------------------------------------------------------------------------------------------
-- select c.relname as bang, t.tgname as trigger_name
-- from pg_trigger t
-- join pg_class c on c.oid = t.tgrelid
-- join pg_proc p on p.oid = t.tgfoid
-- where p.proname = 'ss_guard_immutable_fields' and not t.tgisinternal
-- order by 1, 2;

-- ----------------------------------------------------------------------------------------------------
-- BẢN SỬA
-- ----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ss_guard_immutable_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'ss_settings' THEN
      IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Cannot change owner';
      END IF;
    ELSE
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Cannot change identity or owner';
      END IF;
    END IF;

    -- Chỉ ss_categories có cột `type`. Khối IF lồng nhau đảm bảo NEW.type / OLD.type chỉ được biên dịch
    -- và đánh giá khi đang ở bảng này (sửa lỗi 42703 trên các bảng không có cột type).
    IF TG_TABLE_NAME = 'ss_categories' THEN
      IF NEW.type IS DISTINCT FROM OLD.type THEN
        RAISE EXCEPTION 'Cannot change category type';
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------------------------------
-- SAU KHI CHẠY: kiểm tra an toàn, không để lại thay đổi (ROLLBACK ở cuối). Chạy trong SQL Editor.
-- Lưu ý: SQL Editor chạy bằng quyền cao nên không bị RLS; chỉ để thử trigger. Mỗi lệnh phải KHÔNG lỗi.
-- ----------------------------------------------------------------------------------------------------
-- begin;
--   update public.ss_incomes       set description = description where id = (select id from public.ss_incomes limit 1);
--   update public.ss_expenses      set description = description where id = (select id from public.ss_expenses limit 1);
--   update public.ss_expense_plans set title       = title       where id = (select id from public.ss_expense_plans limit 1);
--   update public.ss_budgets       set amount      = amount      where id = (select id from public.ss_budgets limit 1);
--   update public.ss_categories    set name        = name        where id = (select id from public.ss_categories limit 1);
-- rollback;
--
-- Quy tắc vẫn còn hiệu lực (mỗi lệnh PHẢI báo đúng lỗi bên dưới; chạy từng lệnh riêng, trong begin ... rollback):
--   update public.ss_categories set type = case when type = 'income' then 'expense' else 'income' end
--     where id = (select id from public.ss_categories limit 1);          -- => Cannot change category type
--   update public.ss_incomes set user_id = gen_random_uuid()
--     where id = (select id from public.ss_incomes limit 1);              -- => Cannot change identity or owner

-- ----------------------------------------------------------------------------------------------------
-- BẢN GỐC (dùng để hoàn tác) - nguyên văn hàm hiện tại trên Production
-- ----------------------------------------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.ss_guard_immutable_fields()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SET search_path TO ''
-- AS $function$
-- BEGIN
--   IF TG_OP = 'UPDATE' THEN
--     IF TG_TABLE_NAME = 'ss_settings' THEN
--       IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
--         RAISE EXCEPTION 'Cannot change owner';
--       END IF;
--     ELSE
--       IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
--         RAISE EXCEPTION 'Cannot change identity or owner';
--       END IF;
--     END IF;
--     IF TG_TABLE_NAME = 'ss_categories' AND NEW.type IS DISTINCT FROM OLD.type THEN
--       RAISE EXCEPTION 'Cannot change category type';
--     END IF;
--   END IF;
--   NEW.updated_at := now();
--   RETURN NEW;
-- END;
-- $function$;
