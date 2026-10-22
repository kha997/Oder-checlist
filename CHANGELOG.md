# Changelog

Mọi thay đổi đáng kể của dự án được ghi ở đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), phiên bản theo [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- **Xuất PDF bị hỏng hoàn toàn.** Nút "Tải File PDF" luôn báo lỗi. Nguyên nhân: Tailwind CSS v4 phát bảng màu dưới dạng `oklch()` và ghi gradient kèm gợi ý nội suy `in oklab`, cả hai đều không được html2canvas 1.4.1 hiểu. Nay CSS được chuyển sang sRGB ngay lúc build. Đã xác minh: file PDF 3 trang, 243 kB, đúng cấu trúc `%PDF`.
- `npm install` từ một bản clone sạch trước đây thất bại vì xung đột phiên bản `esbuild`.

### Security

- **Đóng truy cập Firestore ẩn danh.** Trước đây ai cũng đọc/ghi được collection `test`.
- **Loại bỏ trường `pin` dạng chữ thường** khỏi `users` — `firestore.rules` từ chối mọi document chứa `pin`, và `upsertStaffUserFirestore` ghi đè toàn bộ thay vì để lại giá trị cũ.
- Thêm kiểm tra hợp lệ cho `settings` (cấu hình ngân hàng) và `admins`; bắt buộc `documentId == data.id`; ràng buộc giá trị của `role` và `qrTemplate`.

### Changed

- **Tách bundle**: từ một file 2.161 kB xuống entry 196 kB, phần còn lại chia theo nhóm (`react`, `firebase`, `icons`, `vendor`). 8 màn hình chuyển sang `React.lazy` + `Suspense`. `jspdf` và `html2canvas` chỉ tải khi bấm xuất PDF.
- Bật `strict`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters` và `verbatimModuleSyntax`.
- Xóa code chết: 183 import và 40 biến/hàm/tham số không dùng.
- Bỏ các dependency không dùng: `@google/genai`, `express`, `dotenv`, `motion`, `tsx`, `@types/express`, `autoprefixer`.
- Đổi tên package `react-example` → `oder-checklist`.

### Added

- **Unit test** với Vitest: 51 test trên `searchHelper`, `csvExport`, `routeOptimizer`, `vietqr`.
- **Bộ kiểm thử `firestore.rules`** chạy thật với Firestore Emulator: 23 assertion.
- **CI trên GitHub Actions**: job `verify` (typecheck, test, build) và job `security-rules`.
- Lệnh `npm run verify` gom toàn bộ cổng kiểm tra.
- `LICENSE` (MIT), `firebase.json`, `firestore.indexes.json`.

## [1.0.0] — 2026-10-11

### Added

- Bản đầu tiên: 8 màn hình (Trang chủ, Tạo đơn, Giao hàng, Chưa thu, Kho hàng, Lịch sử, Báo cáo, Sổ công nợ).
- Lưu trữ `localStorage`, đồng bộ Firestore qua đăng nhập Google.
- Phân quyền theo vai trò Admin / Bếp / Shipper / Thu ngân.
- Tìm kiếm không dấu, sắp xếp lộ trình theo tầng, VietQR, in bảng kê, xuất CSV/Excel.
- Cài được lên màn hình chính (PWA), dùng offline.

[Unreleased]: https://github.com/kha997/Oder-checlist/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kha997/Oder-checlist/releases/tag/v1.0.0
