# Changelog

Mọi thay đổi đáng kể của dự án được ghi ở đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), phiên bản theo [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security

- **RBAC phía server cho Firestore.** Role được phân giải từ `staffRoles/{uid}`, mỗi tài khoản Google riêng cần được cấp quyền mới có thể đọc/ghi. `staffRequests/{uid}` dùng để yêu cầu truy cập (không thể tự gán role). Bootstrap email `khafibo@gmail.com` và `admins/{uid}` giữ quyền admin. Thu hồi quyền = xoá `staffRoles/{uid}`. Rules chặn tài khoản chưa được phân quyền hoàn toàn; đồng bộ cloud chỉ ghi các collection được phép theo role. Khi admin thu hồi quyền, app tự động đăng xuất ngay (listener realtime `staffRoles/{uid}`).
- **UI phê duyệt quyền.** Thêm tab "Phân quyền truy cập" trong `StaffManagementModal` cho admin: duyệt/từ chối yêu cầu, gán/thu hồi role. Badge hiển thị số yêu cầu chờ duyệt ở Header.
- **Trải nghiệm "chưa được phân quyền".** Banner toàn cục hiển thị trạng thái `needs_role`, kèm nút **"Gửi lại yêu cầu"** để gửi lại yêu cầu truy cập nhanh chóng. Khi đã có role từ server, UI cảnh báo rõ ràng rằng việc đổi persona chỉ ảnh hưởng đến tên hiển thị, không mở khóa quyền.
- **Đóng truy cập Firestore ẩn danh.** Trước đây ai cũng đọc/ghi được collection `test`.

### Added

- **Multi-tenant self-serve (P3) — ai cũng tạo được cửa hàng riêng.** Đăng nhập Google xong, app tự kiểm tra backend (`probeAccount` đọc `accounts/{uid}`): nếu rules mới chưa deploy thì chạy đúng như cũ (không cần feature flag); nếu đã deploy thì hiện `OnboardingModal` — **Tạo cửa hàng** (mỗi tài khoản 1 shop, server-enforced) hoặc **Tham gia bằng mã mời** (deep link `?join=CODE`, trạng thái chờ duyệt). `createShop` ghi theo đúng thứ tự rules đọc: index `shops:[]` → `shops/{sid}` → seat ADMIN → mã mời → grow index **cuối cùng** (thất bại giữa chừng retry an toàn). `joinShop` chỉ tạo seat `pending` kèm `inviteCode` và ghi index dạng `pendingShops` — chưa duyệt thì không thấy dữ liệu shop. Trạng thái 'chờ duyệt' hiển thị banner riêng, vẫn dùng local-first được.
- **Tenancy state trong AppContext.** `tenancyMode` / `shopStatus` (`none`|`pending`|`active`) / `currentShop` / `shopAccount` + actions `createShopAction`/`joinShopAction`/`showOnboarding`/`dismissOnboarding`. Flow 3 nhánh chạy lại khi bump `authFlowNonce` (tạo/join/duyệt xong — không reload trang). Kênh thu hồi quyền trong tenancy = listener trên member doc: xoá doc → app tự sign-out ngay (giữ UX Phase 1); đổi role → tự re-resolve. Boot khôi phục scope từ khoá thiết bị (`oder_checklist_device_shop_v1`) nên máy quen vào thẳng đúng namespace cache thay vì dữ liệu demo.
- **Service tenancy.** `createShop`, `joinShop`, `probeAccount`, `getShop`/`listMyShops`/`getShopMember`/`listShopMembers`/`listShopRequests`, `setMemberRole`/`approveMember`/`removeMember`, `subscribeToMembership`, `updateAccountIndex`, id generator khớp rules (`shp_…`, mã mời `A–Z0–9` 8 ký tự).
- **Adoption + seed prefix chống đụng docId.** `adoptLocalDocumentsIntoShop` — migrate dữ liệu cũ theo **path từ id local** (post-P4 list không filter bị deny nên không enumerable), phân loại adopted/missing/denied; chỉ bootstrap super-admin được phép (rules), người khác bị deny và rơi sang seed. Seed khi có scope prefix mọi id `${shopId}-` kể cả reference (`items[].productId`, `recurringParentOrderId`, `stockLogs.productId`); `settings` namespace docId `${shopId}-bankConfig` + stamp `shopId`. Không scope = seed y hệt cũ (có test pin).
- **Migrate `staffRoles` → `members` (copy, không xoá).** `migrateLegacyStaffRolesToMembers` chạy sau khi chủ shop tạo shop: chuyển từng staff thành seat active + cấp index (cấp index cho uid khác cần bootstrap super-admin); không đọc được `staffRoles` thì no-op. `staffRoles` giữ đến P5 làm đường rollback.
- **Rules: super-admin provision `accounts/{uid}`.** `get`/`create`/`update` của tài khoản khác được phép cho bootstrap admin (điều kiện để migrate staff), vẫn bị `isValidAccount` + 1-shop guard ràng buộc; user thường vẫn chỉ đụng được index của chính mình. +5 assertions rules (tổng 177).
- **UI onboarding.** `OnboardingModal` mới (tab Tạo/Tham gia, deep link `?join=`, đóng được + banner nhắc lại), banner "Chưa có cửa hàng" (amber) và "Chờ duyệt" (sky) ở `App.tsx`, Header hiện tên shop + chip mã mời (bấm để copy link mời), `StaffManagementModal` đọc/duyệt/từ chối/thu hồi theo `shops/{sid}/members` khi đang ở shop active, `FirebaseSyncModal` hiện tên shop đang đồng bộ.
- **Tests.** Unit 115 → 133: probe 4 nhánh, generator khớp rules, thứ tự write của `createShop`, `joinShop` (pending/heal/từ chối invite sai), adoption phân loại, seed prefix + không scope không đổi, migration idempotent. Rules 172 → 177.
- **Multi-tenant (P2) — `shopId` trong data layer.** Cloud service có "shop scope": `setActiveShopId()` stamp `shopId` vào mọi lệnh ghi và tự thêm `where('shopId','==',…)` vào mọi subscription/kiểm tra seed; scope đang **tắt** (`null`) nên hành vi hiện tại không đổi, đến P3 chọn shop mới kích hoạt. Thêm `backfillShopId(shopId)` — công cụ backfill dữ liệu thời đơn shop chạy trên trình duyệt của chủ shop: idempotent, không bao giờ ghi đè `shopId` đã có (kể cả của shop khác), lỗi từng collection được cách ly để chạy lại được. Types dữ liệu thêm `ShopOwned { shopId?: string }`.
- **Namespace `localStorage` theo shop.** Khóa lưu cục bộ thành `<khóa>@<shopId>` — một thiết bị dùng 2 shop không còn chia/ghi đè chung cache; namespace rỗng giữ nguyên khóa cũ. Thêm `migrateLegacyStorageTo(shopId)` chuyển dữ liệu cũ sang namespace của shop (copy rồi xoá bản legacy — không nhân đôi vì quota chỉ ~5 MB, slot có dữ liệu thì bỏ qua, lỗi quota thì giữ bản cũ, idempotent). `resetToDemoData` đổi sang `removeFromStorage()` có namespace.
- `docs/MULTI-TENANT-SPEC.md` — spec multi-tenant đã chốt (data model, rules contract, rollout P1–P5); P1 rules + 95 assertions mới trong `scripts/verify-firestore-rules.mjs` (tổng 172).
- `docs/RBAC.md` — tài liệu thiết kế RBAC.
- AppContext: `assignedRole`, `hasPendingAccessRequest`, `canWriteCloudCollection`, role-aware sync/seed, tự động gửi yêu cầu khi chưa có role, realtime listener thu hồi role.
- Firestore service: API quản lý `staffRoles`/`staffRequests`, `subscribeToStaffRole`.
- UI: Banner `needs_role` + nút "Gửi lại yêu cầu", badge yêu cầu chờ duyệt ở Header, cảnh báo "role từ server" trong màn hình đổi persona.

### Fixed

- **Xuất PDF bị hỏng hoàn toàn.** Nút "Tải File PDF" luôn báo lỗi. Nguyên nhân: Tailwind CSS v4 phát bảng màu dưới dạng `oklch()` và ghi gradient kèm gợi ý nội suy `in oklab`, cả hai đều không được html2canvas 1.4.1 hiểu. Nay CSS được chuyển sang sRGB ngay lúc build. Đã xác minh: file PDF 3 trang, 243 kB, đúng cấu trúc `%PDF`.
- **Ảnh giao hàng (POD) không lưu được lên Firestore.** Ảnh được ghi ở độ phân giải gốc của camera; một khung 12 MP cho ra data URL khoảng 9 MB, vượt giới hạn cứng 1.048.576 byte/document nên Firestore từ chối. Nay ảnh được ép về tối đa 1600 px, hạ dần chất lượng JPEG, và nếu vẫn quá lớn thì thu nhỏ thêm — luôn dưới 700 kB. Áp dụng cho cả đường chụp trực tiếp lẫn đường chọn ảnh từ thư viện.
- **Bậc thang nén ảnh POD không đảm bảo kết quả dưới ngân sách.** Khi kiểm tra mã, phát hiện chuỗi nén cố định có thể dừng ở một bước chưa đủ nhỏ, và encoder vẫn trả về ảnh quá lớn thay vì từ chối. Nay encoder đi từ bước lớn → nhỏ (nhân 0.75) cho tới khi con số byte vào ngân sách, với ngưỡng dừng cạnh dài tối đa 320 px; nếu vẫn không hội tụ thì trả về rỗng (từ chối ghi) thay vì ghi dữ liệu không thể lưu được. Đo bằng byte đã giải mã (`dataUrlByteSize`), không phải độ dài chuỗi.
- **`localStorage` đầy thì mất dữ liệu trong im lặng.** `saveToStorage` chỉ ghi log rồi thôi: giao diện vẫn hiển thị thay đổi, nhưng thực tế chưa lưu, và người dùng chỉ phát hiện sau khi tải lại trang. Nay nó ném `StorageQuotaError`, và mọi thao tác lưu dữ liệu người dùng đều đi qua `persist()` để bật toast cảnh báo (chặn 30 giây một lần).
- **`ExportOrderReportModal` bỏ qua prop `title`.** Tiêu đề in/PDF luôn lấy từ `docType`, nên các call site truyền `title` (ví dụ heading tùy chỉ định cho phiếu giao hàng) bị lệch. Nay prop `title` được dùng khi có giá trị, ngược lại fallback sang heading derive từ `docType`.
- `npm install` từ một bản clone sạch trước đây thất bại vì xung đột phiên bản `esbuild`.

### Changed

- **Tách bundle**: từ một file 2.161 kB xuống entry 196 kB, phần còn lại chia theo nhóm (`react`, `firebase`, `icons`, `vendor`). 8 màn hình chuyển sang `React.lazy` + `Suspense`. `jspdf` và `html2canvas` chỉ tải khi bấm xuất PDF.
- Bật `strict`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters` và `verbatimModuleSyntax`.
- Xóa code chết: 183 import và 40 biến/hàm/tham số không dùng.
- Bỏ các dependency không dùng: `@google/genai`, `express`, `dotenv`, `motion`, `tsx`, `@types/express`, `autoprefixer`.
- Đổi tên package `react-example` → `oder-checklist`.

### Added

- **Unit test** với Vitest: 94 test trên `searchHelper`, `csvExport`, `routeOptimizer`, `vietqr`, `storage`, logic kích thước ảnh POD và kế hoạch nén.
- **Bộ kiểm thử `firestore.rules`** chạy thật với Firestore Emulator: 77 assertion (mở rộng để phủ ma trận RBAC).
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
