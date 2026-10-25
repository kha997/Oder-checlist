# RBAC ở tầng dữ liệu (Firestore)

> Trạng thái: **Phase 1 — đang triển khai**. Tài liệu này là hợp đồng thiết kế: mọi thay đổi rules hoặc app ở phần RBAC phải khớp với đây.

## 1. Vấn đề

Hai sự thật về kiến trúc hiện tại, đã xác minh bằng đọc code:

1. **Firestore là "kho sao lưu", không phải "dữ liệu dùng chung".** Mọi thao tác nghiệp vụ (`markPaid`, `markDelivered`, `markReadyForDelivery`…) chỉ cập nhật React state + `localStorage`. Dữ liệu chỉ lên Firestore khi bấm "Đồng bộ lên cloud" (`syncLocalToCloud` — ghi **toàn bộ** collection) hoặc khi seed lần đầu.
2. **"Vai trò" hiện là bộ chọn persona, không phải khái niệm xác thực.** `staffUsers` được thêm thủ công (tên/SĐT/email), nhân viên **không đăng nhập**; `activeStaff` quyết định `currentRole` → `canAccessScreen`. Firestore rules không biết vai trò là gì.

Hệ quả trực tiếp: **người đăng nhập Google bất kỳ đều đọc và ghi được toàn bộ dữ liệu** (`firestore.rules` chỉ chặn người chưa xác thực), kể cả `settings/bankConfig` (thông tin tài khoản ngân hàng) và xoá đơn hàng.

Điều này cũng có nghĩa: "RBAC phía server" **không** có thể là "shipper không được xoá đơn" theo nghĩa thao tác-từng-thao-tác, vì nhân viên không bao giờ ghi từng thao tác lên cloud. Nó là: **ai được đẩy dữ liệu nào lên cloud, và ai được đọc/ghi collection nào.**

## 2. Quyết định thiết kế

| Quyết định | Chọn | Lý do |
|---|---|---|
| Mô hình tài khoản | **Mỗi người đăng nhập Google riêng** | Chỉ mô hình này gắn được vai trò với `auth.uid`, tức là gắn được với danh tính thật. Mô hình "một tài khoản + đổi persona" không thể phân quyền ở tầng dữ liệu vì rules không thấy persona đang chọn. |
| Nơi lưu vai trò | **Document Firestore `staffRoles/{uid}`** | Không cần secret mới (không phải commit service-account JSON), admin tự gán quyền ngay trong app, đổi quyền có hiệu lực tức thì, và kiểm thử được bằng đúng bộ harness emulator hiện có. Custom claims chuẩn hơn cho hệ sinh thái Firebase khác, nhưng cần Admin SDK + refresh token — để dành Phase 2. |
| Ranh giới bảo vệ | **Theo collection** (không theo field) | App ghi theo kiểu "đồng bộ toàn bộ" (`setDoc` merge toàn bộ order). Rule giới hạn theo field sẽ phụ thuộc `diff()` của *từng* lần ghi và dễ vỡ khi app thêm field mới. Xem §7. |

## 3. Mô hình dữ liệu

### `staffRoles/{uid}` — vai trò được gán (do ADMIN quản lý)

```ts
{
  uid: string;        // == documentId == Firebase Auth uid
  email: string;
  displayName: string;
  role: 'ADMIN' | 'KITCHEN' | 'SHIPPER' | 'CASHIER';
  createdAt: string;  // ISO
}
```

> **Không có trường `active`.** Thu hồi quyền = **xoá** document `staffRoles/{uid}`. Lý do kỹ thuật: đọc một field không tồn tại bên trong rules sẽ sinh lỗi, và lỗi trong biểu thức rules nghĩa là **từ chối**. Giữ shape tối thiểu giúp rules fail-closed an toàn.

### `staffRequests/{uid}` — yêu cầu phân quyền (tự tạo, không chứa vai trò)

```ts
{
  uid: string;
  email: string;
  displayName: string;
  requestedAt: string; // ISO
}
```

> `staffRequests` **không có trường `role`**. Rules chặn mọi document có trường `role`, để người dùng không tự gán cho mình quyền bằng cách ghi thẳng vào collection này.

### Bootstrap

`khafibo@gmail.com` là **ADMIN** kể cả khi chưa có `staffRoles/{uid}`, để chủ quán không bao giờ bị khoá khỏi app. `admins/{uid}` (đã có sẵn) cũng được coi là ADMIN.

## 4. Ma trận quyền

R = có role đã gán và đang hoạt động. Mọi collection khác: **tài khoản chưa có role không được đọc/ghi gì cả**.

| Collection | Đọc | Tạo / Sửa | Xoá |
|---|---|---|---|
| `orders` | R | R | ADMIN |
| `customers` | R | ADMIN, CASHIER | ADMIN |
| `products` | R | ADMIN | ADMIN |
| `condos` | R | ADMIN | ADMIN |
| `stockLogs` | R | ADMIN | ADMIN |
| `users` (hồ sơ nhân viên) | R | ADMIN | ADMIN |
| `settings/*` (bank config) | R | ADMIN | ADMIN |
| `staffRoles/{uid}` | chính mình + ADMIN | ADMIN | ADMIN |
| `staffRequests/{uid}` | chính mình + ADMIN | chính mình (tạo, không có `role`) | ADMIN |
| `admins` | R | ADMIN | ADMIN |
| `test` (health check) | R | R | ADMIN |

Ánh xạ từ `ROLE_CONFIGS` trong `src/types/index.ts`:

| Role | `canCreateOrder` | `canConfirmPayment` | `canManageProducts` | `canAdjustStock` | `canManageStaff` |
|---|---|---|---|---|---|
| ADMIN | ✔ | ✔ | ✔ | ✔ | ✔ |
| KITCHEN | ✘ | ✘ | ✘ | ✘ | ✘ |
| SHIPPER | ✘ | ✔ | ✘ | ✘ | ✘ |
| CASHIER | ✔ | ✔ | ✘ | ✘ | ✘ |

→ KITCHEN/SHIPPER ghi `orders` vì họ cần cập nhật trạng thái giao hàng và POD; nhưng họ **không** được ghi `products`/`stockLogs` (tồn kho), `customers` (danh bạ) hay `settings` (tài khoản ngân hàng).

## 5. Thay đổi phía app

1. **Đọc vai trò khi đăng nhập.** `onAuthStateChanged` đọc `staffRoles/{uid}`:
   - Có vai trò → `currentRole` lấy từ server; quyền được enforce bởi role từ server.
   - Nếu không có vai trò → tự ghi `staffRequests/{uid}`, hiện banner **"Tài khoản chưa được phân quyền"** với nút **"Gửi lại yêu cầu"**, tắt đồng bộ cloud. App vẫn dùng được cục bộ.
2. **`syncLocalToCloud` nhận biết vai trò.** Chỉ ghi những collection mà vai trò được phép ghi; collection bị bỏ qua được báo rõ thay vì làm hỏng cả lần đồng bộ.
3. **Màn hình Quản lý nhân viên** (chỉ ADMIN): hiển thị các yêu cầu phân quyền đang chờ, duyệt với vai trò chọn được, thu hồi quyền (xoá document `staffRoles/{uid}`). Header hiển thị badge số yêu cầu chờ duyệt.
4. **Thu hồi quyền realtime.** App lắng nghe `staffRoles/{uid}` theo thời gian thực; nếu role bị xoá, người dùng sẽ tự động đăng xuất và được thông báo.
5. **Rõ ràng về persona vs role.** Khi có role từ server, modal "Đổi người trực ca" hiển thị cảnh báo rằng việc đổi persona chỉ ảnh hưởng đến tên hiển thị, không mở khóa quyền.

## 6. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Chủ quán bị khoá khỏi app | Bootstrap email + `admins/{uid}` vẫn là ADMIN không cần role doc |
| Nhân viên đang dùng app mất đồng bộ cloud khi chưa được duyệt | Dữ liệu cục bộ vẫn hoạt động; hiển thị rõ lý do; duyệt là xong (không cần đăng nhập lại) |
| `syncLocalToCloud` ghi toàn bộ collection → bị rules chặn giữa chừng | Sửa thành ghi theo vai trò, bỏ qua có kiểm soát |
| Rules quá chặt làm app hỏng trong production | Bộ kiểm thử emulator phải phủ từng nhánh của ma trận §4, và phải chạy trong CI |
| Giao diện không đồng bộ giữa persona và role server | Hiển thị cảnh báo trong modal "Đổi người trực ca"; quyền luôn được xác định bởi role từ server |

## 7. Ngoài phạm vi Phase 1 (để Phase 2)

- **Giới hạn theo field** (`totalAmount`, `cost`, `paymentStatus`…): cần đổi app từ "ghi toàn bộ" sang "ghi từng thao tác", rồi mới dùng `diff().affectedKeys()` trong rules.
- **Custom claims** thay cho document `staffRoles` (cần Admin SDK; hữu ích khi muốn dùng vai trò cho push notification/Cloud Functions).
- **Chuyển Firestore thành nguồn dữ liệu dùng chung** (mọi mutation ghi ngay lên cloud, đọc từ cloud) — đây mới là bước đi xa nhất và là điều kiện tiên quyết cho RBAC thật sự ở cấp thao tác.
- **Ẩn `order.cost` (giá vốn) khỏi tài khoản không phải ADMIN**: Firestore không cho ẩn field khi đọc; phải tách cost sang collection riêng.

## 8. Tiêu chí nghiệm thu

- [ ] `npm run test:rules` chạy thật trên Firestore Emulator, **mọi assertion PASS**, và **phủ hết ma trận §4** (kể cả các nhánh bị từ chối).
- [ ] Tài khoản không có role: đọc/ghi mọi collection đều bị từ chối.
- [ ] Tài khoản có role: đọc được collection theo ma trận, ghi được đúng phần được phép, ghi phần không được phép thì bị từ chối.
- [ ] Người dùng tự tạo `staffRoles` cho mình bị từ chối; tự tạo `staffRequests` có trường `role` bị từ chối.
- [ ] `npm run verify` xanh (typecheck, unit test, build, palette).
- [ ] README + CHANGELOG cập nhật; mục "Known gaps" phản ánh đúng thực tế sau khi thay đổi.
