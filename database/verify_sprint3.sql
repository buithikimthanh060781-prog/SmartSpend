-- =========================================================
-- Smart Spend Sprint 3 - KIỂM CHỨNG NGÂN SÁCH & AUDIT LOG (CHỈ ĐỌC)
-- Toàn bộ là SELECT: không sửa schema, RLS, trigger hay dữ liệu. Chạy trong Supabase SQL Editor và gửi kết quả.
-- Kết quả quyết định có cần chạy database/proposed/PROPOSED_sprint3_budgets.sql hay không.
-- =========================================================

-- 1. CHECK constraint của ss_budgets (kỳ vọng: period_type, amount >= 0, quy tắc daily/weekly/monthly)
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.ss_budgets'::regclass and contype = 'c'
order by 1;

-- 2. UNIQUE trên ss_budgets: có chặn trùng (user_id, period_type, period_start, category_id) chưa?
--    Lưu ý: ngân sách TỔNG có category_id = NULL; UNIQUE thường KHÔNG chặn trùng khi có NULL (trừ khi dùng
--    NULLS NOT DISTINCT trên Postgres 15+, hoặc index riêng cho trường hợp NULL, hoặc coalesce).
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'ss_budgets' and indexdef ilike '%unique%'
order by 1;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.ss_budgets'::regclass and contype = 'u';

-- 3. Phiên bản Postgres (NULLS NOT DISTINCT cần >= 15)
select version();

-- 4. Trigger trên ss_budgets: có trigger ghi audit log chưa? (kỳ vọng: INSERT/UPDATE/DELETE -> ss_budget_audit_logs)
select tgname as trigger_name, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where t.tgrelid = 'public.ss_budgets'::regclass and not t.tgisinternal
order by 1;

-- 5. Nội dung hàm của các trigger đó (xem hành động ghi log, có SECURITY DEFINER không, giá trị cột `action`)
select distinct p.proname, p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition
from pg_trigger t join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.ss_budgets'::regclass and not t.tgisinternal;

-- 6. Khóa ngoại của ss_budget_audit_logs (budget_id -> ss_budgets: ON DELETE gì? ảnh hưởng việc xóa ngân sách)
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.ss_budget_audit_logs'::regclass and contype in ('f', 'c', 'u')
order by 1;

-- 7. RLS và policy của ss_budget_audit_logs (kỳ vọng: CHỈ SELECT theo user_id = auth.uid(); không có INSERT/UPDATE/DELETE cho authenticated)
select c.relrowsecurity as rls_enabled from pg_class c where c.oid = 'public.ss_budget_audit_logs'::regclass;
select policyname, cmd, roles, qual as using_expr, with_check
from pg_policies where schemaname = 'public' and tablename = 'ss_budget_audit_logs' order by cmd, policyname;
select grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'ss_budget_audit_logs' and grantee in ('anon', 'authenticated')
group by grantee;

-- 8. Policy của ss_budgets
select policyname, cmd, roles, qual as using_expr, with_check
from pg_policies where schemaname = 'public' and tablename = 'ss_budgets' order by cmd, policyname;

-- 9. DỮ LIỆU HIỆN TẠI: ngân sách đang trùng nhau (nếu có, KHÔNG thể thêm unique index trước khi xử lý) - kỳ vọng 0 dòng
select user_id, period_type, period_start, category_id, count(*) as duplicates, array_agg(id order by created_at) as ids
from public.ss_budgets
group by user_id, period_type, period_start, category_id
having count(*) > 1;

-- 10. DỮ LIỆU HIỆN TẠI: ngân sách trỏ tới danh mục không phải 'expense' hoặc của người dùng khác - kỳ vọng 0 dòng
select b.id, b.user_id as budget_user, c.user_id as category_user, c.type as category_type
from public.ss_budgets b join public.ss_categories c on c.id = b.category_id
where c.type <> 'expense' or c.user_id <> b.user_id;

-- 11. Giá trị cột `action` thực tế trong audit log (để giao diện hiển thị đúng tên hành động)
select action, count(*) from public.ss_budget_audit_logs group by action order by 2 desc;

-- 12. Ngân sách đã có thay đổi nhưng KHÔNG có dòng audit (dấu hiệu thiếu trigger) - chỉ tham khảo
select b.id, b.user_id, b.period_type, b.period_start, b.updated_at
from public.ss_budgets b
where not exists (select 1 from public.ss_budget_audit_logs l where l.budget_id = b.id)
order by b.updated_at desc
limit 20;
