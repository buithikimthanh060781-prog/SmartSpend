-- =========================================================
-- SmartSpend 01_LEADS: danh sách đăng ký quan tâm từ landing page
-- Chạy trên cùng project Supabase với HocVeo. Chạy lại nhiều lần an toàn.
--
-- - Khách (anon) chỉ được THÊM, không đọc/sửa/xóa được.
-- - Chỉ ADMIN (profiles.role = 'ADMIN') xem được danh sách.
-- =========================================================

create table if not exists public.smartspend_leads (
  id bigint generated always as identity primary key,
  full_name text not null,
  email text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint smartspend_leads_name_len check (char_length(trim(full_name)) between 1 and 100),
  constraint smartspend_leads_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  constraint smartspend_leads_note_len check (note is null or char_length(note) <= 500)
);

-- Mỗi email chỉ đăng ký một lần (không phân biệt hoa thường)
create unique index if not exists uq_smartspend_leads_email on public.smartspend_leads (lower(email));

alter table public.smartspend_leads enable row level security;

drop policy if exists "smartspend_leads_insert_anon" on public.smartspend_leads;
create policy "smartspend_leads_insert_anon"
  on public.smartspend_leads for insert
  to anon, authenticated
  with check (true);

drop policy if exists "smartspend_leads_select_admin" on public.smartspend_leads;
create policy "smartspend_leads_select_admin"
  on public.smartspend_leads for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

revoke all on public.smartspend_leads from anon, authenticated;
grant insert on public.smartspend_leads to anon, authenticated;
grant select on public.smartspend_leads to authenticated;
