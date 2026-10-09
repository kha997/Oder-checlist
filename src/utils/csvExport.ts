import { Order, Product } from '../types';

/**
 * Escapes a cell according to RFC 4180
 */
export function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts a 2D array of rows into a CSV string
 */
export function buildCsvString(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

/**
 * Downloads a CSV string with UTF-8 BOM so Excel & Sheets open Vietnamese characters flawlessly
 */
export function downloadCsv(filename: string, csvContent: string): void {
  // \uFEFF is the UTF-8 Byte Order Mark
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDate(isoStr?: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return isoStr;
  }
}

function getTimestampSlug(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}`;
}

/**
 * Export Current Order List to CSV for easy data management
 */
export function exportCurrentOrderListCsv(
  orders: Order[],
  filterLabel: string = 'Hôm nay',
  customFilenamePrefix: string = 'DanhSach_DonHang'
): void {
  const rows: (string | number)[][] = [];

  // Header info
  rows.push(['DANH SÁCH ĐƠN HÀNG - ODER CHECKLIST']);
  rows.push(['Kỳ lọc / Danh mục:', filterLabel]);
  rows.push(['Thời gian xuất:', formatDate(new Date().toISOString())]);
  rows.push(['Tổng số đơn hàng xuất:', orders.length]);
  rows.push([]);

  // Table header
  rows.push([
    'STT',
    'Mã đơn hàng',
    'Mức ưu tiên',
    'Thời gian tạo',
    'Tên khách hàng',
    'Số điện thoại',
    'Địa chỉ / Căn hộ',
    'Loại địa chỉ',
    'Chi tiết sản phẩm',
    'Tổng số lượng món',
    'Tổng giá bán (VND)',
    'Giá vốn (VND)',
    'Lợi nhuận gộp (VND)',
    'Trạng thái giao hàng',
    'Người giao hàng',
    'Thời gian giao hàng',
    'Trạng thái thanh toán',
    'Phương thức thanh toán',
    'Số tiền đã thu (VND)',
    'Người xác nhận thu',
    'Thời gian thu tiền',
    'Nhãn phân loại (Tags)',
    'Ghi chú giao hàng',
    'Ghi chú nội bộ',
    'Ảnh biên nhận đính kèm',
  ]);

  let totalSales = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalCash = 0;
  let totalBank = 0;
  let totalUnpaid = 0;
  let totalItems = 0;

  orders.forEach((o, idx) => {
    const orderPrice = o.price !== undefined ? o.price : o.totalAmount;
    const orderCost = o.cost !== undefined ? o.cost : Math.round(orderPrice * 0.45);
    const orderProfit = orderPrice - orderCost;
    totalSales += orderPrice;
    totalCost += orderCost;
    totalProfit += orderProfit;

    const itemsDesc = o.items
      .map((it) => `${it.productName} (x${it.quantity} ${it.unit || 'phần'}) - ${it.lineTotal.toLocaleString('vi-VN')} đ`)
      .join('; ');
    const itemCount = o.items.reduce((s, it) => s + it.quantity, 0);
    totalItems += itemCount;

    const isPaid = o.paymentStatus === 'PAID';
    const paidAmt = isPaid ? (o.paidAmount ?? orderPrice) : 0;
    if (isPaid) {
      if (o.paymentMethod === 'CASH') totalCash += paidAmt;
      else if (o.paymentMethod === 'BANK_TRANSFER') totalBank += paidAmt;
    } else {
      totalUnpaid += orderPrice;
    }

    const payMethodText = !isPaid
      ? 'Chưa thanh toán'
      : o.paymentMethod === 'CASH'
      ? 'Tiền mặt'
      : o.paymentMethod === 'BANK_TRANSFER'
      ? 'Chuyển khoản'
      : 'Khác';

    const locationTypeText = o.location.type === 'condo' ? 'Chung cư' : 'Khách ngoài';
    const deliveryStatusText =
      o.deliveryStatus === 'DELIVERED'
        ? 'Đã giao'
        : o.deliveryStatus === 'READY_FOR_DELIVERY'
        ? 'Sẵn sàng giao'
        : 'Chờ giao';

    const priorityText =
      o.priority === 'HIGH'
        ? 'Cao'
        : o.priority === 'LOW'
        ? 'Thấp'
        : 'Trung bình';

    rows.push([
      idx + 1,
      o.id,
      priorityText,
      formatDate(o.createdAt),
      o.customerName,
      o.customerPhone || '',
      o.location.formattedAddress,
      locationTypeText,
      itemsDesc,
      itemCount,
      orderPrice,
      orderCost,
      orderProfit,
      deliveryStatusText,
      o.deliveredBy || '',
      formatDate(o.deliveryTime),
      isPaid ? 'ĐÃ THU' : 'CHƯA THU',
      payMethodText,
      paidAmt,
      o.paidConfirmedBy || '',
      formatDate(o.paymentTime),
      (o.tags || []).join(', '),
      o.location.deliveryNote || o.deliveryNote || '',
      o.internalNote || '',
      o.receiptImageUrl ? 'Đã có ảnh' : 'Chưa có',
    ]);
  });

  // Financial summary footer
  rows.push([]);
  rows.push(['TỔNG KẾT DANH SÁCH ĐƠN', '', '', '', '', '', '', '', '', '']);
  rows.push(['Tổng số đơn hàng', orders.length]);
  rows.push(['Tổng số lượng món', totalItems]);
  rows.push(['TỔNG DOANH SỐ (GIÁ BÁN VND)', totalSales]);
  rows.push(['TỔNG GIÁ VỐN (VND)', totalCost]);
  rows.push(['TỔNG LỢI NHUẬN GỘP (VND)', totalProfit]);
  rows.push(['TỶ SUẤT LỢI NHUẬN', totalSales > 0 ? `${((totalProfit / totalSales) * 100).toFixed(1)}%` : '0%']);
  rows.push(['- Tiền mặt đã thu', totalCash]);
  rows.push(['- Chuyển khoản đã thu', totalBank]);
  rows.push(['= Tổng tiền đã thu', totalCash + totalBank]);
  rows.push(['- Tiền chưa thu (Nợ)', totalUnpaid]);
  rows.push(['Tỷ lệ thu tiền', totalSales > 0 ? `${Math.round(((totalCash + totalBank) / totalSales) * 100)}%` : '100%']);

  const csv = buildCsvString(rows);
  const slug = getTimestampSlug();
  const filename = `${customFilenamePrefix}_${slug}.csv`;
  downloadCsv(filename, csv);
}

/**
 * Export Sales & Orders to CSV
 */
export function exportSalesOrdersCsv(orders: Order[], periodLabel: string): void {
  const rows: (string | number)[][] = [];

  // Header info
  rows.push(['BÁO CÁO DOANH THU & CHI TIẾT ĐƠN HÀNG']);
  rows.push(['Kỳ báo cáo:', periodLabel]);
  rows.push(['Thời gian xuất:', formatDate(new Date().toISOString())]);
  rows.push(['Tổng số đơn hàng:', orders.length]);
  rows.push([]);

  // Table header
  rows.push([
    'STT',
    'Mã đơn hàng',
    'Thời gian tạo',
    'Tên khách hàng',
    'Số điện thoại',
    'Địa chỉ / Vị trí',
    'Loại địa chỉ',
    'Chi tiết sản phẩm',
    'Tổng số lượng món',
    'Tổng giá bán (VND)',
    'Giá vốn (VND)',
    'Lợi nhuận gộp (VND)',
    'Trạng thái giao hàng',
    'Người giao hàng',
    'Thời gian giao',
    'Trạng thái thanh toán',
    'Phương thức thanh toán',
    'Số tiền đã thu (VND)',
    'Người xác nhận thu',
    'Thời gian thanh toán',
    'Ghi chú giao hàng',
    'Ghi chú nội bộ (Chỉ người bán)',
    'Ghi chú khác',
  ]);

  let totalSales = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalCash = 0;
  let totalBank = 0;
  let totalUnpaid = 0;
  let totalItemCount = 0;

  orders.forEach((o, idx) => {
    const orderPrice = o.price !== undefined ? o.price : o.totalAmount;
    const orderCost = o.cost !== undefined ? o.cost : Math.round(orderPrice * 0.45);
    const orderProfit = orderPrice - orderCost;
    totalSales += orderPrice;
    totalCost += orderCost;
    totalProfit += orderProfit;

    const itemsDesc = o.items
      .map((it) => `${it.productName} (${it.quantity} ${it.unit}) x ${it.unitPrice.toLocaleString('vi-VN')} đ`)
      .join('; ');
    const itemCount = o.items.reduce((s, it) => s + it.quantity, 0);
    totalItemCount += itemCount;

    const isPaid = o.paymentStatus === 'PAID';
    const paidAmt = isPaid ? (o.paidAmount ?? orderPrice) : 0;
    if (isPaid) {
      if (o.paymentMethod === 'CASH') totalCash += paidAmt;
      else if (o.paymentMethod === 'BANK_TRANSFER') totalBank += paidAmt;
    } else {
      totalUnpaid += orderPrice;
    }

    const payMethodText = !isPaid
      ? 'Chưa thanh toán'
      : o.paymentMethod === 'CASH'
      ? 'Tiền mặt'
      : o.paymentMethod === 'BANK_TRANSFER'
      ? 'Chuyển khoản'
      : 'Khác';

    const locationTypeText = o.location.type === 'condo' ? 'Chung cư' : 'Địa chỉ ngoài';
    const deliveryStatusText =
      o.deliveryStatus === 'DELIVERED'
        ? 'Đã giao'
        : o.deliveryStatus === 'READY_FOR_DELIVERY'
        ? 'Sẵn sàng giao'
        : 'Đang chờ giao';

    rows.push([
      idx + 1,
      o.id,
      formatDate(o.createdAt),
      o.customerName,
      o.customerPhone || '',
      o.location.formattedAddress,
      locationTypeText,
      itemsDesc,
      itemCount,
      orderPrice,
      orderCost,
      orderProfit,
      deliveryStatusText,
      o.deliveredBy || '',
      formatDate(o.deliveryTime),
      isPaid ? 'ĐÃ THU' : 'CHƯA THU (NỢ)',
      payMethodText,
      paidAmt,
      o.paidConfirmedBy || '',
      formatDate(o.paymentTime),
      o.location.deliveryNote || o.deliveryNote || '',
      o.internalNote || '',
      o.note || '',
    ]);
  });

  // Financial summary footer
  rows.push([]);
  rows.push(['TỔNG KẾT TÀI CHÍNH', '', '', '', '', '', '', '', '', '']);
  rows.push(['Tổng số đơn hàng', orders.length]);
  rows.push(['Tổng số lượng món bán', totalItemCount]);
  rows.push(['TỔNG DOANH SỐ (GIÁ BÁN VND)', totalSales]);
  rows.push(['TỔNG GIÁ VỐN (VND)', totalCost]);
  rows.push(['TỔNG LỢI NHUẬN GỘP (VND)', totalProfit]);
  rows.push(['TỶ SUẤT LỢI NHUẬN', totalSales > 0 ? `${((totalProfit / totalSales) * 100).toFixed(1)}%` : '0%']);
  rows.push(['- Tiền mặt đã thu', totalCash]);
  rows.push(['- Chuyển khoản đã thu', totalBank]);
  rows.push(['= TỔNG TIỀN ĐÃ THU', totalCash + totalBank]);
  rows.push(['- TIỀN CHƯA THU (NỢ)', totalUnpaid]);
  rows.push(['ĐỐI SOÁT TÀI CHÍNH:', `${totalSales} = ${totalCash} + ${totalBank} + ${totalUnpaid}`]);
  rows.push(['KẾT QUẢ ĐỐI SOÁT:', totalSales === totalCash + totalBank + totalUnpaid ? 'KHỚP 100%' : 'CẦN KIỂM TRA LỆCH SỐ']);

  const csv = buildCsvString(rows);
  const filename = `BaoCao_DonHang_${getTimestampSlug()}.csv`;
  downloadCsv(filename, csv);
}

/**
 * Export Inventory & Products to CSV
 */
export function exportInventoryCsv(
  products: Product[],
  productSalesMap: Record<string, { quantity: number; revenue: number }>,
  periodLabel: string
): void {
  const rows: (string | number)[][] = [];

  rows.push(['BÁO CÁO TỒN KHO & SẢN LƯỢNG BÁN']);
  rows.push(['Kỳ báo cáo:', periodLabel]);
  rows.push(['Thời gian xuất:', formatDate(new Date().toISOString())]);
  rows.push(['Tổng số danh mục sản phẩm:', products.length]);
  rows.push([]);

  // Table header
  rows.push([
    'STT',
    'Mã sản phẩm',
    'Tên sản phẩm',
    'Đơn vị tính',
    'Đơn giá bán (VND)',
    'Tồn kho đầu ngày',
    'Nhập thêm trong ngày',
    'Đã bán (kỳ báo cáo)',
    'Tồn kho hiện tại',
    'Doanh thu từ món (VND)',
    'Tình trạng tồn kho',
  ]);

  let totalInitial = 0;
  let totalReceived = 0;
  let totalSold = 0;
  let totalCurrentStock = 0;
  let totalProductRevenue = 0;

  products.forEach((prod, idx) => {
    const sales = productSalesMap[prod.id] || { quantity: 0, revenue: 0 };
    totalInitial += prod.initialStock;
    totalReceived += prod.stockReceived;
    totalSold += sales.quantity;
    totalCurrentStock += prod.currentStock;
    totalProductRevenue += sales.revenue;

    let stockStatus = 'Đủ hàng';
    if (prod.currentStock <= 0) {
      stockStatus = 'HẾT HÀNG';
    } else if (prod.currentStock <= 10) {
      stockStatus = 'SẮP HẾT';
    }

    rows.push([
      idx + 1,
      prod.id,
      prod.name,
      prod.unit,
      prod.price,
      prod.initialStock,
      prod.stockReceived,
      sales.quantity,
      prod.currentStock,
      sales.revenue,
      stockStatus,
    ]);
  });

  // Footer summary
  rows.push([]);
  rows.push(['TỔNG KẾT TỒN KHO', '', '', '', '', '', '', '', '', '']);
  rows.push(['Tổng lượng tồn kho đầu ngày', totalInitial]);
  rows.push(['Tổng lượng đã nhập thêm', totalReceived]);
  rows.push(['Tổng số lượng đã bán (trong kỳ)', totalSold]);
  rows.push(['Tổng lượng tồn kho hiện tại', totalCurrentStock]);
  rows.push(['TỔNG DOANH THU CÁC MÓN', totalProductRevenue]);

  const csv = buildCsvString(rows);
  const filename = `BaoCao_TonKho_${getTimestampSlug()}.csv`;
  downloadCsv(filename, csv);
}

/**
 * Export Comprehensive Consolidated Accounting & Backup CSV
 */
export function exportConsolidatedReportCsv(
  orders: Order[],
  products: Product[],
  productSalesMap: Record<string, { quantity: number; revenue: number }>,
  periodLabel: string
): void {
  const rows: (string | number)[][] = [];

  // Section 1: Header
  rows.push(['=============================================================']);
  rows.push(['BÁO CÁO TỔNG HỢP DOANH SỐ, TÀI CHÍNH & TỒN KHO (ACCOUNTING BACKUP)']);
  rows.push(['=============================================================']);
  rows.push(['Kỳ báo cáo:', periodLabel]);
  rows.push(['Thời gian xuất file:', formatDate(new Date().toISOString())]);
  rows.push(['Người tạo:', 'Hệ thống Quản lý Bán hàng & Giao hàng']);
  rows.push([]);

  // Section 2: Financial reconciliation
  const numberOfOrders = orders.length;
  const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const cashReceived = orders
    .filter((o) => o.paymentStatus === 'PAID' && o.paymentMethod === 'CASH')
    .reduce((sum, o) => sum + (o.paidAmount ?? o.totalAmount), 0);
  const bankReceived = orders
    .filter((o) => o.paymentStatus === 'PAID' && o.paymentMethod === 'BANK_TRANSFER')
    .reduce((sum, o) => sum + (o.paidAmount ?? o.totalAmount), 0);
  const amountCollected = cashReceived + bankReceived;
  const unpaidAmount = orders
    .filter((o) => o.paymentStatus === 'UNPAID')
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const sumFormula = cashReceived + bankReceived + unpaidAmount;
  const isReconciled = sumFormula === totalSales;

  rows.push(['--- PHẦN 1: BÁO CÁO TỔNG QUAN TÀI CHÍNH & ĐỐI SOÁT ---']);
  rows.push(['Chỉ số tài chính', 'Giá trị (VND)', 'Ghi chú đối soát']);
  rows.push(['Tổng số đơn hàng', numberOfOrders, `${numberOfOrders} đơn trong kỳ`]);
  rows.push(['TỔNG DOANH SỐ BÁN HÀNG', totalSales, 'Doanh số phát sinh từ tất cả đơn hàng']);
  rows.push(['- Tiền mặt đã thu (Cash)', cashReceived, 'Tiền mặt đã nhận đủ']);
  rows.push(['- Chuyển khoản đã thu (Bank Transfer)', bankReceived, 'Tài khoản ngân hàng đã nhận']);
  rows.push(['= TỔNG TIỀN ĐÃ THU', amountCollected, 'Tiền mặt + Chuyển khoản']);
  rows.push(['- CHƯA THU TIỀN (NỢ CẦN THU)', unpaidAmount, 'Khách chưa thanh toán']);
  rows.push(['Công thức đối soát:', `${totalSales} = ${cashReceived} (TM) + ${bankReceived} (CK) + ${unpaidAmount} (Nợ)`]);
  rows.push(['Trạng thái đối soát:', isReconciled ? 'CHÍNH XÁC 100% (ĐÃ KHỚP TOÁN)' : 'LỆCH SỐ - CẦN KIỂM TRA']);
  rows.push([]);

  // Section 3: Inventory & Products sold
  rows.push(['--- PHẦN 2: BÁO CÁO TỒN KHO & SẢN PHẨM BÁN RA ---']);
  rows.push([
    'STT',
    'Mã món',
    'Tên món',
    'Đơn vị',
    'Đơn giá (VND)',
    'Tồn đầu ngày',
    'Nhập trong ngày',
    'Đã bán',
    'Tồn kho hiện tại',
    'Doanh thu món (VND)',
    'Tình trạng tồn',
  ]);

  products.forEach((p, idx) => {
    const s = productSalesMap[p.id] || { quantity: 0, revenue: 0 };
    let st = 'Đủ hàng';
    if (p.currentStock <= 0) st = 'Hết hàng';
    else if (p.currentStock <= 10) st = 'Sắp hết';

    rows.push([
      idx + 1,
      p.id,
      p.name,
      p.unit,
      p.price,
      p.initialStock,
      p.stockReceived,
      s.quantity,
      p.currentStock,
      s.revenue,
      st,
    ]);
  });
  rows.push([]);

  // Section 4: Detailed Order list
  rows.push(['--- PHẦN 3: BẢNG KÊ CHI TIẾT TỪNG ĐƠN HÀNG ---']);
  rows.push([
    'STT',
    'Mã đơn',
    'Thời gian tạo',
    'Khách hàng',
    'Điện thoại',
    'Địa chỉ giao',
    'Loại vị trí',
    'Chi tiết món',
    'Tổng tiền (VND)',
    'Trạng thái giao',
    'Shipper',
    'Giờ giao',
    'Trạng thái TT',
    'Hình thức TT',
    'Đã thu (VND)',
    'Người xác nhận TT',
    'Ghi chú giao hàng',
    'Ghi chú nội bộ',
  ]);

  orders.forEach((o, idx) => {
    const isPaid = o.paymentStatus === 'PAID';
    const itemsDesc = o.items
      .map((it) => `${it.productName} (${it.quantity} ${it.unit})`)
      .join(', ');
    const payMethodText = !isPaid
      ? 'Chưa thu'
      : o.paymentMethod === 'CASH'
      ? 'Tiền mặt'
      : o.paymentMethod === 'BANK_TRANSFER'
      ? 'Chuyển khoản'
      : 'Khác';

    rows.push([
      idx + 1,
      o.id,
      formatDate(o.createdAt),
      o.customerName,
      o.customerPhone || '',
      o.location.formattedAddress,
      o.location.type === 'condo' ? 'Chung cư' : 'Ngoài',
      itemsDesc,
      o.totalAmount,
      o.deliveryStatus === 'DELIVERED' ? 'Đã giao' : 'Chờ giao',
      o.deliveredBy || '',
      formatDate(o.deliveryTime),
      isPaid ? 'Đã thanh toán' : 'Chưa thanh toán',
      payMethodText,
      isPaid ? (o.paidAmount ?? o.totalAmount) : 0,
      o.paidConfirmedBy || '',
      o.location.deliveryNote || o.deliveryNote || '',
      o.internalNote || '',
    ]);
  });

  const csv = buildCsvString(rows);
  const filename = `BaoCao_TongHop_KeToan_${getTimestampSlug()}.csv`;
  downloadCsv(filename, csv);
}
