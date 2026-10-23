-- =========================================================
-- CHẨN ĐOÁN lỗi: 42703 record "new" has no field "type" khi sửa thu nhập
-- CHỈ ĐỌC (SELECT). Không sửa trigger, hàm, schema, RLS hay dữ liệu. Chạy từng mục trong Supabase SQL Editor và gửi kết quả.
-- Nghi vấn: một trigger trên ss_incomes (hoặc ss_expenses/ss_expense_plans) chạy hàm có đọc NEW.type,
-- nhưng các bảng này không có cột `type` (chỉ ss_categories có).
-- =========================================================

-- 1. Mọi trigger trên các bảng ss_* và hàm mà nó gọi
select c.relname as bang, t.tgname as trigger_name,
       case when t.tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end as thoi_diem,
       concat_ws(',', case when t.tgtype & 4 = 4 then 'INSERT' end, case when t.tgtype & 8 = 8 then 'DELETE' end, case when t.tgtype & 16 = 16 then 'UPDATE' end) as su_kien,
       p.proname as ham,
       pg_get_triggerdef(t.oid) as dinh_nghia_trigger
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where c.relname like 'ss\_%' and not t.tgisinternal
order by 1, 2;

-- 2. Các hàm có tham chiếu NEW.type / OLD.type (thủ phạm của lỗi 42703)
select p.proname as ham, pg_get_functiondef(p.oid) as noi_dung
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.prosrc ~* 'new\.type' or p.prosrc ~* 'old\.type')
order by 1;

-- 3. Trigger nào đang gắn các hàm ở mục 2 và gắn vào bảng nào
select c.relname as bang, t.tgname as trigger_name, p.proname as ham
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and (p.prosrc ~* 'new\.type' or p.prosrc ~* 'old\.type')
order by 1, 2;

-- 5. (CHẠY MỤC NÀY TRƯỚC) TOÀN BỘ hàm trigger đang dùng bởi các bảng ss_*, kèm bảng/sự kiện gắn vào.
--    Lỗi 42703 (new has no field "...") có thể ở nhiều hàm khác nhau; xem hết một lần để sửa đúng một lượt.
select c.relname as bang,
       t.tgname as trigger_name,
       case when t.tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end as thoi_diem,
       concat_ws(',', case when t.tgtype & 4 = 4 then 'INSERT' end, case when t.tgtype & 8 = 8 then 'DELETE' end, case when t.tgtype & 16 = 16 then 'UPDATE' end) as su_kien,
       p.proname as ham,
       pg_get_functiondef(p.oid) as noi_dung_ham
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where c.relname like 'ss\_%' and not t.tgisinternal
order by 1, 2;

-- 4. Các cột thực tế của ss_incomes, ss_expenses, ss_expense_plans (xác nhận KHÔNG có cột type)
select table_name, string_agg(column_name, ', ' order by ordinal_position) as cot
from information_schema.columns
where table_schema = 'public' and table_name in ('ss_incomes', 'ss_expenses', 'ss_expense_plans', 'ss_categories', 'ss_budgets')
group by table_name
order by 1;
