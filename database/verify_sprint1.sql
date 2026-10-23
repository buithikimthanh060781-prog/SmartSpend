-- =========================================================
-- Smart Spend Sprint 1 - KIỂM CHỨNG (CHỈ ĐỌC, không sửa dữ liệu/RLS)
-- Chạy từng mục trong Supabase SQL Editor và gửi kết quả để chốt quy tắc dữ liệu.
-- Tất cả đều là SELECT.
-- =========================================================

-- 1. Check constraint của 7 bảng ss_* (giá trị hợp lệ của status/type/period_type/payment_method/action)
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid::regclass::text like 'public.ss\_%' and contype = 'c'
order by 1, 2;

-- 2. Định nghĩa RPC ss_initialize_account: có idempotent không, có xóa danh mục tùy chỉnh không
select pg_get_functiondef('public.ss_initialize_account'::regproc);

-- 3. Danh mục mặc định theo từng người dùng: phải đủ 5 thu nhập + 10 chi tiêu
select user_id, type, count(*) as default_categories
from public.ss_categories
where is_default
group by user_id, type
order by user_id, type;

-- 4. Người dùng có tổng danh mục mặc định KHÁC 15 (kỳ vọng: không có dòng nào)
select user_id, count(*) as default_total
from public.ss_categories
where is_default
group by user_id
having count(*) <> 15;

-- 5. Danh mục trùng (cùng user, cùng type, cùng tên không phân biệt hoa thường) - kỳ vọng: không có dòng nào
select user_id, type, lower(name) as name, count(*) as duplicates
from public.ss_categories
group by user_id, type, lower(name)
having count(*) > 1;

-- 6. Mỗi người dùng chỉ có đúng một ss_settings - kỳ vọng: không có dòng nào
select user_id, count(*) from public.ss_settings group by user_id having count(*) > 1;

-- 7. Các loại period_type và dạng khoảng ngày thực tế đang có trong ss_budgets
select period_type,
       (category_id is null) as is_overall,
       min(period_end - period_start) as min_days_span,
       max(period_end - period_start) as max_days_span,
       count(*) as rows
from public.ss_budgets
group by 1, 2
order by 1, 2;

-- 9. (Sprint 2) Khóa ngoại: hành vi ON DELETE của category_id / plan_id (RESTRICT, SET NULL, CASCADE?)
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f' and conrelid::regclass::text like 'public.ss\_%'
order by 1, 2;

-- 10. (Sprint 2) Trigger: kiểm tra liên kết kế hoạch-giao dịch, chặn hủy kế hoạch có giao dịch, audit ngân sách
select event_object_table as table_name, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema = 'public' and event_object_table like 'ss\_%'
order by 1, 2;

select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_trigger t on t.tgfoid = p.oid
join pg_class c on c.oid = t.tgrelid
where c.relname like 'ss\_%' and not t.tgisinternal;

-- 11. (Sprint 2) Chỉ mục duy nhất (chặn trùng tên danh mục theo user + type ở mức database?)
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename like 'ss\_%' and indexdef ilike '%unique%'
order by 1, 2;

-- 8. Policy RLS đang áp dụng trên các bảng ss_* (chỉ xem, không sửa)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename like 'ss\_%'
order by tablename, policyname;
