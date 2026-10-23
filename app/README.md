# Smart Spend - Sprint 1

React + TypeScript + Vite, Tailwind, Supabase (dùng chung project Học Vèo), triển khai Cloudflare Pages.

## Chạy localhost

```bash
cd app
npm install
copy .env.example .env.local   # rồi điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
npm run dev                    # http://localhost:5173
npm run build                  # kiểm tra TypeScript + build
```

Cloudflare Pages: root `app`, build command `npm run build`, output `dist`, thêm 2 biến môi trường `VITE_*`.
File `public/_redirects` xử lý routing SPA.

## Cấu trúc

```
src/
  auth/AuthProvider.tsx        session + signOut
  components/                  AppLayout, Sidebar, Topbar, ProtectedRoute, StatCard,
                               BudgetProgress, EmptyState, LoadingSkeleton, ErrorState, ConfirmDialog
  components/ui/               button, card, input, skeleton, dialog (kiểu shadcn)
  features/dashboard/          useDashboard (truy vấn Supabase thật)
  lib/                         supabase, account (RPC), money, dates, errors, utils
  pages/                       Login, Dashboard, ComingSoon, MissingConfig
  types/db.ts                  kiểu 7 bảng ss_*
```

## Kiểm thử Supabase (dùng tài khoản test riêng, KHÔNG dùng Production)

1. Đăng nhập đúng -> vào /dashboard; sai mật khẩu -> báo lỗi.
2. Mở /dashboard khi chưa đăng nhập -> chuyển về /login.
3. Sau đăng nhập RPC `ss_initialize_account()` chạy. Kiểm tra trong SQL Editor:
   `select count(*) from ss_categories where user_id = '<uuid test>';` -> 15.
4. Đăng xuất, đăng nhập lại (RPC chạy lần 2) -> vẫn 15 danh mục.
5. Đăng nhập tài khoản B, xác nhận không thấy dữ liệu của A (RLS).

## Sprint 4 - Báo cáo, phân tích, xuất file, phát hành

- **Báo cáo** (`/reports`, 6 phân hệ): Tổng quan, Theo thời gian (cột/đường, ngày/tuần ISO/tháng, mốc trống = 0), Theo danh mục
  (donut, cột, bảng, bấm vào danh mục xem giao dịch), Kế hoạch, Ngân sách, So sánh kỳ.
  Logic nằm ở `src/reports/` (hàm thuần, có test): `ranges` (khoảng ngày nửa mở, so sánh cùng số ngày), `summary`, `series`, `categories`,
  `plans`, `comparison`, `periodComparison`, `insights`, `monthAnalytics`.
- **Quy tắc**: thu nhập chỉ tính `received`; kế hoạch chưa thực hiện/`planned_amount` không bao giờ vào chi tiêu; mẫu số 0 -> "Không áp dụng";
  kỳ trước = 0 -> không tính tỷ lệ tăng trưởng; kỳ đang diễn ra so sánh theo cùng số ngày đã trôi qua. Ngày là chuỗi `YYYY-MM-DD` (không qua `Date`
  địa phương) nên không lệch múi giờ.
- **Dashboard**: thao tác nhanh (`?new=1` mở sẵn form), thay đổi so với cùng kỳ tháng trước, biểu đồ tương tác, nhận xét theo quy tắc
  (không phải AI, mỗi nhận xét có số liệu chứng minh).
- **Xuất file** (`src/export/`): CSV (UTF-8 BOM, CRLF, RFC 4180, ngày dd/MM/yyyy, tiền dạng số thuần) và Excel (ExcelJS, tải khi cần;
  báo cáo tổng hợp 6 sheet, header Navy, freeze, auto filter, định dạng ngày/tiền/phần trăm, hàng tổng cộng). Chống formula injection.
  Xuất TOÀN BỘ kết quả lọc (phân trang nội bộ), giới hạn 50.000 dòng/lần và báo lỗi rõ khi vượt. Dữ liệu chỉ nằm trong trình duyệt.
  Lưu ý Excel Windows tiếng Việt: nếu mở CSV thấy dồn một cột, dùng Data -> From Text/CSV hoặc dùng file .xlsx.
- **Triển khai**: xem `docs/DEPLOY_CLOUDFLARE_PAGES.md` và `docs/RELEASE_CHECKLIST.md`.

## Sprint 3 - Ngân sách và cảnh báo

Route `/budgets` (danh sách theo kỳ/khoảng thời gian, tạo, sửa hạn mức, xóa, lịch sử thay đổi) và khối "Ngân sách" trên Dashboard.

- **Quy ước kỳ** (`lib/periods.ts`): `[period_start, period_end)`; daily = +1 ngày; weekly = Thứ Hai ISO, +7 ngày; monthly = ngày 01 đến ngày 01 tháng sau.
  Ngày bắt đầu/kết thúc luôn do hệ thống tính từ ngày người dùng chọn, không nhập tay.
- **Engine** (`services/budgetCalculation.ts`, hàm thuần): thực chi = SUM(expenses) cùng user, trong kỳ, đúng danh mục (nếu là ngân sách
  danh mục), gồm cả chi trong và ngoài kế hoạch, KHÔNG gồm `planned_amount`. Trạng thái so sánh chính xác bằng số nguyên lớn
  (`comparePercent`), không làm tròn phần trăm: <80% safe, 80%..<100% warning, =100% exhausted, >100% exceeded.
  Hạn mức 0: chưa chi = exhausted (chưa vượt), có chi = exceeded; không chia cho 0. Các ngân sách được đánh giá ĐỘC LẬP, không cộng gộp.
- **Cảnh báo** (`services/budgetAlerts.ts`, `alertSession.ts`): tính từ dữ liệu thật. Toast chỉ bắn trong thao tác ghi chi tiêu, khi ngưỡng
  mới được chạm/vượt (so sánh trước/sau), mỗi sự kiện một lần; không chặn việc ghi chi tiêu. Không gửi email/SMS/push.
- **Sửa ngân sách**: chỉ sửa được hạn mức; đổi kỳ/ngày/danh mục = tạo ngân sách mới. Thay đổi lớn cần xác nhận.
- **Audit log**: chỉ đọc. Ghi log là việc của trigger ở database. Xem `database/verify_sprint3.sql` và `database/proposed/` (CHƯA chạy).

## Kiểm thử tự động

`npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
`npm test` gồm: tiền chính xác (BigInt), ngày, hạn mức tháng, phân trang, cách ly cache giữa tài khoản
(`auth/userCacheGuard`), ràng buộc nghiệp vụ thu/chi/kế hoạch/danh mục (Supabase giả lập trong bộ nhớ), làm mới Dashboard.

### Kiểm thử thực tế với hai tài khoản test (Supabase thật)

Chạy trên database thật nên chỉ chạy khi bạn tự đặt biến môi trường (KHÔNG gửi mật khẩu cho ai):

```powershell
cd app
$env:SMARTSPEND_TEST_CONFIRM = 'yes'
$env:SMARTSPEND_TEST_A_EMAIL = '...'; $env:SMARTSPEND_TEST_A_PASSWORD = '...'
$env:SMARTSPEND_TEST_B_EMAIL = '...'; $env:SMARTSPEND_TEST_B_PASSWORD = '...'
npm run test:integration
```

Chỉ dùng anon key; chỉ ghi dữ liệu của hai tài khoản test (tiền tố `[IT-...]`, ngày năm 2099) và tự dọn dẹp.
Các mục "DATABASE phải từ chối ..." nếu FAIL nghĩa là database thiếu ràng buộc đó (xem `database/verify_sprint2_integrity.sql`).
Không có biến môi trường thì các mục này bị bỏ qua (skipped), không phải đã đạt.

## Sprint 2 - Thu nhập, chi tiêu, kế hoạch, danh mục

Cấu trúc: `services/` (truy vấn Supabase), `hooks/` (React Query), `schemas/` (Zod), `components/<module>/`, `pages/`.
Mọi thao tác ghi dùng phiên hiện tại (user_id lấy từ `useAuth`), chịu RLS; mọi thay đổi thu nhập/chi tiêu/kế hoạch
làm mới Dashboard (`useInvalidateMoney`). Danh mục: không xóa nếu đã có giao dịch (tắt thay vì xóa), danh mục mặc định
không xóa được trên giao diện, tên không trùng trong cùng loại (kiểm tra không phân biệt hoa thường).
Routes mới: `/plans/:id` (chi tiết kế hoạch + giao dịch liên kết).

Chưa xác minh (xem mục 9-11 của `database/verify_sprint1.sql`): giá trị `ss_categories.type` (đang giả định
`income`/`expense`, ở `src/lib/constants.ts`), hành vi FK khi xóa, nội dung các trigger, unique index tên danh mục.

## Luồng khởi tạo tài khoản

`ProtectedRoute` -> `AccountGate` gọi `ss_initialize_account()` đúng một lần cho mỗi người dùng trong phiên
(React Query, `staleTime: Infinity`), tự thử lại 2 lần với lỗi mạng/5xx, lỗi khác hiện nút "Thử lại" và "Đăng xuất".
Không tự đăng xuất khi RPC lỗi. Cache bị xóa khi đăng xuất.

## Kiểm chứng database (chỉ đọc)

Chạy [database/verify_sprint1.sql](../database/verify_sprint1.sql) trong SQL Editor: check constraint, định nghĩa RPC,
đủ 5 thu nhập + 10 chi tiêu, không trùng danh mục, RLS.

## Vấn đề cần giải quyết

- Quy tắc `ss_budgets` ĐÃ xác minh trên Production (xem `src/lib/budget.ts`): `period_type` chỉ `daily|weekly|monthly`,
  khoảng ngày nửa mở `[period_start, period_end)`.
- `ss_incomes.status = 'received'` chỉ là giá trị mặc định của cột; các trạng thái khác chưa xác minh.
- "Trong kế hoạch" = `ss_expenses.plan_id is not null`.
- Số tiền numeric được PostgREST trả về dạng số JSON; an toàn với VND (số nguyên), cần xem lại nếu dùng độ chính xác cao.
- Các kiểm thử cần tài khoản thật (đăng nhập, RPC, cách ly dữ liệu hai tài khoản) phải chạy tay với tài khoản test.
