# Oder Checklist — Simple Order Management

Ứng dụng quản lý đơn hàng và giao nhận, thiết kế cho điện thoại (mobile-first PWA) dành cho người bán hàng online, shipper và giao hàng nội khu / chung cư.

Chạy hoàn toàn trên trình duyệt: dữ liệu lưu trong `localStorage`, có thể đăng nhập Google để đồng bộ lên Firestore. Cài được lên màn hình chính và dùng offline như một app.

---

## 🌟 Tính năng

### 8 màn hình làm việc

| Màn hình | Việc chính |
| --- | --- |
| **Trang chủ** (`HOME`) | Tổng quan trong ngày: doanh số, số đơn, đơn gấp, đơn hẹn giờ |
| **Tạo đơn** (`CREATE_ORDER`) | Tạo đơn nhanh, có nhập bằng giọng nói (voice-to-text) |
| **Giao hàng** (`DELIVERY`) | Chế độ shipper: sắp xếp lộ trình, gọi khách, chụp ảnh giao hàng (POD), thu COD |
| **Chưa thu** (`UNPAID`) | Các đơn còn nợ tiền, gồm cả đơn đã giao và chưa giao |
| **Kho hàng** (`INVENTORY`) | Tồn kho = tồn đầu + nhập thêm − đã bán |
| **Lịch sử** (`ORDER_HISTORY`) | Tra cứu toàn bộ đơn theo ngày đặt, trạng thái, khách |
| **Báo cáo** (`REPORT`) | Đối soát tài chính, doanh thu, lợi nhuận |
| **Sổ công nợ** (`CUSTOMERS`) | Danh bạ khách hàng kèm tổng nợ từng người |

Cùng với đó:

- **Tìm kiếm không dấu** — gõ `nguyen` ra `Nguyễn`, tìm theo mã đơn, tên khách, SĐT, địa chỉ hoặc tên món. Mã đơn được ưu tiên khớp trước.
- **Sắp xếp lộ trình** — gom nhóm theo chung cư / tòa / tầng, đẩy tầng cao lên trước để shipper đi một vòng từ trên xuống, phạt việc quay lui.
- **VietQR** — sinh mã QR chuyển khoản kèm số tiền và nội dung, cùng deep link mở app ngân hàng.
- **In Bảng Kê Giao Hàng** — bảng tổng hợp cho shipper, tối ưu cho A4 và máy in bill qua `@media print`; kèm nút in trực tiếp và nút tải file PDF.
- **Xuất CSV / Excel** — đúng chuẩn RFC 4180 (quote dấu phẩy, xuống dòng CRLF) để Excel mở không lỗi.
- **Thông báo hẹn giờ** — nhắc trước 30 phút cho các đơn có giờ hẹn giao.
- **Âm thanh phản hồi** — Web Audio API, có công tắc bật/tắt.
- **Phân quyền theo vai trò** — Admin / Bếp / Shipper / Thu ngân, mỗi vai trò có màn hình và quyền thao tác riêng.
- **Nhiều cửa hàng (self-serve)** — ai mở link cũng đăng nhập Google và **tạo được cửa hàng riêng** của mình, hoặc nhập mã mời (deep link `?join=CODE`) để tham gia cửa hàng khác — hàng chờ duy nhất cần phê duyệt là *yêu cầu tham gia*. Dữ liệu các cửa hàng cách ly ở server qua Firestore rules (`shopId` trên từng document); chủ shop chia sẻ mã mời ngay trên Header. Trạng thái chưa có cửa hàng / đang chờ duyệt đều dùng được bình thường ở chế độ lưu cục bộ. Chi tiết: `docs/MULTI-TENANT-SPEC.md`.

---

## 🚀 Cài đặt và chạy

### Yêu cầu

- **Node.js >= 22.12.0** (bắt buộc — xem `engines` trong `package.json`)
- npm (đi kèm Node)
- Không cần biến môi trường nào

### Chạy

```bash
git clone https://github.com/kha997/Oder-checlist.git
cd Oder-checlist
npm install
npm run dev
```

Mở `http://localhost:3000`.

### Build bản phát hành

```bash
npm run build     # tsc --noEmit + vite build
npm run preview   # chạy thử bản đã build
```

---

## 🧪 Kiểm thử

```bash
npm run verify      # chạy toàn bộ cổng kiểm tra bên dưới, theo thứ tự
```

| Lệnh | Nội dung |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` với `strict` + `noUnusedLocals` / `noUnusedParameters` |
| `npm test` | 94 unit test trên logic thuần (tìm kiếm, CSV, lộ trình, VietQR, lưu trữ, kích thước ảnh POD) |
| `npm run test:rules` | 23 assertion trên `firestore.rules`, chạy thật với Firestore Emulator |
| `npm run test:palette` | Kiểm tra CSS đã build không còn `oklch()` / `in oklab` và đối chiếu bảng màu với Tailwind |
| `npm run build` | Build production, cảnh báo nếu chunk vượt 700 kB |

`npm run test:rules` cần **Java 21+** (cho Firestore Emulator) và mạng ở lần chạy đầu — `npx` sẽ tải `firebase-tools` và file JAR của emulator. Không cần `firebase-tools` cài sẵn trong máy.

CI trên GitHub Actions chạy đúng cổng này ở hai job: `verify` và `security-rules`.

---

## 🛠 Công nghệ

| Lớp | Dùng gì |
| --- | --- |
| Ngôn ngữ | **TypeScript 7** (`tsgo`), `strict`, `verbatimModuleSyntax` |
| UI | **React 19** (kèm `React.lazy` + `Suspense` để tách màn hình) |
| Build | **Vite 8** trên nền **Rolldown** |
| CSS | **Tailwind CSS v4** |
| Icon | **lucide-react** |
| Backend | **Firebase 13** — Firestore + Google Auth |
| PWA | **vite-plugin-pwa** (Workbox, `autoUpdate`) |
| In / xuất file | CSS Media Print, **html2canvas**, **jsPDF**, CSV tự viết |
| Test | **Vitest 5** + script kiểm thử Firestore Rules tự viết |

### Vài điểm kỹ thuật đáng lưu ý

- **Không phụ thuộc `firebase-tools` trong `package.json`** — script gọi `npx --yes firebase-tools` để bộ kiểm thử rules không kéo thêm hàng trăm package vào dây chuyền build.
- **Bộ kiểm thử Firestore Rules tự viết, không dùng `@firebase/rules-unit-testing`** — thư viện đó yêu cầu `firebase ^12` trong khi dự án dùng 13. Thay vào đó script tự ký JWT unsigned gọi thẳng REST API của emulator.
- **Không dùng ESLint** — `typescript-eslint@8` yêu cầu `typescript <6.1.0`, dự án đang ở TypeScript 7. Xem phần "Known gaps".

---

## 📁 Cấu trúc thư mục

```
src/
  components/     34 component, gồm 8 màn hình chính
  context/        AppContext — toàn bộ state, phân quyền, đồng bộ Firestore
  firebase/       Khởi tạo Firebase, tầng truy cập Firestore
  hooks/          Custom hook
  types/          Kiểu dữ liệu + ROLE_CONFIGS
  utils/          Logic thuần: searchHelper, csvExport, routeOptimizer, vietqr,
                  pdfExport, storage, notificationScheduler
    __tests__/    Unit test
scripts/          verify-firestore-rules.mjs, oklch-to-srgb.mjs, verify-oklch-palette.mjs
```

---

## ⚠️ Known gaps

Danh sách này là những hạn chế **đã xác nhận bằng kiểm chứng**, không phải phỏng đoán. Đừng bỏ qua mục này nếu bạn định dùng app cho dữ liệu thật.

### Bảo mật

- **Phân quyền đã được thực thi ở tầng dữ liệu.** Vai trò được phân giải từ `staffRoles/{uid}` và `firestore.rules` chặn tài khoản chưa được cấp quyền khỏi mọi collection. Bootstrap email `khafibo@gmail.com` và collection `admins/{uid}` vẫn được giữ như fallback. Mỗi người đăng nhập Google riêng, admin duyệt yêu cầu trong màn hình **Quản lý nhân viên → Phân quyền truy cập**.
- **Tài khoản chưa được phân quyền bị chặn hoàn toàn.** Khi đăng nhập mà chưa có role, app tự gửi yêu cầu vào `staffRequests/{uid}` và chỉ hoạt động ở chế độ local (không sync cloud). Thu hồi quyền = xoá `staffRoles/{uid}`.

### Toàn vẹn dữ liệu

- **Ảnh POD chỉ còn một bản sao trong `localStorage`.** Ảnh đã được ép về tối đa 1600 px và dưới 700 kB, nhưng nhiều đơn kèm ảnh vẫn có thể làm đầy `localStorage` (~5 MB trên Safari di động). Khi đó app báo toast "Bộ nhớ trình duyệt đã đầy" thay vì im lặng — nhưng chưa có nút xoá ảnh cũ hàng loạt.

### Dây chuyền code

- **Chưa có ESLint.** Bị chặn bởi xung đột phiên bản TypeScript ở trên.
- **`firebase-applet-config.json` được commit kèm `projectId`, `apiKey`, `oAuthClientId`.** Với Firebase, những giá trị này được thiết kế để công khai — bảo mật phải đến từ `firestore.rules` và Authorized Domains. Nhưng nếu bạn tự triển khai, hãy đổi sang project của mình và giới hạn Authorized Domains.
- **Phân quyền collection-level (chưa giới hạn field).** Rules chặn theo collection, nhưng do app đồng bộ toàn bộ đơn hàng (`setDoc`), shipper/cashier/kitchen vẫn có thể ghi toàn bộ document. Xem `docs/RBAC.md §7` để biết kế hoạch chuyển sang per-action writes + field-level restrictions.

---

## 🛡 Độ bền dữ liệu

Hai chỗ dưới đây trước kia thất bại trong im lặng. Nay chúng báo lỗi rõ ràng:

- **`localStorage` đầy.** `saveToStorage` ném `StorageQuotaError` thay vì chỉ ghi log. Mọi thao tác lưu dữ liệu người dùng đi qua một hàm `persist()` trong `AppContext` để bật toast **"Bộ nhớ trình duyệt đã đầy"** kèm hướng dẫn xử lý (toast được chặn 30 giây một lần để không dội màn hình). Các thiết lập UI không quan trọng vẫn dùng đường lưu im lặng.
- **Ảnh giao hàng (POD).** Ảnh được ép về cạnh dài tối đa **1600 px** rồi nén JPEG, hạ dần chất lượng (0.85 → 0.55) và nếu vẫn quá lớn thì thu nhỏ thêm (nhân 0.75), cho tới khi dưới **700 kB** — an toàn dưới giới hạn cứng 1.048.576 byte/document của Firestore. Trước đây ảnh lưu ở độ phân giải gốc: một khung 12 MP (3024×4032) cho ra data URL **~9 MB** và Firestore từ chối thẳng, nên ảnh coi như mất.

Số liệu trên đến từ phép đo thật trong trình duyệt, không phải ước lượng. Đã thử cả những trường hợp nén tệ nhất — nhiễu ngẫu nhiên, bàn cờ 1 px, nguồn 12 MP và 40 MP — trường hợp xấu nhất là **692 kB**, vẫn dưới ngân sách. Số đo này dùng byte đã giải mã (`dataUrlByteSize`) thay cho độ dài chuỗi UTF-16, và cạnh dài tối đa 320 px là ngưỡng dừng (floor): nếu bậc thang nén không hội tụ trước khi tới ngưỡng, encoder sẽ **từ chối** (trả về rỗng) thay vì ghi một ảnh không thể lưu được — và người dùng sẽ thấy ảnh không được chụp.

---

## 📄 Giấy phép

[MIT](LICENSE) © 2026 kha997
