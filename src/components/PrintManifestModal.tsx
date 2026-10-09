import React, { useState, useRef, useMemo } from 'react';
import { Order, OrderPriority } from '../types';
import { formatVND } from '../utils/storage';
import { exportElementToPdf } from '../utils/pdfExport';
import { downloadCsv, escapeCsvCell } from '../utils/csvExport';
import {
  Printer,
  FileDown,
  X,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  FileSpreadsheet,
  FileText,
  Sliders,
  Filter,
  Check,
  ChevronDown,
} from 'lucide-react';

export type ManifestScope = 'ALL_PENDING' | 'STRICT_PENDING' | 'OUT_FOR_DELIVERY';
export type ManifestSortBy = 'LOCATION' | 'PRIORITY_TIME' | 'ORDER_ID';

interface PrintManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  currentUser?: string;
  defaultScope?: ManifestScope;
}

export const PrintManifestModal: React.FC<PrintManifestModalProps> = ({
  isOpen,
  onClose,
  orders,
  currentUser = 'Quản lý điều phối',
  defaultScope = 'ALL_PENDING',
}) => {
  const [scope, setScope] = useState<ManifestScope>(defaultScope);
  const [sortBy, setSortBy] = useState<ManifestSortBy>('LOCATION');
  const [showItemDetails, setShowItemDetails] = useState<boolean>(true);
  const [showDeliveryNotes, setShowDeliveryNotes] = useState<boolean>(true);
  const [showSignatureBlock, setShowSignatureBlock] = useState<boolean>(true);
  const [showCheckboxes, setShowCheckboxes] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportProgressText, setExportProgressText] = useState<string>('');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const printableRef = useRef<HTMLDivElement>(null);

  // Filter orders according to selected scope
  const targetOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status !== 'ACTIVE') return false;
      if (scope === 'STRICT_PENDING') {
        return o.deliveryStatus === 'PENDING';
      }
      if (scope === 'OUT_FOR_DELIVERY') {
        return o.deliveryStatus === 'OUT_FOR_DELIVERY' || o.deliveryStatus === 'READY_FOR_DELIVERY';
      }
      // ALL_PENDING (any order that is not delivered yet)
      return o.deliveryStatus !== 'DELIVERED';
    });
  }, [orders, scope]);

  // Sort orders according to chosen criteria
  const sortedOrders = useMemo(() => {
    const list = [...targetOrders];

    if (sortBy === 'LOCATION') {
      list.sort((a, b) => {
        const condoA = a.location.condoName || 'zzz';
        const condoB = b.location.condoName || 'zzz';
        if (condoA !== condoB) return condoA.localeCompare(condoB);

        const blockA = a.location.block || '';
        const blockB = b.location.block || '';
        if (blockA !== blockB) return blockA.localeCompare(blockB);

        const floorA = a.location.floor || '';
        const floorB = b.location.floor || '';
        if (floorA !== floorB) return floorA.localeCompare(floorB);

        const unitA = a.location.unit || a.location.formattedAddress;
        const unitB = b.location.unit || b.location.formattedAddress;
        return unitA.localeCompare(unitB);
      });
    } else if (sortBy === 'PRIORITY_TIME') {
      list.sort((a, b) => {
        // High priority first
        const pScoreA = a.priority === 'HIGH' ? 3 : a.priority === 'MEDIUM' ? 2 : 1;
        const pScoreB = b.priority === 'HIGH' ? 3 : b.priority === 'MEDIUM' ? 2 : 1;
        if (pScoreA !== pScoreB) return pScoreB - pScoreA;

        // Due time if available
        const timeA = a.deliveryDueAt || a.deliveryTime || a.createdAt;
        const timeB = b.deliveryDueAt || b.deliveryTime || b.createdAt;
        return timeA.localeCompare(timeB);
      });
    } else {
      // ORDER_ID / creation date
      list.sort((a, b) => a.id.localeCompare(b.id));
    }

    return list;
  }, [targetOrders, sortBy]);

  // Financial and operational calculations
  const totalOrdersCount = sortedOrders.length;
  const totalItemsCount = sortedOrders.reduce(
    (sum, o) => sum + o.items.reduce((itemSum, it) => itemSum + it.quantity, 0),
    0
  );
  const totalOrderAmount = sortedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // COD amount needed to collect (unpaid orders)
  const totalCodAmount = sortedOrders
    .filter((o) => o.paymentStatus === 'UNPAID')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // Pre-paid amount
  const totalPrepaidAmount = sortedOrders
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + (o.paidAmount || o.totalAmount), 0);

  const urgentOrdersCount = sortedOrders.filter((o) => o.priority === 'HIGH').length;

  const manifestDateFormatted = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }, []);

  const manifestTimeFormatted = useMemo(() => {
    const now = new Date();
    return now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const manifestId = useMemo(() => {
    const dateSlug = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return `MNF-${dateSlug}-${totalOrdersCount}`;
  }, [totalOrdersCount]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  // Browser direct print action
  const handlePrint = () => {
    window.print();
  };

  // Export PDF action
  const handleExportPdf = async () => {
    if (!printableRef.current) return;
    setIsExportingPdf(true);
    setExportProgressText('Đang dựng trang in...');
    try {
      await exportElementToPdf(
        printableRef.current,
        `BangKe_GiaoHang_${manifestId}.pdf`,
        (step) => setExportProgressText(step)
      );
      showToast('✓ Đã tải file PDF Bảng Kê Giao Hàng thành công!');
    } catch (err) {
      console.error(err);
      showToast('Lỗi tạo PDF. Bạn có thể nhấn nút "In Bảng Kê" để in hoặc lưu PDF trực tiếp!');
    } finally {
      setIsExportingPdf(false);
      setExportProgressText('');
    }
  };

  // Export CSV action
  const handleExportCsv = () => {
    const headers = [
      'STT',
      'Mã Đơn',
      'Độ Ưu Tiên',
      'Tên Khách Hàng',
      'Số Điện Thoại',
      'Tòa Nhà / Chung Cư',
      'Block',
      'Tầng',
      'Căn Hộ / Phòng',
      'Địa Chỉ Đầy Đủ',
      'Chi Tiết Món Hàng',
      'Tổng Số Món',
      'Tổng Tiền Đơn',
      'Tiền COD Cần Thu',
      'Trạng Thái Thanh Toán',
      'Hình Thức TT',
      'Trạng Thái Giao Hàng',
      'Ghi Chú Giao Hàng',
      'Hẹn Giờ Giao',
    ];

    const rows = sortedOrders.map((o, idx) => {
      const itemsDesc = o.items.map((it) => `${it.quantity}x ${it.productName}`).join('; ');
      const totalQty = o.items.reduce((s, it) => s + it.quantity, 0);
      const codVal = o.paymentStatus === 'UNPAID' ? o.totalAmount : 0;

      return [
        idx + 1,
        o.id,
        o.priority === 'HIGH' ? 'GẤP' : o.priority === 'LOW' ? 'THẤP' : 'TIÊU CHUẨN',
        o.customerName,
        o.customerPhone || '',
        o.location.condoName || '',
        o.location.block || '',
        o.location.floor || '',
        o.location.unit || '',
        o.location.formattedAddress || '',
        itemsDesc,
        totalQty,
        o.totalAmount,
        codVal,
        o.paymentStatus === 'PAID' ? 'ĐÃ THANH TOÁN' : 'CHƯA THU (COD)',
        o.paymentMethod === 'BANK_TRANSFER'
          ? 'Chuyển khoản'
          : o.paymentMethod === 'CASH'
          ? 'Tiền mặt'
          : '',
        o.deliveryStatus === 'OUT_FOR_DELIVERY'
          ? 'Đang giao'
          : o.deliveryStatus === 'PENDING'
          ? 'Chờ giao'
          : o.deliveryStatus,
        o.deliveryNote || o.note || '',
        o.deliveryTime || o.deliveryDueAt || '',
      ];
    });

    const csvContent =
      headers.map(escapeCsvCell).join(',') +
      '\r\n' +
      rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');

    downloadCsv(`BangKe_GiaoHang_${manifestId}.csv`, csvContent);
    showToast(`✓ Đã xuất ${sortedOrders.length} đơn sang file CSV!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 print-active-host print-printable-root">
      {/* Modal Card */}
      <div className="bg-slate-50 w-full sm:max-w-5xl max-h-[96vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Top Header - Hidden in Print */}
        <div className="no-print bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-black shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
                  In Bảng Kê Giao Hàng (Print Manifest)
                </h2>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                  {totalOrdersCount} ĐƠN CHỜ GIAO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Bảng kê chuẩn in A4 dành cho Shipper & Thủ kho điều phối • Tối ưu theo chuẩn CSS Print
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition active:scale-95"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Option Controls - Hidden in Print */}
        <div className="no-print bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
          {/* Scope Filters */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setScope('ALL_PENDING')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                scope === 'ALL_PENDING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Tất cả chưa giao</span>
              <span className="text-[10px] bg-black/15 px-1.5 py-0.2 rounded-full">
                {orders.filter((o) => o.status === 'ACTIVE' && o.deliveryStatus !== 'DELIVERED').length}
              </span>
            </button>
            <button
              onClick={() => setScope('STRICT_PENDING')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                scope === 'STRICT_PENDING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Chỉ chờ xử lý</span>
              <span className="text-[10px] bg-black/15 px-1.5 py-0.2 rounded-full">
                {orders.filter((o) => o.status === 'ACTIVE' && o.deliveryStatus === 'PENDING').length}
              </span>
            </button>
            <button
              onClick={() => setScope('OUT_FOR_DELIVERY')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                scope === 'OUT_FOR_DELIVERY'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>Đang đi giao</span>
              <span className="text-[10px] bg-black/15 px-1.5 py-0.2 rounded-full">
                {
                  orders.filter(
                    (o) =>
                      o.status === 'ACTIVE' &&
                      (o.deliveryStatus === 'OUT_FOR_DELIVERY' ||
                        o.deliveryStatus === 'READY_FOR_DELIVERY')
                  ).length
                }
              </span>
            </button>
          </div>

          {/* Sort By Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Sắp xếp:</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setSortBy('LOCATION')}
                className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] flex items-center gap-1 ${
                  sortBy === 'LOCATION'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Gom nhóm theo Chung cư, Tòa nhà, Tầng để shipper giao tiện lợi nhất"
              >
                <Building2 className="w-3 h-3" />
                <span>Theo Tòa / Căn hộ</span>
              </button>
              <button
                onClick={() => setSortBy('PRIORITY_TIME')}
                className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] flex items-center gap-1 ${
                  sortBy === 'PRIORITY_TIME'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Đơn gấp 🔥 và giờ hẹn giao lên trước"
              >
                <Clock className="w-3 h-3" />
                <span>Theo Gấp & Giờ</span>
              </button>
              <button
                onClick={() => setSortBy('ORDER_ID')}
                className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] flex items-center gap-1 ${
                  sortBy === 'ORDER_ID'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Mã đơn</span>
              </button>
            </div>
          </div>

          {/* Display Checkbox Toggles */}
          <div className="flex items-center gap-3 font-medium text-slate-600">
            <label className="flex items-center gap-1 cursor-pointer select-none hover:text-slate-900">
              <input
                type="checkbox"
                checked={showItemDetails}
                onChange={(e) => setShowItemDetails(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Chi tiết món</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer select-none hover:text-slate-900">
              <input
                type="checkbox"
                checked={showDeliveryNotes}
                onChange={(e) => setShowDeliveryNotes(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Ghi chú giao</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer select-none hover:text-slate-900">
              <input
                type="checkbox"
                checked={showSignatureBlock}
                onChange={(e) => setShowSignatureBlock(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Ký nhận</span>
            </label>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {feedbackNotice && (
          <div className="no-print bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 text-center transition animate-fadeIn">
            {feedbackNotice}
          </div>
        )}

        {/* Scrollable Live Preview Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/80">
          
          {/* THE PRINTABLE SHEET (COMPLIES WITH .print-printable-sheet & CSS rules) */}
          <div
            ref={printableRef}
            id="printable-delivery-manifest"
            className="print-printable-sheet bg-white text-slate-900 rounded-lg shadow-md max-w-[210mm] mx-auto p-6 sm:p-8 text-xs font-sans leading-relaxed border border-slate-300 print:border-none print:shadow-none print:p-0"
          >
            {/* Manifest Header */}
            <div className="border-b-2 border-slate-950 pb-3 mb-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white px-2 py-0.5 rounded print:border print:border-black print:text-black print:bg-transparent">
                      MANIFEST
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      ODER CHECKLIST SYSTEM
                    </span>
                  </div>
                  <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 uppercase mt-1">
                    BẢNG KÊ GIAO HÀNG (DELIVERY MANIFEST)
                  </h1>
                  <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                    Danh sách đơn hàng chờ giao • Kiểm soát thu hộ COD & Bàn giao hàng hóa
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Mã Bảng Kê</div>
                  <div className="font-mono text-sm font-black text-slate-900 tracking-wide">
                    {manifestId}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    In lúc: {manifestTimeFormatted} - {manifestDateFormatted}
                  </div>
                </div>
              </div>

              {/* Sub-meta grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-dashed border-slate-300 text-[11px]">
                <div>
                  <span className="text-slate-500">Người lập / Điều phối:</span>{' '}
                  <span className="font-bold text-slate-800">{currentUser}</span>
                </div>
                <div>
                  <span className="text-slate-500">Tiêu chí lọc:</span>{' '}
                  <span className="font-bold text-slate-800">
                    {scope === 'ALL_PENDING'
                      ? 'Tất cả đơn chưa giao'
                      : scope === 'STRICT_PENDING'
                      ? 'Chỉ đơn Chờ xử lý'
                      : 'Đơn đang đi giao'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Sắp xếp theo:</span>{' '}
                  <span className="font-bold text-slate-800">
                    {sortBy === 'LOCATION'
                      ? 'Tòa nhà / Căn hộ'
                      : sortBy === 'PRIORITY_TIME'
                      ? 'Đơn gấp & Giờ hẹn'
                      : 'Mã đơn'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Tổng điểm giao:</span>{' '}
                  <span className="font-black text-slate-900">{totalOrdersCount} đơn hàng</span>
                </div>
              </div>
            </div>

            {/* Operational Summary KPI Row - Print break inside avoid */}
            <div className="mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-300 print-break-inside-avoid">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className="border-r border-slate-200 last:border-none p-1">
                  <p className="text-[9px] uppercase font-bold text-slate-500">Tổng số đơn</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{totalOrdersCount}</p>
                </div>
                <div className="border-r border-slate-200 last:border-none p-1">
                  <p className="text-[9px] uppercase font-bold text-slate-500">Tổng số món / kiện</p>
                  <p className="text-base font-black text-slate-900 mt-0.5">{totalItemsCount}</p>
                </div>
                <div className="border-r border-slate-200 last:border-none p-1">
                  <p className="text-[9px] uppercase font-bold text-slate-600">Tổng tiền đơn hàng</p>
                  <p className="text-sm font-black text-slate-800 mt-0.5">
                    {formatVND(totalOrderAmount)}
                  </p>
                </div>
                <div className="border-r border-slate-200 last:border-none p-1 bg-amber-50/80 rounded">
                  <p className="text-[9px] uppercase font-bold text-amber-900">CẦN THU COD (TIỀN MẶT)</p>
                  <p className="text-sm font-black text-rose-700 mt-0.5">
                    {formatVND(totalCodAmount)}
                  </p>
                </div>
                <div className="p-1 bg-emerald-50/80 rounded">
                  <p className="text-[9px] uppercase font-bold text-emerald-900">ĐÃ THANH TOÁN TRƯỚC</p>
                  <p className="text-sm font-black text-emerald-800 mt-0.5">
                    {formatVND(totalPrepaidAmount)}
                  </p>
                </div>
              </div>

              {urgentOrdersCount > 0 && (
                <div className="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-amber-900 px-1">
                  <span>🔥 Lưu ý: Có {urgentOrdersCount} đơn hỏa tốc / gấp cần ưu tiên giao trước!</span>
                  <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-black">
                    ƯU TIÊN HỎA TỐC
                  </span>
                </div>
              )}
            </div>

            {/* Main Manifest Table - Printer-Friendly */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[10px] sm:text-[11px] border border-slate-400">
                <thead>
                  <tr className="bg-slate-200/90 text-slate-900 border-b border-slate-400 font-bold print:bg-slate-100">
                    <th className="py-2 px-1 text-center w-7 border-r border-slate-300">STT</th>
                    <th className="py-2 px-1.5 text-left w-18 border-r border-slate-300">Mã đơn</th>
                    <th className="py-2 px-1.5 text-center w-16 border-r border-slate-300">Ưu tiên / Hẹn</th>
                    <th className="py-2 px-2 text-left w-28 border-r border-slate-300">Khách & SĐT</th>
                    <th className="py-2 px-2 text-left border-r border-slate-300">
                      Địa chỉ nhận hàng (Căn hộ / Tòa)
                    </th>
                    {showItemDetails && (
                      <th className="py-2 px-2 text-left w-44 border-r border-slate-300">
                        Chi tiết món & SL
                      </th>
                    )}
                    <th className="py-2 px-2 text-right w-22 border-r border-slate-300">
                      Thu COD (VNĐ)
                    </th>
                    <th className="py-2 px-1 text-center w-16 border-r border-slate-300">Hình thức</th>
                    {showCheckboxes && (
                      <th className="py-2 px-2 text-center w-24">Ký nhận / Tình trạng</th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {sortedOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showItemDetails ? 9 : 8}
                        className="py-8 text-center text-slate-500 font-medium"
                      >
                        Không có đơn hàng nào chờ giao trong bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    sortedOrders.map((ord, idx) => {
                      const isCod = ord.paymentStatus === 'UNPAID';
                      const isHighPriority = ord.priority === 'HIGH';
                      const itemsTotalCount = ord.items.reduce((s, it) => s + it.quantity, 0);

                      // Location text formatting
                      const hasCondo = Boolean(ord.location.condoName);
                      const unitDetails = [
                        ord.location.unit ? `P.${ord.location.unit}` : '',
                        ord.location.floor ? `Tầng ${ord.location.floor}` : '',
                        ord.location.block ? `Block ${ord.location.block}` : '',
                      ]
                        .filter(Boolean)
                        .join(' • ');

                      return (
                        <tr
                          key={ord.id}
                          className={`border-b border-slate-300 print-break-inside-avoid ${
                            idx % 2 === 1 ? 'bg-slate-50/70 print:bg-slate-50/50' : 'bg-white'
                          } ${isHighPriority ? 'bg-amber-50/40' : ''}`}
                        >
                          {/* STT */}
                          <td className="py-2 px-1 text-center font-bold text-slate-600 border-r border-slate-200">
                            {idx + 1}
                          </td>

                          {/* Order ID */}
                          <td className="py-2 px-1.5 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                            {ord.id}
                          </td>

                          {/* Priority / Due Time */}
                          <td className="py-2 px-1 text-center border-r border-slate-200">
                            {isHighPriority && (
                              <div className="font-black text-[9px] text-rose-700 bg-rose-100/90 rounded px-1 py-0.2 mb-0.5 inline-block">
                                🔥 GẤP
                              </div>
                            )}
                            {ord.deliveryDueAt ? (
                              <div className="font-mono text-[9px] font-bold text-slate-700">
                                {new Date(ord.deliveryDueAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            ) : ord.deliveryTime ? (
                              <div className="text-[9px] text-slate-600 font-medium">
                                {ord.deliveryTime}
                              </div>
                            ) : (
                              <div className="text-[9px] text-slate-400">Tiêu chuẩn</div>
                            )}
                          </td>

                          {/* Customer Name & Phone */}
                          <td className="py-2 px-2 border-r border-slate-200">
                            <div className="font-bold text-slate-900 leading-tight">
                              {ord.customerName}
                            </div>
                            {ord.customerPhone && (
                              <div className="font-mono text-[10px] text-slate-600 mt-0.5">
                                {ord.customerPhone}
                              </div>
                            )}
                          </td>

                          {/* Delivery Address */}
                          <td className="py-2 px-2 border-r border-slate-200">
                            {hasCondo ? (
                              <div>
                                <div className="font-bold text-slate-900">
                                  {ord.location.condoName}
                                </div>
                                {unitDetails && (
                                  <div className="font-bold text-blue-900 text-[10px] mt-0.5">
                                    {unitDetails}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="font-medium text-slate-800">
                                {ord.location.formattedAddress}
                              </div>
                            )}

                            {/* Optional Delivery notes */}
                            {showDeliveryNotes && (ord.deliveryNote || ord.note) && (
                              <div className="text-[9px] text-amber-900 italic mt-0.5 bg-amber-50/70 p-1 rounded border border-amber-200/60 print:bg-transparent print:border-none print:p-0">
                                💬 {ord.deliveryNote || ord.note}
                              </div>
                            )}
                          </td>

                          {/* Items breakdown */}
                          {showItemDetails && (
                            <td className="py-2 px-2 border-r border-slate-200">
                              <div className="space-y-0.5">
                                {ord.items.map((item, itIdx) => (
                                  <div
                                    key={itIdx}
                                    className="flex justify-between items-baseline gap-1 text-[10px]"
                                  >
                                    <span className="font-medium text-slate-800 truncate">
                                      <strong className="text-slate-900">{item.quantity}x</strong>{' '}
                                      {item.productName}
                                    </span>
                                    <span className="text-slate-500 font-mono text-[9px] shrink-0">
                                      {formatVND(item.lineTotal)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="text-[9px] text-slate-500 font-bold border-t border-slate-200 mt-1 pt-0.5 text-right">
                                Tổng: {itemsTotalCount} món ({formatVND(ord.totalAmount)})
                              </div>
                            </td>
                          )}

                          {/* COD Amount */}
                          <td className="py-2 px-2 text-right border-r border-slate-200">
                            {isCod ? (
                              <div>
                                <span className="font-mono text-xs font-black text-rose-700">
                                  {formatVND(ord.totalAmount)}
                                </span>
                                <div className="text-[8px] font-bold text-rose-600 uppercase">
                                  THU TIỀN MẶT
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="font-mono text-[11px] font-bold text-emerald-700">
                                  0 đ
                                </span>
                                <div className="text-[8px] font-bold text-emerald-600 uppercase">
                                  ĐÃ THANH TOÁN
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Payment Method */}
                          <td className="py-2 px-1 text-center border-r border-slate-200 whitespace-nowrap">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                isCod
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {isCod ? 'Thu COD' : 'Đã trả trước'}
                            </span>
                            <div className="text-[8px] text-slate-500 mt-0.5">
                              {ord.paymentMethod === 'BANK_TRANSFER'
                                ? 'Chuyển khoản'
                                : ord.paymentMethod === 'CASH'
                                ? 'Tiền mặt'
                                : 'Chưa định'}
                            </div>
                          </td>

                          {/* Signature / Checkbox Box */}
                          {showCheckboxes && (
                            <td className="py-1.5 px-2 text-center">
                              <div className="flex flex-col items-center justify-center space-y-1">
                                <div className="flex items-center gap-1.5 text-[8px] text-slate-600">
                                  <span>[ &nbsp; ] Giao xong</span>
                                  <span>[ &nbsp; ] Hẹn lại</span>
                                </div>
                                <div className="h-6 w-full border border-dashed border-slate-300 rounded flex items-center justify-center text-[8px] text-slate-400">
                                  Ký nhận
                                </div>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Table Footer with bold totals */}
                <tfoot>
                  <tr className="bg-slate-200/90 text-slate-900 font-bold border-t-2 border-slate-400">
                    <td colSpan={4} className="py-2 px-2 text-left border-r border-slate-300">
                      TỔNG CỘNG ({totalOrdersCount} ĐƠN CHỜ GIAO):
                    </td>
                    <td className="py-2 px-2 text-left border-r border-slate-300">
                      {totalOrdersCount} điểm giao
                    </td>
                    {showItemDetails && (
                      <td className="py-2 px-2 text-right border-r border-slate-300 font-bold">
                        {totalItemsCount} món hàng
                      </td>
                    )}
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      <div className="font-mono text-xs font-black text-rose-700">
                        {formatVND(totalCodAmount)}
                      </div>
                      <div className="text-[8px] text-slate-600 uppercase font-bold">
                        Tổng tiền COD cần nộp
                      </div>
                    </td>
                    <td className="py-2 px-1 text-center border-r border-slate-300 text-[10px]">
                      {formatVND(totalPrepaidAmount)}
                    </td>
                    {showCheckboxes && (
                      <td className="py-2 px-1 text-center text-[9px] text-slate-600">
                        Kiểm đủ {totalOrdersCount} đơn
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Handover & Signatures Section - Print Break Inside Avoid */}
            {showSignatureBlock && (
              <div className="mt-6 pt-4 border-t border-slate-300 print-break-inside-avoid">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  XÁC NHẬN BÀN GIAO & ĐIỀU PHỐI HÀNG HÓA
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-2 border border-slate-200 rounded-lg">
                    <p className="font-bold text-slate-800 text-[11px]">Người Lập Bảng Kê</p>
                    <p className="text-[9px] text-slate-500 italic">(Ký, ghi rõ họ tên)</p>
                    <div className="h-16 flex items-end justify-center font-bold text-slate-800 text-[11px]">
                      {currentUser}
                    </div>
                  </div>
                  <div className="p-2 border border-slate-200 rounded-lg">
                    <p className="font-bold text-slate-800 text-[11px]">Nhân Viên Giao Hàng</p>
                    <p className="text-[9px] text-slate-500 italic">(Xác nhận nhận đủ số đơn & hàng)</p>
                    <div className="h-16 flex items-end justify-center font-bold text-slate-400 text-[10px]">
                      .......................................
                    </div>
                  </div>
                  <div className="p-2 border border-slate-200 rounded-lg">
                    <p className="font-bold text-slate-800 text-[11px]">Thủ Kho / Giám Sát</p>
                    <p className="text-[9px] text-slate-500 italic">(Xác nhận xuất kho bàn giao)</p>
                    <div className="h-16 flex items-end justify-center font-bold text-slate-400 text-[10px]">
                      .......................................
                    </div>
                  </div>
                </div>

                {/* Footer disclaimer note */}
                <div className="mt-4 pt-2 border-t border-dotted border-slate-300 flex justify-between items-center text-[9px] text-slate-500">
                  <span>
                    Bảng kê in từ Hệ thống Oder Checklist • Vui lòng kiểm tra kỹ số tiền COD và hàng hóa
                    khi bàn giao.
                  </span>
                  <span className="font-mono">
                    Trang 1 / 1 • Mã: {manifestId}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Actions Bar - Hidden in Print */}
        <div className="no-print bg-white p-3 sm:p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            <span>Sẵn sàng in: </span>
            <span className="font-bold text-slate-900">{totalOrdersCount} đơn chờ giao</span> •{' '}
            <span className="font-bold text-rose-700">COD: {formatVND(totalCodAmount)}</span> •{' '}
            <span className="font-bold text-emerald-700">Đã TT: {formatVND(totalPrepaidAmount)}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary Print Button */}
            <button
              onClick={handlePrint}
              disabled={totalOrdersCount === 0}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50"
              title="Mở hộp thoại in của trình duyệt để in trực tiếp hoặc lưu dạng PDF vector"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>In Bảng Kê (Print Now)</span>
            </button>

            {/* Download PDF button */}
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || totalOrdersCount === 0}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Tải file PDF lưu trữ offline"
            >
              <FileDown className="w-4 h-4 text-rose-100" />
              <span>{isExportingPdf ? exportProgressText || 'Đang tạo...' : 'Tải File PDF'}</span>
            </button>

            {/* Export CSV button */}
            <button
              onClick={handleExportCsv}
              disabled={totalOrdersCount === 0}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Tải dữ liệu bảng kê ra Excel / CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Xuất CSV</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
