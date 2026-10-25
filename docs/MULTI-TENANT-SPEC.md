# SPEC — Multi-tenant self-serve (T1)

Trạng thái: **APPROVED** (2026-10-25). Triển khai theo phase P1→P5.

## 1. Overview

Chuyển app từ "1 Firebase project = 1 shop" sang multi-tenant: bất kỳ ai mở link,
đăng nhập Google, có thể **tự tạo cửa hàng riêng** hoặc **nhập mã mời vào cửa hàng
có sẵn**. Không cần admin duyệt để tạo shop, chỉ cần duyệt để vào shop.

## 2. Problem statement

Toàn bộ dữ liệu hiện nằm trong 1 bộ collection không có khái niệm shop:
`orders`, `customers`, `products`, `condos`, `stockLogs`, `users`, `settings`.
Role lưu tại `staffRoles/{uid}` là role toàn cục. Người lạ bị chặn hoàn toàn
(RBAC Phase 1) và không thể tự đăng ký.

## 3. Quyết định đã chốt (open questions → kết luận)

| # | Quyết định |
|---|---|
| 1 | **1 shop / 1 tài khoản**, enforce bằng rules (không phải client) |
| 2 | Vào shop bằng mã mời → `status: 'pending'`, **chờ shop admin duyệt** |
| 3 | Chưa có shop sau đăng nhập → hiện **Onboarding ngay**, đóng được và vẫn dùng local (giữ local-first) |
| 4 | `khafibo@gmail.com` = **super-admin mọi shop** (bootstrap) |
| 5 | Chủ shop **archive** (`status: 'archived'`), không xoá cứng — `delete /shops` = `if false` |
| 6 | Chấp nhận rủi ro quota Spark free; theo dõi quota ở phase sau, App Check phase sau |

## 4. Proposed solution & rationale

**Model: flat collection + `shopId` field** (không dùng subcollection cho dữ liệu nghiệp vụ).

| Quyết định | Lý do |
|---|---|
| Thêm `shopId` vào mọi doc, giữ nguyên path collection | Migration = thêm 1 field, chạy bằng client của owner — **không cần service account** (ràng buộc từ Phase 1). Subcollection phải copy toàn bộ dữ liệu. |
| Mọi query nghiệp vụ bắt buộc `where('shopId','==', sid)` | Rules không phải filter: query thiếu điều kiện này bị DENY → fail-closed, không thể "quên filter" mà đọc chéo shop. |
| Role theo shop tại `shops/{shopId}/members/{uid}` | Path-scoped → list member tự theo shop; 1 dependent read/request (cùng chi phí rules hiện tại). |
| Index điều hướng tại **`accounts/{uid}`** | ⚠️ **Sửa so với bản nháp**: dùng `accounts`, không phải `users` — collection `users` đã là roster nhân viên (`id/name/role`). |
| `inviteCodes/{code}` (docId = code) | Lookup theo mã mời phải map được qua path; rules chỉ `get` theo id mới chứng minh được (list theo field thì không). |
| Giữ bootstrap + `admins/{uid}` | Không bị khóa oan, giữ nguyên "không service account". |

## 5. Data model

**`shops/{shopId}`** — id `shp_` + 12 ký tự `[A-Za-z0-9_-]`
```
{ shopId, name, ownerUid, ownerEmail, inviteCode,
  status: 'active'|'archived', createdAt }
```

**`shops/{shopId}/members/{uid}`** — NỐT CỦA RBAC
```
{ uid, shopId, email, displayName,
  role: 'ADMIN'|'CASHIER'|'KITCHEN'|'SHIPPER',
  status: 'active'|'pending'|'revoked',
  inviteCode?, createdAt }
```

**`accounts/{uid}`** — index điều hướng, KHÔNG bao giờ dùng để phân quyền
```
{ uid, email, displayName, shops: string[], defaultShopId }
```
- `update` cấm thu hẹp `shops` (giữ `incoming().shops.size() >= resource.data.shops.size()`)
  → enforce "1 shop/tài khoản" kết hợp với rule tạo shop yêu cầu `shops.size() == 0`.
- **Giới hạn đã biết:** race khi 2 batch tạo shop song song cùng thấy `size==0` → có thể
  tạo 2 shop. Chấp nhận (spam phải chủ động script song song); App Check ở phase sau.

**`inviteCodes/{code}`** — `{ code, shopId, createdBy, createdAt }`, docId = code (6–32 ký tự `[A-Z0-9]`)

**7 collection nghiệp vụ** — thêm `shopId` bắt buộc (≤ 64 ký).

> ⚠️ **YÊU CẦU BẮT BUỘC (phát hiện từ P1):** collection phẳng dùng chung
> docId giữa các shop → `settings/bankConfig` (docId cố định) và dữ liệu seed
> mặc định sẽ **đụng nhau**: shop B ghi đè shop A. Test P1 đã chốt:
> `shop admin cannot adopt a legacy path (id collision) → DENIED`.
> ⇒ **P3 phải namespace docId theo shop** (`${shopId}-bankConfig`,
> prefix `${shopId}-` cho mọi id seed). Rules không enforce được điều này
> (không thấy được intent), nên review ở P3 là chỗ cuối cùng bắt lỗi.

**Bị thay thế:** `staffRoles/*`, `staffRequests/*` → branch legacy bị xoá ở P5.

## 6. Rules contract (P1)

| Match | Create | Update | Delete | List/Get |
|---|---|---|---|---|
| `shops/{shopId}` | verified + `ownerUid==auth.uid` + `ownerEmail==email` + `accounts/{uid}.shops.size()==0` | shop admin, ko đổi owner/shopId | `if false` (archive) | get: member/pending; list: `ownerUid==auth.uid` hoặc bootstrap |
| `shops/{shopId}/members/{uid}` | self-create ADMIN active khi `shop.ownerUid==auth.uid` **hoặc** self-join `pending` khi có inviteCode hợp lệ **hoặc** shop admin thêm người khác | shop admin | shop admin hoặc tự hủy pending | get: self/shop-member/pending; list: shop member |
| `accounts/{uid}` | self **hoặc bootstrap super-admin** (provision tài khoản cho staff migrate) | self (cấm thu hẹp `shops`) **hoặc bootstrap** (gắn shop cho người khác) | `if false` | get: self **hoặc bootstrap**; list: `if false` |
| `inviteCodes/{code}` | shop admin | shop admin | shop admin | get: bất kỳ verified (code là bí mật); list: `where('shopId')` hoặc bootstrap |
| 7 collection (có `shopId`) | theo ma trận hiện tại, scope bằng `canWriteX(shopId)` | như create + **cấm đổi `shopId`** | shop admin | `hasAny('shopId') && canReadShop(shopId)` |
| 7 collection (không `shopId` — legacy) | branch legacy giữ nguyên đến P5 | y hệt | y hệt | legacy `isAuthorized()` |

Ma trận write theo shop (giữ nguyên Phase 1): orders = mọi member active;
customers = ADMIN/CASHIER; products/condos/stockLogs/users/settings = ADMIN.

**Khoảng hở chuyển tiếp (đã chấp nhận, siết dần):** branch legacy chỉ cho
người còn `staffRoles` **GET theo id** doc chưa stamp `shopId` (list fail-closed
— test T1: `legacy role holder: unfiltered list / filtered list / read
shop-scoped doc → DENIED`). Sau khi adoption stamp hết doc cũ, nhánh này hết
đối tượng; **P3 migrate `staffRoles` → `members` theo kiểu COPY (không xoá)**
để còn đường rollback, xoá `staffRoles` + branch legacy ở P5.

## 7. Service layer (P1 → P3)

**Đã giao (P3, 2026-10-25) — tenancy onboarding:**

| API | Vai trò |
|---|---|
| `probeAccount(uid)` → `{mode:'legacy' \| 'tenancy', account}` | đọc `accounts/{uid}`: permission-denied = rules cũ (chưa deploy P4) → app chạy đúng Phase 1, không cần feature flag; lỗi mạng khác thì ném lỗi để app ở local |
| `createShop({ownerUid,…,name})` | thứ tự write **bắt buộc theo rules**: index `shops:[]` → `shops/{sid}` → seat self ADMIN → `inviteCodes` → **grow index CUỐI** (thất bại giữa chừng → retry tạo shop mới, không kẹt index trỏ shop hỏng); chặn shop thứ 2, tự sinh code mời trùng thì regenerate |
| `joinShop({uid,…,inviteCode})` | resolve invite → seat `pending` + `inviteCode` → index chỉ ghi `pendingShops` (duyệt xong mới được quyền); member đã `active` thì chỉ "heal" index (write seat sẽ bị rules deny cho non-admin) |
| `listMyShops` / `getShop` / `getShopMember` / `listShopMembers` / `listShopRequests` | đọc shop + roster (list members yêu cầu member active hoặc bootstrap) |
| `setMemberRole` / `approveMember` / `removeMember` | admin của shop; `removeMember` = **xoá doc** (khách nghe listener là doc biến mất → sign-out ngay, Phase 1 UX) |
| `subscribeToMembership(sid, uid, cb)` | kênh thu hồi/v đổi role trong tenancy mode (thay `subscribeToStaffRole`) |
| `adoptLocalDocumentsIntoShop(sid, ids)` | adopt **theo path từ id local** — post-P4 list không filter bị deny nên không enumerable được nữa; mỗi doc phân loại adopted/missing/denied; **chỉ bootstrap super-admin được phép** (rules) → caller khác = denied, rơi sang seed prefix |
| `migrateLegacyStaffRolesToMembers(sid)` | **copy** `staffRoles` → seat active + provision index cho từng staff (best-effort; caller không list được staffRoles = no-op; cấp index cho uid khác cần bootstrap); chạy sau `createShop` |
| `shopScopedDocId(base)` + seed prefix | settings docId = `${shopId}-bankConfig` + stamp `shopId`; seed prefix `${shopId}-` cho id và mọi reference (`items[].productId`, `recurringParentOrderId`, `stockLogs.productId`) |

**Đã giao (P2, 2026-10-25) — cơ chế:**

| API | Vai trò |
|---|---|
| `setActiveShopId(id \| null)` / `getActiveShopId()` | chọn shop cho mọi read/write cloud; `null` = hành vi đơn shop cũ y hệt |
| `shopScopedCollection(name)` | collection + `where('shopId','==',sid)` khi có scope — 6 subscription + check rỗng của seed đi qua đây |
| `withShopId()` (private) | stamp `shopId` vào mọi `upsert*`/`updateOrderFirestore` — **không** stamp `settings` (docId global đến P3) |
| `backfillShopId(shopId)` | backfill P2: idempotent, không đụng doc đã có `shopId` (kể cả shop khác), lỗi từng collection cách ly, ném lỗi khi `shopId` rỗng. **Chỉ chạy trước P4** (list không filter sẽ bị rules mới deny — có ghi chú trong code) |
| `setStorageNamespace(ns)` / `scopedStorageKey(key)` / `removeFromStorage(key)` | namespace localStorage: khóa = `<key>@<shopId>`; namespace rỗng = khóa cũ nguyên vẹn |
| `migrateLegacyStorageTo(ns)` | chuyển cache thời đơn shop sang namespace: copy → xoá legacy (không nhân đôi, quota ~5 MB), slot có dữ liệu thì bỏ qua, quota fail thì giữ legacy, idempotent |
| `type ShopOwned { shopId?: string }` | 7 interface dữ liệu extend (optional — local data chưa có shop) |

> Ghi chú hồi tố: `withShopId` không stamp `settings` — đến P3, `settings`
> được namespace theo docId (`shopScopedDocId`) và `upsertBankConfigFirestore`
> stamp riêng khi có scope (xem bảng P3 ở trên).

## 8. State & UI

```
onAuthStateChanged
  → probeAccount(uid)           # đọc accounts/{uid}
    → permission-denied (rules cũ) → nhánh Phase 1: staffRoles như cũ
    → tenancy:
      → không shop / index stale → <OnboardingModal> (Tạo shop | Mã mời ?join=)
                                 → đóng được, vẫn dùng local (banner nhắc)
      → pendingShops → trạng thái 'pending' (banner chờ duyệt, local-only)
                      → listener membership: duyệt/từ chối → authFlowNonce
      → membership active → setActiveShopId + setStorageNamespace
                          + migrateLegacyStorageTo + khoá thiết bị
                          → assignedRole = member.role
                          → listener membership = kênh thu hồi (xoá doc → sign-out)
                          → adoption (bootstrap) → seed prefix → subscribe scoped
```

`createShopAction` / `joinShopAction` chạy xong bump `authFlowNonce` → effect
chạy lại từ đầu, không cần reload trang.

**Storage namespace (đã giao P2):** khóa = `<base>@<shopId>`
(ví dụ `oder_checklist_orders_v1@shp_xxx`); namespace rỗng = khóa cũ y hện.
Cache của shop mới bắt đầu RỖNG (`loadFromStorage` không thấy khóa → fallback),
nên dữ liệu shop A không bao giờ lọt sang shop B. Cache thời đơn shop được
`migrateLegacyStorageTo` chuyển sang namespace khi shop đầu tiên được tạo.

Component: `OnboardingModal` (mới), `Header` (tên shop + mã mời),
`StaffManagementModal` (scope theo shop), `FirebaseSyncModal` (scope theo shop).

## 9. Migration risk & thứ tự triển khai

| Phase | Nội dung | Acceptance |
|---|---|---|
| **P1** | Rules multi-tenant + test matrix emulator (chưa deploy) | `npm run test:rules` xanh: 77 cũ + matrix mới |
| **P2 ✅** (2026-10-25) | `shopId` vào data model + backfill (client của bootstrap admin) + namespace local storage | **Đạt (cơ chế):** stamp + `where` (scope tắt), `backfillShopId` idempotent/tested, namespace + migrate; `npm run verify` xanh (115 unit + 172 rules). *Backfill dữ liệu thật chạy ở P3 khi owner tạo shop* (cần id shop) — vẫn trước P4 |
| **P3 ✅** (2026-10-25) | Service + AppContext + Onboarding + StaffManagement scope shop + migrate `staffRoles`→`members` | **Đạt (cơ chế):** `npm run verify` xanh (typecheck + 133 unit + 177 rules + build + palette). Rules nới `accounts/{uid}` cho super-admin provision (+5 assertions). Service: `probeAccount` (permission-denied trên `accounts/{uid}` = rules cũ → không cần feature flag), `createShop` (thứ tự write khớp rules: index `shops:[]` → shop → seat ADMIN → invite → **grow index cuối**, retry-safe), `joinShop` (seat `pending` + `inviteCode`, index chỉ ghi `pendingShops`), member APIs, `adoptLocalDocumentsIntoShop` (adopt theo **path** vì post-P4 list bị deny), `migrateLegacyStaffRolesToMembers` (copy không xoá), seed prefix `${shopId}-` cho id + mọi reference (`items[].productId`, `recurringParentOrderId`, `stockLogs.productId`), settings docId `${shopId}-bankConfig` + stamp. AppContext: boot restore scope từ khoá thiết bị, flow 3 nhánh (none/pending/active), `authFlowNonce`, membership listener = kênh thu hồi. UI: `OnboardingModal` (+`?join=` deep link), banner none/pending, Header tên shop + chip mã mời (copy link), StaffManagement scope theo members. **Acceptance 2 tài khoản (A tạo, B join, A duyệt) là manual — cần rules deploy (P4) mới chạy được trên production** |
| **P4** | **Deploy rules → deploy surge → bật onboarding** (cùng giờ, giờ thấp điểm) | 2 shop độc lập, không thấy dữ liệu nhau |
| **P5** | Xoá branch legacy + `staffRoles`/`staffRequests`, cập nhật `docs/RBAC.md`/README/CHANGELOG | test còn xanh, doc khớp code |

Không có feature flag cho rules (rules là global) → điều khiển bằng **thứ tự deploy**.
Rollback = redeploy rules từ git tag trước P4.

Rủi ro còn lại: quota Spark free (mọi shop chung quota, spam = DDoS nhẹ),
App Check chưa có, quota monitoring chưa có → phase sau.

## 10. Verification (P1)

`scripts/verify-firestore-rules.mjs` mở rộng với matrix: tạo shop + guard 1 shop,
self-join bằng invite, cấm tự phong ADMIN, list lọc theo `shopId` OK / không lọc DENY,
đọc chéo shop DENY, duyệt/thu hồi member, invite code lifecycle, bootstrap cross-shop,
archive, legacy coexistence.
