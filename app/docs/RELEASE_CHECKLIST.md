# Checklist nghiệm thu cuối dự án Smart Spend

Ký hiệu: **[Đã kiểm tra]** = đã chạy thực tế và có kết quả; **[Cần bạn]** = cần tài khoản test/môi trường thật; **[Sau deploy]** = chỉ kiểm được trên domain thật.

## A. Mã nguồn và build
- [Đã kiểm tra] `npm ci` thành công.
- [Đã kiểm tra] `npm run typecheck` không lỗi.
- [Đã kiểm tra] `npm test`: tất cả test đạt.
- [Đã kiểm tra] `npm run build` thành công; `dist/` có `index.html`, `_redirects`, `_headers`.
- [Đã kiểm tra] Không có `service_role`, `sb_secret_...` hay JWT trong `dist/` và `src/` (chuỗi `sb_secret_` trong bundle là mã nhận diện tiền tố của `supabase-js`, không phải khóa).
- [Đã kiểm tra] Bản bàn giao (zip) không chứa `.env.local`, `.git`, `node_modules`, `dist`.

## B. Bảo mật dữ liệu
- [Đã kiểm tra] Mọi query key chứa `user.id`; cache bị hủy/xóa khi đổi hoặc đăng xuất tài khoản (unit test).
- [Đã kiểm tra] Không `dangerouslySetInnerHTML`, `eval`, hay lưu dữ liệu tài chính/token vào log (`console.log`).
- [Đã kiểm tra] CSV/Excel chống formula injection (unit test).
- [Cần bạn] Chạy `npm run test:integration` với hai tài khoản test: RLS, CHECK, unique, audit log, báo cáo (3 file `src/integration/*.integration.ts`).
- [Cần bạn] Chạy `database/verify_sprint2_integrity.sql` và `database/verify_sprint3.sql` (chỉ SELECT), xem kết quả khớp kỳ vọng.

## C. Chức năng (thử tay với tài khoản test)
- [Cần bạn] Đăng nhập, tải lại trang, đăng xuất, đăng nhập tài khoản khác: không thấy dữ liệu cũ.
- [Cần bạn] Danh mục, thu nhập, chi tiêu, kế hoạch, ngân sách: thêm, sửa, xóa; Dashboard cập nhật ngay.
- [Cần bạn] Báo cáo: đổi từng khoảng thời gian (7/30 ngày, tháng này/trước, 3/6/12 tháng, tùy chọn), đối chiếu với trang Thu nhập/Chi tiêu.
- [Cần bạn] Xuất CSV và Excel từ Thu nhập, Chi tiêu, Kế hoạch, Ngân sách và Báo cáo tổng hợp; mở bằng Excel (Windows) kiểm tra tiếng Việt, ngày, tiền.
- [Cần bạn] Toast cảnh báo khi chi tiêu làm chạm 80% / vượt ngân sách.

## D. Giao diện
- [Cần bạn] Desktop và mobile (rộng 360px): không tràn ngang, bảng cuộn được, nút dễ chạm, biểu đồ co giãn.
- [Cần bạn] Bàn phím: Tab qua các điều khiển, thấy viền focus; hộp thoại đóng bằng Esc.
- [Cần bạn] Console trình duyệt không có lỗi đỏ khi duyệt các trang.

## E. Triển khai Cloudflare Pages (khi được phê duyệt)
- [Sau deploy] Mở trực tiếp và tải lại `/dashboard`, `/expenses`, `/reports`; mở `/abc` -> chuyển về trang hợp lệ.
- [Sau deploy] Đăng nhập và đăng xuất trên domain mới.
- [Sau deploy] Học Vèo vẫn hoạt động bình thường (đăng nhập, dữ liệu); Site URL của Supabase không bị đổi.
- [Sau deploy] Biến môi trường chỉ có `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.

## F. Những việc KHÔNG tự động làm
Không chạy SQL/migration Production, không sửa RLS, không đụng bảng Học Vèo, không deploy Production.
