import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { Order, PaymentMethod, PREDEFINED_ORDER_TAGS, OrderPriority, ORDER_PRIORITY_OPTIONS } from '../types';
import { ExportOrderReportModal } from './ExportOrderReportModal';
import { getOrderDeliveryDueStatus } from '../utils/notificationScheduler';
import {
  ArrowLeft,
  History,
  Search,
  Calendar,
  X,
  Filter,
  CheckCircle2,
  Clock,
  Phone,
  Building2,
  MapPin,
  Lock,
  FileText,
  Banknote,
  Landmark,
  Copy,
  Check,
  Truck,
  UserCheck,
  AlertCircle,
  SlidersHorizontal,
  ChevronRight,
  Package,
  Tag,
  Download,
  FileSpreadsheet,
  FileDown,
  Printer,
  CalendarRange,
  AlertTriangle,
  Rocket,
  Camera,
} from 'lucide-react';

type DatePreset =
  | 'ALL'
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'DATE_RANGE';

export const OrderHistoryScreen: React.FC = () => {
  const {
    orders,
    markReadyForDelivery,
    markDelivered,
    markPaid,
    currentUser,
    setCurrentScreen,
    globalSearchQuery,
    setGlobalSearchQuery,
    schedulerConfig,
  } = useApp();

  // Filters
  const [searchQuery, setSearchQuery] = useState(globalSearchQuery || '');

  // Keep synced if global search query changes
  useEffect(() => {
    if (globalSearchQuery !== undefined) {
      setSearchQuery(globalSearchQuery);
    }
  }, [globalSearchQuery]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DELIVERED' | 'PENDING'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | OrderPriority>('ALL');
  const [showFilters, setShowFilters] = useState<boolean>(true);

  // UI State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [payModalOrder, setPayModalOrder] = useState<Order | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper date strings
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const thisMonthStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 7);
  }, []);

  // All available tags in system
  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    PREDEFINED_ORDER_TAGS.forEach((t) => set.add(t.id));
    orders.forEach((o) => {
      (o.tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [orders]);

  // Filtered orders calculation
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Delivery Status Filter
      if (statusFilter === 'DELIVERED' && order.deliveryStatus !== 'DELIVERED') return false;
      if (statusFilter === 'PENDING' && order.deliveryStatus !== 'PENDING') return false;

      // 2. Payment Filter
      if (paymentFilter === 'PAID' && order.paymentStatus !== 'PAID') return false;
      if (paymentFilter === 'UNPAID' && order.paymentStatus !== 'UNPAID') return false;

      // 3. Date Filter
      const orderDateStr = order.createdAt ? order.createdAt.split('T')[0] : '';
      if (datePreset === 'TODAY') {
        if (orderDateStr !== todayStr) return false;
      } else if (datePreset === 'YESTERDAY') {
        if (orderDateStr !== yesterdayStr) return false;
      } else if (datePreset === 'LAST_7_DAYS') {
        const orderTime = new Date(order.createdAt).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (orderTime < sevenDaysAgo) return false;
      } else if (datePreset === 'LAST_30_DAYS') {
        const orderTime = new Date(order.createdAt).getTime();
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (orderTime < thirtyDaysAgo) return false;
      } else if (datePreset === 'THIS_MONTH') {
        if (!orderDateStr.startsWith(thisMonthStr)) return false;
      } else if (datePreset === 'DATE_RANGE') {
        if (startDate && orderDateStr < startDate) return false;
        if (endDate && orderDateStr > endDate) return false;
      }

      // 4. Tag Filter
      if (selectedTagFilter !== 'ALL') {
        if (!order.tags || !order.tags.includes(selectedTagFilter)) {
          return false;
        }
      }

      // 5. Priority Filter (Low, Medium, High)
      if (priorityFilter !== 'ALL') {
        const orderPriority = order.priority || 'MEDIUM';
        if (orderPriority !== priorityFilter) {
          return false;
        }
      }

      // 6. Search Query (Customer name, phone, address, ID, notes, tags, priority)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = order.customerName.toLowerCase().includes(q);
        const phoneMatch = (order.customerPhone || '').includes(q);
        const idMatch = order.id.toLowerCase().includes(q);
        const addressMatch = (order.location.formattedAddress || '').toLowerCase().includes(q);
        const extMatch = (order.location.externalAddress || '').toLowerCase().includes(q);
        const condoMatch = (order.location.condoName || '').toLowerCase().includes(q);
        const deliveryNoteMatch = (order.location.deliveryNote || '').toLowerCase().includes(q);
        const internalNoteMatch = (order.internalNote || '').toLowerCase().includes(q);
        const tagMatch = (order.tags || []).some((t) => t.toLowerCase().includes(q));
        const priorityStr = order.priority === 'HIGH' ? 'cao high' : order.priority === 'LOW' ? 'thấp low' : 'trung bình medium';
        const priorityMatch = priorityStr.includes(q);

        if (
          !nameMatch &&
          !phoneMatch &&
          !idMatch &&
          !addressMatch &&
          !extMatch &&
          !condoMatch &&
          !deliveryNoteMatch &&
          !internalNoteMatch &&
          !tagMatch &&
          !priorityMatch
        ) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, statusFilter, paymentFilter, datePreset, startDate, endDate, selectedTagFilter, priorityFilter, searchQuery, todayStr, yesterdayStr, thisMonthStr]);

  // Aggregate Metrics for current filter
  const metrics = useMemo(() => {
    const totalCount = filteredOrders.length;
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const deliveredCount = filteredOrders.filter((o) => o.deliveryStatus === 'DELIVERED').length;
    const pendingCount = filteredOrders.filter((o) => o.deliveryStatus === 'PENDING').length;
    const paidCount = filteredOrders.filter((o) => o.paymentStatus === 'PAID').length;
    const unpaidCount = filteredOrders.filter((o) => o.paymentStatus === 'UNPAID').length;
    const unpaidAmount = filteredOrders
      .filter((o) => o.paymentStatus === 'UNPAID')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      totalCount,
      totalRevenue,
      deliveredCount,
      pendingCount,
      paidCount,
      unpaidCount,
      unpaidAmount,
    };
  }, [filteredOrders]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      statusFilter !== 'ALL' ||
      paymentFilter !== 'ALL' ||
      datePreset !== 'ALL' ||
      startDate ||
      endDate ||
      selectedTagFilter !== 'ALL' ||
      priorityFilter !== 'ALL'
  );

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setSelectedTagFilter('ALL');
    setPriorityFilter('ALL');
  };

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      showToast('Không có đơn hàng nào trong danh sách hiện tại để xuất CSV!');
      return;
    }

    const headers = [
      'Mã đơn hàng',
      'Thời gian tạo',
      'Mức độ ưu tiên',
      'Tên khách hàng',
      'Số điện thoại',
      'Loại đơn',
      'Địa chỉ giao hàng',
      'Chung cư',
      'Ghi chú giao hàng',
      'Ghi chú nội bộ',
      'Nhãn phân loại (Tags)',
      'Danh sách món',
      'Tổng số lượng món',
      'Tổng tiền (VND)',
      'Trạng thái giao hàng',
      'Thời gian giao hàng',
      'Người giao hàng',
      'Trạng thái thanh toán',
      'Hình thức thanh toán',
      'Thời gian thu tiền',
      'Người xác nhận thu tiền',
    ];

    const rows = filteredOrders.map((order) => {
      const itemsStr = order.items
        .map((i) => `${i.productName} (x${i.quantity} ${i.unit || 'phần'})`)
        .join('; ');
      const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
      const tagsStr = (order.tags || []).join(', ');
      const isCondo = order.location.type === 'condo';
      const priorityStr =
        order.priority === 'HIGH'
          ? 'Cao (High)'
          : order.priority === 'LOW'
          ? 'Thấp (Low)'
          : 'Trung bình (Medium)';

      return [
        order.id,
        new Date(order.createdAt).toLocaleString('vi-VN'),
        priorityStr,
        order.customerName,
        order.customerPhone || '',
        isCondo ? 'Chung cư' : 'Khách ngoài',
        order.location.formattedAddress,
        order.location.condoName || '',
        order.location.deliveryNote || '',
        order.internalNote || '',
        tagsStr,
        itemsStr,
        totalQty,
        order.totalAmount,
        order.deliveryStatus === 'DELIVERED' ? 'Đã giao' : 'Chờ giao',
        order.deliveryTime ? new Date(order.deliveryTime).toLocaleString('vi-VN') : '',
        order.deliveredBy || '',
        order.paymentStatus === 'PAID' ? 'Đã thu tiền' : 'Chưa thu tiền',
        order.paymentMethod === 'CASH'
          ? 'Tiền mặt'
          : order.paymentMethod === 'BANK_TRANSFER'
          ? 'Chuyển khoản'
          : '',
        order.paymentTime ? new Date(order.paymentTime).toLocaleString('vi-VN') : '',
        order.paidConfirmedBy || '',
      ].map((val) => {
        const str = String(val ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',');
    });

    // Add UTF-8 BOM so Excel / Google Sheets open Vietnamese characters cleanly
    const csvContent = '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateTag =
      datePreset === 'DATE_RANGE' && (startDate || endDate)
        ? `${startDate || 'truoc'}_den_${endDate || 'nay'}`
        : new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `don_hang_${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Đã xuất ${filteredOrders.length} đơn hàng ra file CSV thành công!`);
  };

  const handleCopyOrder = (order: Order) => {
    const lines = [
      `📦 ĐƠN HÀNG: ${order.id}`,
      `👤 Khách hàng: ${order.customerName} ${order.customerPhone ? `(${order.customerPhone})` : ''}`,
      `📍 Địa chỉ: ${order.location.formattedAddress}`,
      `🕒 Ngày tạo: ${new Date(order.createdAt).toLocaleString('vi-VN')}`,
      `📋 Sản phẩm:`,
      ...order.items.map((i) => `  - ${i.productName} x${i.quantity} = ${formatVND(i.lineTotal)}`),
      `💰 Tổng tiền: ${formatVND(order.totalAmount)}`,
      `🚚 Trạng thái: ${order.deliveryStatus === 'DELIVERED' ? 'Đã giao' : 'Chờ giao'}`,
      `💵 Thanh toán: ${order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thu tiền'}`,
      `⚡ Mức ưu tiên: ${order.priority === 'HIGH' ? 'Cao (High)' : order.priority === 'LOW' ? 'Thấp (Low)' : 'Trung bình (Medium)'}`,
    ];
    if (order.tags && order.tags.length > 0) {
      lines.push(`🏷️ Nhãn phân loại: ${order.tags.map((t) => `#${t}`).join(', ')}`);
    }
    if (order.location.deliveryNote) {
      lines.push(`📝 Ghi chú giao: ${order.location.deliveryNote}`);
    }
    if (order.internalNote) {
      lines.push(`🔒 Ghi chú nội bộ: ${order.internalNote}`);
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedId(order.id);
    showToast(`Đã sao chép chi tiết đơn ${order.id}`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleConfirmDeliver = (order: Order) => {
    markDelivered(order.id);
    showToast(`Đã xác nhận giao xong đơn ${order.id} (${order.location.formattedAddress})`);
  };

  const handlePay = (method: PaymentMethod) => {
    if (!payModalOrder) return;
    markPaid(payModalOrder.id, method);
    showToast(
      `Đã thu tiền đơn ${payModalOrder.id} qua ${
        method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'
      } (${formatVND(payModalOrder.totalAmount)})`
    );
    setPayModalOrder(null);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Toast message */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setCurrentScreen('HOME')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs active:scale-95 transition shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        <div className="text-center min-w-0 flex-1">
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center justify-center gap-1.5 truncate">
            <History className="w-5 h-5 text-indigo-600 shrink-0" />
            <span className="truncate">LỊCH SỬ ĐƠN HÀNG</span>
          </h2>
          <p className="text-[10px] text-slate-500 font-medium truncate">
            {filteredOrders.length} / {orders.length} đơn hàng
          </p>
        </div>

        {/* Top Export Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={filteredOrders.length === 0}
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl shadow-xs transition active:scale-95 shrink-0 ${
              filteredOrders.length > 0
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
            title={`Xuất ${filteredOrders.length} đơn hàng ra PDF hoặc In ấn`}
          >
            <FileDown className="w-4 h-4 text-rose-100" />
            <span className="hidden sm:inline">Xuất PDF / In</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredOrders.length === 0}
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl shadow-xs transition active:scale-95 shrink-0 ${
              filteredOrders.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
            title={`Xuất ${filteredOrders.length} đơn hàng ra file Excel / CSV`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span className="hidden sm:inline">Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* PERSISTENT STICKY SEARCH & ACTIONS BAR */}
      <div className="sticky top-[47px] z-30 bg-slate-100/95 backdrop-blur-md -mx-3.5 sm:-mx-4 px-3.5 sm:px-4 py-2 shadow-xs border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          {/* Live Search input with real-time clear */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Tìm theo tên khách, số ĐT, mã đơn, căn hộ, nhãn..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setGlobalSearchQuery(e.target.value);
              }}
              className="w-full pl-9 pr-8 py-2 text-xs font-semibold rounded-2xl bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-800 placeholder:text-slate-400 shadow-2xs transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setGlobalSearchQuery('');
                }}
                className="absolute right-2 top-2 p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle Filter Panel Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-2xl text-xs font-bold border transition flex items-center gap-1.5 shadow-2xs shrink-0 ${
              hasActiveFilters
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title="Đóng / mở bộ lọc"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bộ lọc</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
            )}
          </button>

          {/* Quick Export Buttons in Persistent Bar */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsExportModalOpen(true)}
              disabled={filteredOrders.length === 0}
              className={`p-2 sm:px-2.5 sm:py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1 shadow-2xs shrink-0 active:scale-95 ${
                filteredOrders.length > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title={`Xuất ${filteredOrders.length} đơn hàng ra PDF hoặc In ấn`}
            >
              <FileDown className="w-4 h-4 text-rose-100" />
              <span className="hidden sm:inline">PDF / In</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredOrders.length === 0}
              className={`p-2 sm:px-2.5 sm:py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1 shadow-2xs shrink-0 active:scale-95 ${
                filteredOrders.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title={`Xuất ${filteredOrders.length} đơn hàng ra file Excel / CSV`}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV ({filteredOrders.length})</span>
            </button>
          </div>
        </div>

        {/* Persistent Active Filter Badges Bar */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 pt-1.5 flex-wrap text-[10px]">
            <span className="font-bold text-slate-400">Đang lọc:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-full font-semibold text-slate-700 shadow-2xs">
                Tìm: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-red-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {datePreset !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold text-indigo-700 shadow-2xs">
                {datePreset === 'TODAY' && 'Hôm nay'}
                {datePreset === 'YESTERDAY' && 'Hôm qua'}
                {datePreset === 'LAST_7_DAYS' && '7 ngày qua'}
                {datePreset === 'LAST_30_DAYS' && '30 ngày qua'}
                {datePreset === 'THIS_MONTH' && 'Tháng này'}
                {datePreset === 'DATE_RANGE' &&
                  `Khoảng ngày: ${startDate || '...'} → ${endDate || '...'}`}
                <button
                  onClick={() => {
                    setDatePreset('ALL');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="hover:text-red-500"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-bold text-blue-700 shadow-2xs">
                {statusFilter === 'DELIVERED' ? 'Đã giao' : 'Chờ giao'}
                <button onClick={() => setStatusFilter('ALL')} className="hover:text-red-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {paymentFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold text-amber-700 shadow-2xs">
                {paymentFilter === 'PAID' ? 'Đã thu' : 'Chưa thu'}
                <button onClick={() => setPaymentFilter('ALL')} className="hover:text-red-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {selectedTagFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-bold text-rose-700 shadow-2xs">
                #{selectedTagFilter}
                <button onClick={() => setSelectedTagFilter('ALL')} className="hover:text-red-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            {priorityFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full font-bold text-purple-700 shadow-2xs">
                Ưu tiên: {priorityFilter === 'HIGH' ? 'Cao' : priorityFilter === 'LOW' ? 'Thấp' : 'Trung bình'}
                <button onClick={() => setPriorityFilter('ALL')} className="hover:text-red-500">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-rose-600 hover:underline font-bold ml-auto"
            >
              Xóa tất cả
            </button>
          </div>
        )}
      </div>

      {/* SEARCH & FILTER CONTROLS PANEL */}
      {showFilters && (
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3.5">
          {/* Date Filter Row with Date Range Support */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                Lọc theo ngày đặt hàng:
              </span>
              {datePreset === 'DATE_RANGE' && (startDate || endDate) && (
                <span className="text-[10px] text-indigo-600 font-bold">
                  {startDate ? new Date(startDate).toLocaleDateString('vi-VN') : 'Từ đầu'} ➔{' '}
                  {endDate ? new Date(endDate).toLocaleDateString('vi-VN') : 'Hiện tại'}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                onClick={() => {
                  setDatePreset('ALL');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                  datePreset === 'ALL'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả
              </button>

              <button
                onClick={() => {
                  setDatePreset('TODAY');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                  datePreset === 'TODAY'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Hôm nay
              </button>

              <button
                onClick={() => {
                  setDatePreset('YESTERDAY');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                  datePreset === 'YESTERDAY'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Hôm qua
              </button>

              <button
                onClick={() => {
                  setDatePreset('LAST_7_DAYS');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                  datePreset === 'LAST_7_DAYS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                7 ngày qua
              </button>

              <button
                onClick={() => {
                  setDatePreset('LAST_30_DAYS');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                  datePreset === 'LAST_30_DAYS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                30 ngày qua
              </button>

              <button
                onClick={() => {
                  setDatePreset('THIS_MONTH');
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                  datePreset === 'THIS_MONTH'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tháng này
              </button>

              <button
                onClick={() => setDatePreset('DATE_RANGE')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition active:scale-95 flex items-center gap-1 ${
                  datePreset === 'DATE_RANGE'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <CalendarRange className="w-3 h-3" />
                <span>Khoảng ngày</span>
              </button>
            </div>

            {/* Interactive Date Range Picker Inputs */}
            {datePreset === 'DATE_RANGE' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5 mt-2.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <CalendarRange className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Khoảng thời gian cần lọc:</span>
                  </span>
                  {(startDate || endDate) && (
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="text-[10px] text-slate-400 hover:text-rose-600 underline font-semibold"
                    >
                      Xóa khoảng ngày
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Từ ngày (Start date):
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setDatePreset('DATE_RANGE');
                      }}
                      className="w-full py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Đến ngày (End date):
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setDatePreset('DATE_RANGE');
                      }}
                      className="w-full py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                </div>

                {/* Quick range shortcuts */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60 text-[10px]">
                  <span className="text-slate-400 font-bold">Gợi ý nhanh:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const end = d.toISOString().split('T')[0];
                      const startD = new Date(d.getTime() - 6 * 24 * 60 * 60 * 1000);
                      const start = startD.toISOString().split('T')[0];
                      setStartDate(start);
                      setEndDate(end);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100"
                  >
                    7 ngày qua
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const end = d.toISOString().split('T')[0];
                      const startD = new Date(d.getTime() - 29 * 24 * 60 * 60 * 1000);
                      const start = startD.toISOString().split('T')[0];
                      setStartDate(start);
                      setEndDate(end);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100"
                  >
                    30 ngày qua
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const year = d.getFullYear();
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const start = `${year}-${month}-01`;
                      const end = d.toISOString().split('T')[0];
                      setStartDate(start);
                      setEndDate(end);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100"
                  >
                    Tháng này
                  </button>
                </div>
              </div>
            )}
          </div>

        {/* Status & Payment Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Delivery status pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giao hàng:</span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                statusFilter === 'ALL'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter('DELIVERED')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                statusFilter === 'DELIVERED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Đã giao ({orders.filter((o) => o.deliveryStatus === 'DELIVERED').length})</span>
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                statusFilter === 'PENDING'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Chờ giao ({orders.filter((o) => o.deliveryStatus === 'PENDING').length})</span>
            </button>
          </div>

          {/* Payment status pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thanh toán:</span>
            <button
              onClick={() => setPaymentFilter('ALL')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                paymentFilter === 'ALL'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setPaymentFilter('PAID')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                paymentFilter === 'PAID'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Đã thu
            </button>
            <button
              onClick={() => setPaymentFilter('UNPAID')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                paymentFilter === 'UNPAID'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Chưa thu
            </button>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1 ml-auto"
            >
              <X className="w-3 h-3" />
              <span>Xóa tất cả lọc</span>
            </button>
          )}
        </div>

        {/* Tag Filter Row */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-500" />
              Lọc theo nhãn phân loại (Order Tags):
            </span>
            {selectedTagFilter !== 'ALL' && (
              <span className="text-[10px] text-rose-600 font-bold">
                Đang lọc: #{selectedTagFilter}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setSelectedTagFilter('ALL')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                selectedTagFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả nhãn
            </button>

            {allAvailableTags.map((tagId) => {
              const count = orders.filter((o) => (o.tags || []).includes(tagId)).length;
              const predefined = PREDEFINED_ORDER_TAGS.find((p) => p.id === tagId);
              const isSelected = selectedTagFilter === tagId;

              return (
                <button
                  key={tagId}
                  onClick={() => setSelectedTagFilter(isSelected ? 'ALL' : tagId)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 active:scale-95 border ${
                    isSelected
                      ? `${predefined ? predefined.color : 'bg-rose-50 text-rose-700 border-rose-300'} ring-2 ring-rose-500 shadow-xs font-black`
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Tag className={`w-2.5 h-2.5 ${isSelected ? 'fill-current' : 'text-slate-400'}`} />
                  <span>{predefined ? predefined.label : tagId}</span>
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                      isSelected ? 'bg-black/10 text-current' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority Filter Row */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-slate-500" />
              Lọc theo mức độ ưu tiên (Order Priority):
            </span>
            {priorityFilter !== 'ALL' && (
              <span className="text-[10px] text-purple-700 font-bold">
                Đang lọc: {priorityFilter === 'HIGH' ? 'Cao (High)' : priorityFilter === 'LOW' ? 'Thấp (Low)' : 'Trung bình (Medium)'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setPriorityFilter('ALL')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                priorityFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả mức ưu tiên
            </button>

            {ORDER_PRIORITY_OPTIONS.map((opt) => {
              const count = orders.filter((o) => (o.priority || 'MEDIUM') === opt.id).length;
              const isSelected = priorityFilter === opt.id;

              return (
                <button
                  key={opt.id}
                  onClick={() => setPriorityFilter(isSelected ? 'ALL' : opt.id)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 active:scale-95 border ${
                    isSelected
                      ? `${opt.badgeClass} ring-2 ring-purple-600 shadow-xs font-black`
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${opt.dotColor}`} />
                  <span>{opt.label}</span>
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                      isSelected ? 'bg-black/10 text-current' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* SUMMARY STATS BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Tổng đơn tìm thấy
          </span>
          <p className="text-xl font-black text-slate-800 mt-0.5 font-mono">
            {metrics.totalCount}{' '}
            <span className="text-xs font-semibold text-slate-400 font-sans">đơn</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Tổng tiền hàng
          </span>
          <p className="text-xl font-black text-emerald-700 mt-0.5 font-mono">
            {formatVND(metrics.totalRevenue)}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Giao hàng
          </span>
          <div className="flex items-center gap-2 mt-0.5 text-xs font-bold font-mono">
            <span className="text-emerald-700">{metrics.deliveredCount} đã giao</span>
            <span className="text-slate-300">•</span>
            <span className="text-blue-600">{metrics.pendingCount} chờ</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Chưa thu tiền
          </span>
          <div className="mt-0.5 text-xs font-bold font-mono">
            {metrics.unpaidCount > 0 ? (
              <span className="text-amber-600 font-black">
                {metrics.unpaidCount} đơn ({formatVND(metrics.unpaidAmount)})
              </span>
            ) : (
              <span className="text-emerald-600 font-bold">Đã thu 100%</span>
            )}
          </div>
        </div>
      </div>

      {/* ORDERS LIST */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 space-y-3 shadow-xs">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">
              Không tìm thấy đơn hàng nào!
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {hasActiveFilters
                ? `Không có đơn hàng nào khớp với từ khóa "${searchQuery}" hoặc các bộ lọc ngày/trạng thái đã chọn.`
                : 'Chưa có dữ liệu đơn hàng trong hệ thống.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-2 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-700 transition active:scale-95"
              >
                Xóa tất cả bộ lọc & Xem lại toàn bộ
              </button>
            )}
          </div>
        ) : (
          filteredOrders.map((order, idx) => {
            const isDelivered = order.deliveryStatus === 'DELIVERED';
            const isPaid = order.paymentStatus === 'PAID';
            const isCondo = order.location.type === 'condo';

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-indigo-300 transition-all space-y-3"
              >
                {/* Header Row: ID, Created Time, Delivery & Payment Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-black text-slate-900 font-mono text-sm bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                      {order.id}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {new Date(order.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      , {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  {/* Dual Status Badges */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        isDelivered
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.deliveryStatus === 'READY_FOR_DELIVERY'
                          ? 'bg-teal-100 text-teal-800 border border-teal-200'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isDelivered ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Đã giao</span>
                        </>
                      ) : order.deliveryStatus === 'READY_FOR_DELIVERY' ? (
                        <>
                          <Rocket className="w-3 h-3 text-teal-600 animate-pulse" />
                          <span>Sẵn sàng</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>Chờ giao</span>
                        </>
                      )}
                    </span>

                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800 animate-pulse'
                      }`}
                    >
                      {isPaid ? (
                        <span>✓ Đã thu</span>
                      ) : (
                        <span>⚠️ Chưa thu</span>
                      )}
                    </span>

                    {/* Priority Tag Badge */}
                    {order.priority && (
                      <button
                        type="button"
                        onClick={() => {
                          const p = order.priority || 'MEDIUM';
                          setPriorityFilter(priorityFilter === p ? 'ALL' : p);
                        }}
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border transition active:scale-95 ${
                          order.priority === 'HIGH'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : order.priority === 'LOW'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        } ${priorityFilter === order.priority ? 'ring-2 ring-purple-600 shadow-2xs font-extrabold' : 'hover:opacity-85'}`}
                        title={`Mức ưu tiên: ${order.priority} (Bấm để lọc)`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            order.priority === 'HIGH'
                              ? 'bg-rose-500'
                              : order.priority === 'LOW'
                              ? 'bg-slate-400'
                              : 'bg-amber-500'
                          }`}
                        />
                        <span>
                          {order.priority === 'HIGH'
                            ? 'Ưu tiên Cao'
                            : order.priority === 'LOW'
                            ? 'Ưu tiên Thấp'
                            : 'Ưu tiên TB'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Location & Customer Row */}
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isCondo ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="bg-blue-600 text-white font-black text-sm px-2.5 py-0.5 rounded-lg tracking-wider">
                            {order.location.formattedAddress}
                          </span>
                          {order.location.condoName && (
                            <span className="text-[11px] text-slate-500 font-semibold truncate">
                              ({order.location.condoName})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                              Khách ngoài
                            </span>
                            <p className="text-xs font-bold text-slate-800 mt-0.5">
                              {order.location.externalAddress || order.location.formattedAddress}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Customer Name & Phone */}
                    <div className="flex items-center gap-2 text-xs pt-0.5">
                      <span className="font-extrabold text-slate-900">{order.customerName}</span>
                      {order.customerPhone && (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="text-blue-600 font-semibold flex items-center gap-0.5 hover:underline"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{order.customerPhone}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Tổng tiền
                    </span>
                    <span className="text-base font-black text-slate-900 font-mono">
                      {formatVND(order.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Order Tags Pills */}
                {order.tags && order.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap px-1">
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      Nhãn:
                    </span>
                    {order.tags.map((tag) => {
                      const predefined = PREDEFINED_ORDER_TAGS.find((p) => p.id === tag);
                      const isFilterActive = selectedTagFilter === tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setSelectedTagFilter(isFilterActive ? 'ALL' : tag)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition flex items-center gap-1 active:scale-95 ${
                            predefined
                              ? predefined.color
                              : 'bg-teal-50 text-teal-700 border-teal-200'
                          } ${isFilterActive ? 'ring-2 ring-rose-500 font-black shadow-xs' : 'hover:opacity-85'}`}
                          title={`Bấm để lọc theo nhãn ${tag}`}
                        >
                          <span>#{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Items Breakdown */}
                <div className="bg-white rounded-xl p-2.5 text-xs text-slate-700 space-y-1.5 border border-slate-100">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Package className="w-3 h-3 text-slate-400" />
                    <span>Chi tiết món ăn ({order.items.reduce((s, i) => s + i.quantity, 0)} phần):</span>
                  </div>
                  {order.items.map((item, iIdx) => (
                    <div key={iIdx} className="flex justify-between font-medium">
                      <span>
                        • {item.productName}{' '}
                        <strong className="text-slate-900">x{item.quantity}</strong>{' '}
                        <span className="text-[11px] text-slate-400">
                          ({formatVND(item.unitPrice)})
                        </span>
                      </span>
                      <span className="text-slate-600 font-mono font-semibold">
                        {formatVND(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Notes & Receipt Image if present */}
                {(order.location.deliveryNote || order.internalNote || order.receiptImageUrl) && (
                  <div className="space-y-1.5">
                    {order.receiptImageUrl && (
                      <div className="flex items-center gap-2.5 p-2 bg-indigo-50/80 rounded-xl border border-indigo-200">
                        <img
                          src={order.receiptImageUrl}
                          alt="Biên nhận giao hàng"
                          className="w-12 h-12 object-cover rounded-lg border border-indigo-300 shadow-xs"
                        />
                        <div className="text-xs">
                          <p className="font-extrabold text-indigo-950 flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Biên nhận giao hàng (Đã chụp)</span>
                          </p>
                          <p className="text-[11px] text-indigo-700">Đã lưu ảnh làm bằng chứng giao nhận</p>
                        </div>
                      </div>
                    )}
                    {(order.deliveryNote || order.note || order.location.deliveryNote) && (
                      <div className="flex items-start gap-1.5 text-xs text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200/70">
                        <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-[10px] text-amber-700 uppercase block">Ghi chú giao hàng:</span>
                          <p className="font-semibold whitespace-pre-wrap">
                            {order.deliveryNote || order.note || order.location.deliveryNote}
                          </p>
                        </div>
                      </div>
                    )}
                    {order.internalNote && (
                      <div className="flex items-start gap-1.5 text-xs text-purple-900 bg-purple-50 p-2 rounded-xl border border-purple-200/70">
                        <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                        <span>
                          Ghi chú nội bộ: <strong>{order.internalNote}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Audit & Staff Info footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    {order.deliveredBy && (
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <Truck className="w-3 h-3" />
                        Giao: <strong>{order.deliveredBy}</strong>
                        {order.deliveryTime && (
                          <span className="text-slate-400 font-normal">
                            ({new Date(order.deliveryTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                      </span>
                    )}

                    {order.paidConfirmedBy && (
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <UserCheck className="w-3 h-3" />
                        Thu bởi: <strong>{order.paidConfirmedBy}</strong>{' '}
                        ({order.paymentMethod === 'CASH' ? 'Tiền mặt' : 'CK'})
                      </span>
                    )}
                  </div>

                  {/* Actions: Copy / Deliver / Pay */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => handleCopyOrder(order)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition flex items-center gap-1"
                      title="Sao chép chi tiết đơn hàng"
                    >
                      {copiedId === order.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span className="text-[11px] font-semibold">
                        {copiedId === order.id ? 'Đã chép' : 'Sao chép'}
                      </span>
                    </button>

                    {/* Quick Ready for delivery button if still pending */}
                    {!isDelivered && order.deliveryStatus !== 'READY_FOR_DELIVERY' && (
                      <button
                        onClick={() => markReadyForDelivery(order.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
                        title="Đánh dấu sẵn sàng giao (bật chuông & thông báo)"
                      >
                        <Rocket className="w-3 h-3 text-emerald-200" />
                        <span>Sẵn sàng</span>
                      </button>
                    )}

                    {/* Quick Deliver button if PENDING or READY_FOR_DELIVERY */}
                    {!isDelivered && (
                      <button
                        onClick={() => handleConfirmDeliver(order)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
                      >
                        <CheckCircle2 className="w-3 h-3 text-blue-200" />
                        <span>Giao xong</span>
                      </button>
                    )}

                    {/* Quick Pay button if UNPAID */}
                    {!isPaid && (
                      <button
                        onClick={() => setPayModalOrder(order)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
                      >
                        <Banknote className="w-3 h-3" />
                        <span>Thu tiền</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* QUICK PAYMENT MODAL */}
      {payModalOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">Xác nhận thu tiền</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{payModalOrder.id}</p>
                </div>
              </div>
              <button
                onClick={() => setPayModalOrder(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl text-center space-y-1">
              <span className="text-xs text-slate-500 font-medium">Số tiền cần thu</span>
              <p className="text-2xl font-black text-slate-900 font-mono">
                {formatVND(payModalOrder.totalAmount)}
              </p>
              <p className="text-xs font-bold text-slate-600 truncate">
                Khách: {payModalOrder.customerName} ({payModalOrder.location.formattedAddress})
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handlePay('CASH')}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Banknote className="w-4 h-4 text-emerald-200" />
                <span>Thu TIỀN MẶT ({formatVND(payModalOrder.totalAmount)})</span>
              </button>

              <button
                onClick={() => handlePay('BANK_TRANSFER')}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Landmark className="w-4 h-4 text-blue-200" />
                <span>Đã CHUYỂN KHOẢN ({formatVND(payModalOrder.totalAmount)})</span>
              </button>
            </div>

            <button
              onClick={() => setPayModalOrder(null)}
              className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      )}

      {/* PDF / Print / CSV Export Modal */}
      <ExportOrderReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        orders={filteredOrders}
        title="Danh sách Đơn hàng"
        periodLabel={
          datePreset === 'TODAY'
            ? 'Hôm nay'
            : datePreset === 'YESTERDAY'
            ? 'Hôm qua'
            : datePreset === 'THIS_MONTH'
            ? 'Tháng này'
            : datePreset === 'DATE_RANGE' && (startDate || endDate)
            ? `${startDate || '...'} đến ${endDate || '...'}`
            : 'Tất cả đơn hàng'
        }
        defaultDocType="ACCOUNTING_REPORT"
        currentUser={currentUser}
      />
    </div>
  );
};
