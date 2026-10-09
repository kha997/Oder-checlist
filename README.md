# Oder Checklist - Simple Order Management

Ứng dụng quản lý danh sách đơn hàng, đóng gói và theo dõi giao nhận (Mobile-first Order Checklist & Delivery Management) dành cho người bán hàng trực tuyến, shipper và giao hàng nội khu / chung cư.

---

## 🌟 Tính năng nổi bật

- **Quản lý danh sách đơn hàng linh hoạt:**
  - Lọc nhanh theo trạng thái: Tất cả, Chờ xử lý (Pending), Đang giao (Delivering), Đã giao (Delivered), Đã hủy (Cancelled).
  - Tìm kiếm thông minh theo mã đơn hàng, tên khách hàng, số điện thoại, địa chỉ hoặc món hàng.
  - Sắp xếp thông minh (Smart Auto-sort): ưu tiên đơn hàng khẩn cấp (`Urgent`), đơn hẹn giờ và khoảng cách gần.

- **Thao tác nhanh (Quick Actions):**
  - Thanh Speed Dial / Menu thao tác nhanh nổi trên màn hình chính: Cập nhật trạng thái tức thì chỉ với một chạm.
  - Thao tác hàng loạt (Bulk actions): Đổi trạng thái, gán người giao hàng, in ấn.

- **Xác nhận giao hàng & Chụp ảnh đối chứng (Proof of Delivery - POD):**
  - Chụp ảnh trực tiếp bằng camera thiết bị hoặc tải ảnh gói hàng đã giao.
  - Lưu trữ ảnh bằng chứng gắn liền với chi tiết đơn hàng.

- **In ấn & Xuất báo cáo đa năng:**
  - **In Bảng Kê Giao Hàng (Print Manifest):** Bảng tổng hợp các đơn hàng chờ giao với thiết kế tối ưu hóa máy in A4/Bill theo tiêu chuẩn CSS print (@media print).
  - Xuất báo cáo tài chính / đối soát và xuất file CSV / Excel.
  - Hỗ trợ lưu trữ offline với LocalStorage.

---

## 🚀 Hướng dẫn cài đặt và chạy trên máy tính

### Yêu cầu hệ thống:
- [Node.js](https://nodejs.org/) phiên bản 18+ trở lên
- Trình quản lý gói `npm` hoặc `bun` / `pnpm` / `yarn`

### Các bước khởi chạy:

1. **Clone repository về máy:**
   ```bash
   git clone <URL_CỦA_REPOSITORY>
   cd <THƯ_MỤC_DỰ_ÁN>
   ```

2. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

3. **Khởi chạy môi trường phát triển (Dev Server):**
   ```bash
   npm run dev
   ```
   Sau đó mở trình duyệt tại địa chỉ hiển thị trong terminal (mặc định: `http://localhost:3000`).

4. **Build bản phát hành (Production Build):**
   ```bash
   npm run build
   ```

---

## 🛠 Công nghệ sử dụng

- **Frontend:** React 18, TypeScript, Vite
- **UI & Styling:** Tailwind CSS, Lucide Icons, Canvas Confetti
- **Xử lý âm thanh & phản hồi:** Web Audio API & Sound Notifications
- **In ấn & Xuất file:** CSS Media Print quy chuẩn, html2canvas, jsPDF, CSV Exporter
