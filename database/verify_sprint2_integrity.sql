-- =========================================================
-- Smart Spend Sprint 2 - KIỂM CHỨNG TOÀN VẸN DỮ LIỆU (CHỈ ĐỌC)
-- Toàn bộ là SELECT: không sửa schema, RLS hay dữ liệu. Chạy trong Supabase SQL Editor (role postgres,
-- nên bỏ qua RLS và thấy dữ liệu mọi người dùng). Gửi kết quả để quyết định có cần migration hay không.
-- Mục A-C cho biết database ĐÃ có ràng buộc nào; mục D tìm dữ liệu HIỆN TẠI đã vi phạm (ảnh hưởng nếu thêm ràng buộc).
-- =========================================================

-- A1. RLS có bật trên mọi bảng ss_* không (kỳ vọng: rls_enabled = true cho cả 7 bảng)
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'ss\_%'
order by 1;

-- A2. Policy theo từng bảng/lệnh. Kỳ vọng: mọi policy ràng buộc user_id = auth.uid() (cả USING và WITH CHECK)
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public' and tablename like 'ss\_%'
order by tablename, cmd, policyname;

-- A3. Quyền bảng cho anon/authenticated (kỳ vọng: anon KHÔNG có quyền trên ss_*)
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'ss\_%' and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by 1, 2;

-- B1. Toàn bộ CHECK constraint (enum status / payment_method / period_type / type, amount > 0 ...)
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'c' and conrelid::regclass::text like 'public.ss\_%'
order by 1, 2;

-- B2. Khóa ngoại và hành vi ON DELETE (category_id, plan_id)
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f' and conrelid::regclass::text like 'public.ss\_%'
order by 1, 2;

-- B3. Unique index (chặn trùng tên danh mục theo user + type?)
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename like 'ss\_%' and indexdef ilike '%unique%'
order by 1, 2;

-- C1. Trigger trên các bảng ss_* (liên kết kế hoạch-giao dịch, chặn hủy kế hoạch, audit ngân sách, updated_at)
select event_object_table as table_name, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema = 'public' and event_object_table like 'ss\_%'
order by 1, 2;

-- C2. Nội dung hàm của các trigger đó (để biết quy tắc nào đã được cưỡng chế ở database)
select distinct p.proname, pg_get_functiondef(p.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
where c.relname like 'ss\_%' and not t.tgisinternal
order by 1;

-- D. DỮ LIỆU HIỆN TẠI VI PHẠM QUY TẮC NGHIỆP VỤ (kỳ vọng: mọi truy vấn dưới đây trả về 0 dòng)

-- D1. Thu nhập dùng danh mục không phải 'income'
select i.id, i.user_id, c.name as category, c.type as category_type
from public.ss_incomes i join public.ss_categories c on c.id = i.category_id
where c.type <> 'income';

-- D2. Chi tiêu / kế hoạch dùng danh mục không phải 'expense'
select 'expense' as source, e.id, e.user_id, c.name as category, c.type as category_type
from public.ss_expenses e join public.ss_categories c on c.id = e.category_id where c.type <> 'expense'
union all
select 'plan', p.id, p.user_id, c.name, c.type
from public.ss_expense_plans p join public.ss_categories c on c.id = p.category_id where c.type <> 'expense';

-- D3. Giao dịch / kế hoạch trỏ tới danh mục của NGƯỜI DÙNG KHÁC
select 'income' as source, i.id, i.user_id as record_user, c.user_id as category_user
from public.ss_incomes i join public.ss_categories c on c.id = i.category_id where c.user_id <> i.user_id
union all
select 'expense', e.id, e.user_id, c.user_id
from public.ss_expenses e join public.ss_categories c on c.id = e.category_id where c.user_id <> e.user_id
union all
select 'plan', p.id, p.user_id, c.user_id
from public.ss_expense_plans p join public.ss_categories c on c.id = p.category_id where c.user_id <> p.user_id;

-- D4. Chi tiêu liên kết kế hoạch của NGƯỜI DÙNG KHÁC
select e.id as expense_id, e.user_id as expense_user, p.user_id as plan_user
from public.ss_expenses e join public.ss_expense_plans p on p.id = e.plan_id
where p.user_id <> e.user_id;

-- D5. Chi tiêu liên kết kế hoạch KHÁC DANH MỤC
select e.id as expense_id, e.category_id as expense_category, p.category_id as plan_category
from public.ss_expenses e join public.ss_expense_plans p on p.id = e.plan_id
where p.category_id <> e.category_id;

-- D6. Chi tiêu liên kết kế hoạch ĐÃ HỦY
select e.id as expense_id, p.id as plan_id, p.status
from public.ss_expenses e join public.ss_expense_plans p on p.id = e.plan_id
where p.status = 'cancelled';

-- D7. Danh mục trùng tên cùng loại (không phân biệt hoa thường/khoảng trắng thừa)
select user_id, type, lower(regexp_replace(trim(name), '\s+', ' ', 'g')) as normalized_name, count(*) as duplicates, array_agg(id) as ids
from public.ss_categories
group by 1, 2, 3
having count(*) > 1;

-- D8. Số tiền <= 0 (nếu chưa có CHECK amount > 0)
select 'income' as source, id, amount from public.ss_incomes where amount <= 0
union all select 'expense', id, amount from public.ss_expenses where amount <= 0
union all select 'plan', id, planned_amount from public.ss_expense_plans where planned_amount <= 0;

-- D9. Độ chính xác/thang đo cột numeric (để biết có vượt 15 chữ số hoặc quá 2 chữ số thập phân không)
select table_name, column_name, data_type, numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public' and table_name like 'ss\_%' and data_type = 'numeric'
order by 1, 2;
