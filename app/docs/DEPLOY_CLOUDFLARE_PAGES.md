# Triển khai Smart Spend lên Cloudflare Pages

Smart Spend là một ứng dụng React/Vite chạy hoàn toàn ở trình duyệt, kết nối trực tiếp tới Supabase bằng **anon (publishable) key**.
Triển khai độc lập với website Học Vèo: project Pages riêng, domain riêng. **Không tự deploy khi chưa được phê duyệt.**

## 1. Cấu hình build

| Mục | Giá trị |
|---|---|
| Framework preset | Vite (hoặc None) |
| Root directory | `app` |
| Build command | `npm run build` (chạy `tsc -b && vite build`) |
| Build output directory | `dist` |
| Node.js | 22 (file `app/.node-version`) hoặc biến `NODE_VERSION=22` |

Biến môi trường (Settings → Environment variables, đặt cho cả **Production** và **Preview**):

| Biến | Giá trị |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key |

- **Chỉ dùng anon/publishable key.** Tuyệt đối không đặt `service_role` hay `sb_secret_...`.
- Biến `VITE_*` được nhúng vào bản build tại thời điểm build: đổi giá trị thì phải build lại.
- Anon key nằm trong JavaScript phía trình duyệt là bình thường; dữ liệu được bảo vệ bởi RLS ở database.

## 2. Định tuyến SPA

- `public/_redirects` có dòng `/* /index.html 200`, nên truy cập trực tiếp hoặc tải lại `/dashboard`, `/expenses`, `/reports`... đều trả về
  `index.html` rồi React Router xử lý. Route không tồn tại chuyển về `/dashboard` (và về `/login` nếu chưa đăng nhập).
- `public/_headers` thêm các header bảo mật cơ bản và cache dài cho `/assets/*`. Chưa bật Content-Security-Policy mặc định vì cần liệt kê
  `https://*.supabase.co` (connect-src) và Google Fonts (style-src, font-src); xem mục 6 nếu muốn bật.
- Sau khi deploy, kiểm tra thủ công: mở trực tiếp `/reports`, tải lại `/expenses`, mở một đường dẫn bậy (ví dụ `/abc`).

## 3. Supabase Auth: domain riêng cho Smart Spend

Hai website dùng chung MỘT Supabase project. **Không đổi Site URL** (đó là cấu hình của Học Vèo, chỉ có một giá trị cho cả project).

1. Smart Spend đăng nhập bằng email và mật khẩu, không có luồng chuyển hướng (không OAuth, không magic link, chưa có đặt lại mật khẩu).
   Vì vậy thông thường **không cần đổi gì** ở Authentication → URL Configuration.
2. Nếu sau này thêm luồng cần chuyển hướng, chỉ **thêm** domain Smart Spend vào danh sách **Redirect URLs**
   (ví dụ `https://smartspend.example.com/**` và `https://*.smartspend.pages.dev/**` cho bản xem trước). Không xóa hay sửa các URL của Học Vèo.
3. Email do Supabase gửi (xác nhận, đặt lại mật khẩu) dùng Site URL của project, tức là trỏ về Học Vèo, trừ khi ứng dụng truyền `redirectTo`
   nằm trong danh sách cho phép.
4. Phiên đăng nhập lưu theo origin (localStorage). Domain mới là origin mới nên **không tự chia sẻ phiên** với Học Vèo: người dùng đăng nhập lại.
5. CORS: API Supabase chấp nhận gọi từ trình duyệt với anon key, không cần thêm domain.

## 4. Các bước triển khai (khi được phê duyệt)

1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git, chọn repository, đặt Root directory `app`.
2. Điền cấu hình build và 2 biến môi trường như mục 1, bấm Save and Deploy.
3. Custom domains → thêm domain riêng của Smart Spend (CNAME về `<project>.pages.dev`).
4. Chạy checklist nghiệm thu trong `RELEASE_CHECKLIST.md` trên domain mới.

Hoặc tải thủ công: `cd app && npm ci && npm run build`, rồi kéo thư mục `dist` vào Pages (Direct Upload). Khi đó nhớ có file `.env.local`
đúng trên máy build.

## 5. Quay lại phiên bản cũ

Pages → Deployments → chọn bản trước → Rollback. Dữ liệu người dùng nằm ở Supabase nên không bị ảnh hưởng bởi việc deploy lại.

## 6. (Tùy chọn) Content-Security-Policy

Thêm vào `public/_headers` sau khi thử trên bản Preview:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://<project-ref>.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

`'unsafe-inline'` cho style là cần thiết vì biểu đồ (Recharts) đặt style trực tiếp. Nên thử bằng `Content-Security-Policy-Report-Only` trước.
