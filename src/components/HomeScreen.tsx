import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { QuickActionsFloatingMenu } from './QuickActionsFloatingMenu';
import { OrderDetailModal } from './OrderDetailModal';
import { ExportOrderReportModal } from './ExportOrderReportModal';
import { PrintManifestModal } from './PrintManifestModal';
import { Order, getOrderTagColor } from '../types';
import { getOrderDeliveryDueStatus } from '../utils/notificationScheduler';
import {
  PlusCircle,
  Truck,
  AlertCircle,
  Boxes,
  BarChart3,
  CheckCircle2,
  Building2,
  ArrowRight,
  TrendingUp,
  Search,
  History,
  Users,
  X,
  Tag,
  Clock,
  Phone,
  MapPin,
  FileText,
  AlertTriangle,
  Package,
  Check,
  ChevronRight,
  Filter,
  FileDown,
  Printer,
  Repeat,
  Calendar,
  Plus,
} from 'lucide-react';

export const HomeScreen: React.FC = () => {
  const {
    setCurrentScreen,
    orders,
    products,
    customers,
    markOutForDelivery,
    markDelivered,
    triggerRecurringOrderInstance,
    toggleRecurringSchedule,
    schedulerConfig,
  } = useApp();

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Global Search & Order Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<
    'ALL' | 'PENDING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'UNPAID' | 'RECURRING'
  >('ALL');

  // Selected Order for Detail Modal
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isManifestModalOpen, setIsManifestModalOpen] = useState(false);

  const activeOrders = useMemo(() => orders.filter((o) => o.status === 'ACTIVE'), [orders]);
  const pendingOrders = useMemo(
    () => activeOrders.filter((o) => o.deliveryStatus === 'PENDING'),
    [activeOrders]
  );
  const outForDeliveryOrders = useMemo(
    () =>
      activeOrders.filter(
        (o) => o.deliveryStatus === 'OUT_FOR_DELIVERY' || o.deliveryStatus === 'READY_FOR_DELIVERY'
      ),
    [activeOrders]
  );
  const deliveredOrders = useMemo(
    () => activeOrders.filter((o) => o.deliveryStatus === 'DELIVERED'),
    [activeOrders]
  );
  const unpaidOrders = useMemo(
    () => activeOrders.filter((o) => o.paymentStatus === 'UNPAID'),
    [activeOrders]
  );

  // Recurring Orders calculation
  const recurringOrders = useMemo(
    () => activeOrders.filter((o) => o.isRecurring),
    [activeOrders]
  );
  const dueRecurringOrders = useMemo(
    () =>
      recurringOrders.filter(
        (o) => o.recurringActive !== false && o.nextRecurringDate && o.nextRecurringDate <= todayStr
      ),
    [recurringOrders, todayStr]
  );

  const pendingDeliveries = activeOrders.filter((o) => o.deliveryStatus !== 'DELIVERED');
  const highPriorityDeliveries = pendingDeliveries.filter((o) => o.priority === 'HIGH');

  const totalSales = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalUnpaidAmount = unpaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalStockCount = products.reduce((sum, p) => sum + Math.max(0, p.currentStock), 0);

  // Global Search by Customer Name or Order ID + Filter Tabs
  const filteredOrders = useMemo(() => {
    let list = activeOrders;

    // Filter tab
    if (selectedStatusTab === 'PENDING') {
      list = pendingOrders;
    } else if (selectedStatusTab === 'OUT_FOR_DELIVERY') {
      list = outForDeliveryOrders;
    } else if (selectedStatusTab === 'DELIVERED') {
      list = deliveredOrders;
    } else if (selectedStatusTab === 'UNPAID') {
      list = unpaidOrders;
    } else if (selectedStatusTab === 'RECURRING') {
      list = recurringOrders;
    }

    // Global Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.customerName.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          (o.customerPhone && o.customerPhone.includes(q)) ||
          o.location.formattedAddress.toLowerCase().includes(q) ||
          (o.isRecurring && 'định kỳ recurring'.includes(q))
      );
    }

    return list;
  }, [
    activeOrders,
    selectedStatusTab,
    searchQuery,
    pendingOrders,
    outForDeliveryOrders,
    deliveredOrders,
    unpaidOrders,
    recurringOrders,
  ]);

  return (
    <div className="space-y-4 pb-20">
      {/* Quick Summary Glance Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tổng quan hôm nay (Today's Pulse)</span>
          </div>
          <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
            {activeOrders.length} đơn hàng
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
            <p className="text-[10px] text-slate-500 font-medium">Doanh số (Sales)</p>
            <p className="text-xs sm:text-sm font-extrabold text-slate-900 mt-0.5 truncate">
              {formatVND(totalSales)}
            </p>
          </div>
          <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100">
            <p className="text-[10px] text-amber-700 font-medium">Chưa thu (Unpaid)</p>
            <p className="text-xs sm:text-sm font-extrabold text-amber-800 mt-0.5 truncate">
              {formatVND(totalUnpaidAmount)}
            </p>
          </div>
          <div
            onClick={() => setIsManifestModalOpen(true)}
            className="bg-blue-50 hover:bg-blue-100/80 cursor-pointer rounded-xl p-2.5 border border-blue-100 transition group active:scale-98"
            title="Nhấn để mở và in Bảng Kê Giao Hàng (Print Manifest)"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-blue-700 font-medium">Chờ giao (Pending)</p>
              <Printer className="w-3 h-3 text-blue-500 group-hover:text-blue-700 transition" />
            </div>
            <p className="text-xs sm:text-sm font-extrabold text-blue-800 mt-0.5">
              {pendingDeliveries.length} đơn
            </p>
            <div className="flex items-center justify-center gap-1 flex-wrap mt-0.5">
              {highPriorityDeliveries.length > 0 && (
                <span className="text-[9px] font-black text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded-full inline-block">
                  🔥 {highPriorityDeliveries.length} gấp
                </span>
              )}
              {outForDeliveryOrders.length > 0 && (
                <span className="text-[9px] font-black text-blue-800 bg-blue-100 px-1.5 py-0.2 rounded-full inline-block animate-pulse">
                  🚚 {outForDeliveryOrders.length} đang giao
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RECURRING ORDERS DUE TODAY BANNER */}
      {dueRecurringOrders.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 text-white rounded-2xl p-3.5 shadow-md border border-purple-500/30 space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/30 border border-purple-400/40 flex items-center justify-center">
                <Repeat className="w-4 h-4 text-purple-200" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-100 flex items-center gap-1.5">
                  <span>Có {dueRecurringOrders.length} đơn định kỳ đến hạn giao hôm nay!</span>
                  <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                    Đến kỳ
                  </span>
                </h4>
                <p className="text-[10px] text-purple-300">
                  Lịch giao lặp lại hàng tuần / hàng tháng cho khách quen
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedStatusTab('RECURRING')}
              className="text-[11px] font-bold text-purple-200 hover:text-white bg-purple-800/80 hover:bg-purple-700 px-2.5 py-1 rounded-lg border border-purple-600 transition"
            >
              Xem tất cả ({recurringOrders.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {dueRecurringOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white/10 hover:bg-white/15 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 flex items-center justify-between gap-2 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xs text-white truncate">{ord.customerName}</span>
                    <span className="text-[9px] font-bold bg-purple-400/30 text-purple-200 px-1.5 rounded">
                      {ord.recurringFrequency === 'DAILY'
                        ? 'Hằng ngày'
                        : ord.recurringFrequency === 'WEEKLY'
                        ? 'Hằng tuần'
                        : ord.recurringFrequency === 'BIWEEKLY'
                        ? '2 tuần/lần'
                        : 'Hằng tháng'}
                    </span>
                  </div>
                  <p className="text-[10px] text-purple-200 truncate mt-0.5">
                    {ord.location.formattedAddress} • {formatVND(ord.totalAmount)}
                  </p>
                </div>
                <button
                  onClick={() => triggerRecurringOrderInstance(ord.id)}
                  className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-xs transition active:scale-95 shrink-0 flex items-center gap-1"
                  title="Tạo đơn hàng ngay cho kỳ hôm nay"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>Giao ngay</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GLOBAL SEARCH BAR - SEARCH ORDERS BY CUSTOMER NAME OR ORDER ID */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 space-y-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm kiếm đơn hàng theo tên khách hàng hoặc mã đơn (ORD-...)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-800 placeholder:text-slate-400 transition"
          />
          <Search className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 p-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 transition"
              title="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {searchQuery && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>
              Kết quả tìm kiếm cho <strong className="text-emerald-700">"{searchQuery}"</strong>:
            </span>
            <span className="font-bold text-slate-800">{filteredOrders.length} đơn khớp</span>
          </div>
        )}
      </div>

      {/* ORDER CARDS SECTION (STATUS TRACKING & COLORED TAG PILLS) */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                ĐƠN HÀNG & THEO DÕI GIAO NHẬN
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Quản lý trạng thái Pending → Out for Delivery → Delivered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Primary 'Print Manifest' button */}
            <button
              onClick={() => setIsManifestModalOpen(true)}
              className="text-xs font-black text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-xs"
              title="In Bảng Kê Giao Hàng (Print Manifest) cho các đơn chờ giao"
            >
              <Printer className="w-3.5 h-3.5 text-amber-800" />
              <span>In Bảng Kê ({pendingDeliveries.length})</span>
            </button>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition active:scale-95"
              title="Xuất PDF hoặc In danh sách đơn hàng"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Báo cáo</span>
            </button>
            <button
              onClick={() => setCurrentScreen('ORDER_HISTORY')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline ml-1"
            >
              <span>Lịch sử ({orders.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedStatusTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap active:scale-95 ${
              selectedStatusTab === 'ALL'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({activeOrders.length})
          </button>
          <button
            onClick={() => setSelectedStatusTab('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap active:scale-95 ${
              selectedStatusTab === 'PENDING'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/70'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Chờ xử lý ({pendingOrders.length})</span>
          </button>
          <button
            onClick={() => setSelectedStatusTab('OUT_FOR_DELIVERY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap active:scale-95 ${
              selectedStatusTab === 'OUT_FOR_DELIVERY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/70'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Đang giao ({outForDeliveryOrders.length})</span>
          </button>
          <button
            onClick={() => setSelectedStatusTab('DELIVERED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap active:scale-95 ${
              selectedStatusTab === 'DELIVERED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/70'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Đã giao ({deliveredOrders.length})</span>
          </button>
          <button
            onClick={() => setSelectedStatusTab('UNPAID')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap active:scale-95 ${
              selectedStatusTab === 'UNPAID'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/70'
            }`}
          >
            <span>⚠️ Chưa thu ({unpaidOrders.length})</span>
          </button>
          <button
            onClick={() => setSelectedStatusTab('RECURRING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap active:scale-95 ${
              selectedStatusTab === 'RECURRING'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/70'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Định kỳ ({recurringOrders.length})</span>
            {dueRecurringOrders.length > 0 && (
              <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                {dueRecurringOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Pending Orders Manifest Quick Banner */}
        {selectedStatusTab === 'PENDING' && pendingOrders.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black text-amber-950">
                  Có {pendingOrders.length} đơn hàng đang chờ xử lý & xuất kho
                </p>
                <p className="text-[10px] text-amber-800">
                  In bảng kê lộ trình để giao hàng chuẩn xác và thu đúng số tiền COD
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsManifestModalOpen(true)}
              className="text-xs font-black text-white bg-amber-600 hover:bg-amber-700 active:scale-95 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition ml-auto"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Bảng Kê Manifest</span>
            </button>
          </div>
        )}

        {/* Order Cards List */}
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-200 space-y-1.5">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                {searchQuery
                  ? `Không tìm thấy đơn hàng nào khớp với "${searchQuery}"`
                  : 'Không có đơn hàng nào trong mục này.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-emerald-700 font-bold hover:underline"
                >
                  Xóa từ khóa tìm kiếm
                </button>
              )}
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isPaid = order.paymentStatus === 'PAID';
              const isDelivered = order.deliveryStatus === 'DELIVERED';
              const isOut =
                order.deliveryStatus === 'OUT_FOR_DELIVERY' ||
                order.deliveryStatus === 'READY_FOR_DELIVERY';
              const noteText =
                order.deliveryNote || order.note || order.location?.deliveryNote;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs hover:border-emerald-300 transition-all space-y-2.5"
                >
                  {/* Top Header: Order ID, Timestamp & Status Tracking Badge */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        {order.id}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(order.createdAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Delivery Status Tracking Badge */}
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                          isDelivered
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isOut
                            ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {isDelivered ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Đã giao (Delivered)</span>
                          </>
                        ) : isOut ? (
                          <>
                            <Truck className="w-3 h-3 text-blue-600" />
                            <span>Đang giao (Out for Delivery)</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Chờ xử lý (Pending)</span>
                          </>
                        )}
                      </span>

                      {/* Live Due Status Countdown for Out for Delivery */}
                      {isOut && (() => {
                        const dueStatus = getOrderDeliveryDueStatus(
                          order,
                          schedulerConfig.outForDeliveryReminderMinutes
                        );
                        if (!dueStatus) return null;
                        return (
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border shadow-2xs ${
                              dueStatus.isOverdue
                                ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                : dueStatus.isDue
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}
                            title={`Thời gian giao dự kiến: ${schedulerConfig.outForDeliveryReminderMinutes} phút (Lập lịch nhắc nhở)`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>{dueStatus.formattedText}</span>
                          </span>
                        );
                      })()}

                      {/* Payment Status Pill */}
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isPaid ? '✓ Đã thu' : '⚠️ Chưa thu'}
                      </span>
                    </div>
                  </div>

                  {/* Customer, Address & Priority */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm">
                          {order.customerName}
                        </span>
                        {order.customerPhone && (
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="text-[11px] text-blue-600 font-semibold flex items-center gap-0.5 hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{order.customerPhone}</span>
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-black text-white text-xs bg-blue-600 px-2.5 py-0.5 rounded-lg shadow-xs">
                          {order.location.formattedAddress}
                        </span>
                        {order.location.condoName && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            {order.location.condoName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-slate-900 text-base font-mono block">
                        {formatVND(order.totalAmount)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {order.items.reduce((s, i) => s + i.quantity, 0)} phần món
                      </span>
                    </div>
                  </div>

                  {/* CUSTOM TAG SYSTEM COLORED PILLS & PRIORITY */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {/* Priority Badge */}
                    {order.priority && (
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          order.priority === 'HIGH'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : order.priority === 'LOW'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
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
                      </span>
                    )}

                    {/* Custom Tag System Colored Pills (Gift, Urgent, Regular, etc.) */}
                    {order.tags && order.tags.length > 0 ? (
                      order.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs flex items-center gap-0.5 ${getOrderTagColor(
                            tag
                          )}`}
                        >
                          <Tag className="w-2.5 h-2.5 opacity-70" />
                          <span>#{tag}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                        #Regular
                      </span>
                    )}

                    {/* Recurring Badge */}
                    {order.isRecurring && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs flex items-center gap-1 bg-purple-100 text-purple-800 border-purple-300">
                        <Repeat className="w-2.5 h-2.5" />
                        <span>
                          Định kỳ:{' '}
                          {order.recurringFrequency === 'DAILY'
                            ? 'Hằng ngày'
                            : order.recurringFrequency === 'WEEKLY'
                            ? 'Hằng tuần'
                            : order.recurringFrequency === 'BIWEEKLY'
                            ? '2 tuần/lần'
                            : 'Hằng tháng'}
                        </span>
                        {order.recurringActive === false && (
                          <span className="text-[8px] bg-slate-200 text-slate-600 px-1 rounded font-normal">
                            Tạm dừng
                          </span>
                        )}
                      </span>
                    )}

                    {/* Spawned from recurring parent indicator */}
                    {order.recurringParentOrderId && (
                      <span className="text-[9px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                        <Repeat className="w-2.5 h-2.5" />
                        <span>Từ lịch #{order.recurringParentOrderId}</span>
                      </span>
                    )}
                  </div>

                  {/* Items summary */}
                  <div className="bg-slate-50 rounded-xl p-2 text-xs text-slate-700">
                    <span className="text-slate-500">Món: </span>
                    <span className="font-semibold text-slate-800">
                      {order.items.map((i) => `${i.productName} x${i.quantity}`).join(', ')}
                    </span>
                  </div>

                  {/* Recurring Schedule Box */}
                  {order.isRecurring && (
                    <div className="bg-purple-50/70 rounded-xl p-2.5 text-xs border border-purple-200/80 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-purple-900">
                        <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold text-purple-700 uppercase block">
                            Lịch giao định kỳ ({order.recurringFrequency === 'DAILY' ? 'Hằng ngày' : order.recurringFrequency === 'WEEKLY' ? 'Hằng tuần' : order.recurringFrequency === 'BIWEEKLY' ? '2 tuần/lần' : 'Hằng tháng'}):
                          </span>
                          <span className="font-semibold text-slate-800">
                            Kỳ kế tiếp: {order.nextRecurringDate ? new Date(order.nextRecurringDate).toLocaleDateString('vi-VN') : 'Chưa định ngày'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleRecurringSchedule(order.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition active:scale-95 ${
                            order.recurringActive === false
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                          title="Tạm dừng hoặc Tiếp tục lịch giao này"
                        >
                          {order.recurringActive === false ? 'Tiếp tục' : 'Tạm dừng'}
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerRecurringOrderInstance(order.id)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition active:scale-95 flex items-center gap-1"
                          title="Tạo đơn hàng mới cho kỳ hôm nay"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                          <span>Tạo đơn kỳ mới</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Delivery Note if present */}
                  {noteText && (
                    <div className="flex items-start gap-2 text-xs text-amber-950 bg-amber-50/90 p-2.5 rounded-xl border border-amber-300 shadow-2xs">
                      <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-black text-amber-800 uppercase tracking-wide block">
                          Ghi chú & Hướng dẫn giao (Notes / Delivery Instructions):
                        </span>
                        <p className="font-bold text-amber-950 whitespace-pre-wrap mt-0.5">{noteText}</p>
                      </div>
                    </div>
                  )}

                  {/* Quick Card Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForDetail(order)}
                      className="text-xs font-bold text-slate-600 hover:text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition"
                    >
                      Chi tiết đơn →
                    </button>

                    <div className="flex items-center gap-1.5">
                      {/* One-tap status tracking advance */}
                      {order.deliveryStatus === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => markOutForDelivery(order.id)}
                          className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-wide flex items-center gap-1 transition active:scale-95 shadow-xs"
                        >
                          <Truck className="w-3 h-3" />
                          <span>Giao ngay (Out for Delivery)</span>
                        </button>
                      )}

                      {(order.deliveryStatus === 'OUT_FOR_DELIVERY' ||
                        order.deliveryStatus === 'READY_FOR_DELIVERY') && (
                        <button
                          type="button"
                          onClick={() => markDelivered(order.id)}
                          className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-wide flex items-center gap-1 transition active:scale-95 shadow-xs"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Xác nhận đã giao (Delivered)</span>
                        </button>
                      )}

                      {isDelivered && (
                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Hoàn thành</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5 PRIMARY ACTIONS - LARGE TACTILE MOBILE BUTTONS */}
      <div className="space-y-3">
        {/* 1. CREATE ORDER */}
        <button
          onClick={() => setCurrentScreen('CREATE_ORDER')}
          className="w-full text-left bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] transition-all rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-emerald-700/20 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/25">
              <PlusCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-wide uppercase">TẠO ĐƠN HÀNG</span>
                <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-bold">CREATE ORDER</span>
              </div>
              <p className="text-xs text-emerald-100 mt-1 font-medium">
                Chọn món, nhập căn hộ Block-Tầng-Phòng, khách ngoài
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-1 transition-transform shrink-0" />
        </button>

        {/* 2. DELIVERIES */}
        <button
          onClick={() => setCurrentScreen('DELIVERY')}
          className="w-full text-left bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-blue-700/20 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/25">
              <Truck className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-wide uppercase">GIAO HÀNG & GOM CHUYẾN</span>
                <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-bold">DELIVERIES</span>
                {pendingDeliveries.length > 0 && (
                  <span className="bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded-full animate-pulse">
                    {pendingDeliveries.length} chờ giao
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-100 mt-1 font-medium">
                Gom nhiều đơn vào 1 chuyến • Sắp xếp tầng cao xuống thấp
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-blue-200 group-hover:translate-x-1 transition-transform shrink-0" />
        </button>

        {/* 3. UNPAID */}
        <button
          onClick={() => setCurrentScreen('UNPAID')}
          className="w-full text-left bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] transition-all rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-orange-600/20 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/25">
              <AlertCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-wide uppercase">CHƯA THU TIỀN</span>
                <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-bold">UNPAID</span>
                {unpaidOrders.length > 0 && (
                  <span className="bg-white text-orange-600 text-xs font-black px-2 py-0.5 rounded-full">
                    {unpaidOrders.length} đơn
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-100 mt-1 font-medium">
                Cần thu: {formatVND(totalUnpaidAmount)} (Thu Tiền mặt / Chuyển khoản 1 chạm)
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-100 group-hover:translate-x-1 transition-transform shrink-0" />
        </button>

        {/* 4. INVENTORY */}
        <button
          onClick={() => setCurrentScreen('INVENTORY')}
          className="w-full text-left bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 active:scale-[0.98] transition-all rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-teal-700/20 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/25">
              <Boxes className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-wide uppercase">KHO HÀNG</span>
                <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-bold">INVENTORY</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">
                  {totalStockCount} tồn
                </span>
              </div>
              <p className="text-xs text-teal-100 mt-1 font-medium">
                Tồn đầu + Nhập thêm - Đã bán = Tồn kho (Không trừ 2 lần)
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-teal-200 group-hover:translate-x-1 transition-transform shrink-0" />
        </button>

        {/* 5. REPORT */}
        <button
          onClick={() => setCurrentScreen('REPORT')}
          className="w-full text-left bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 active:scale-[0.98] transition-all rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-purple-700/20 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/25">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-wide uppercase">BÁO CÁO NGÀY</span>
                <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-bold">REPORT</span>
                <span className="text-xs bg-emerald-400 text-slate-900 px-2 py-0.5 rounded-full font-black">
                  Xuất CSV
                </span>
              </div>
              <p className="text-xs text-purple-100 mt-1 font-medium">
                Đối soát Doanh số, Kho hàng & Xuất file CSV kế toán
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-purple-200 group-hover:translate-x-1 transition-transform shrink-0" />
        </button>

        {/* 6. ORDER HISTORY */}
        <button
          onClick={() => setCurrentScreen('ORDER_HISTORY')}
          className="w-full text-left bg-gradient-to-r from-slate-800 to-indigo-900 hover:from-slate-900 hover:to-indigo-950 active:scale-[0.98] transition-all rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-indigo-900/20 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <History className="w-7 h-7 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-wide uppercase">LỊCH SỬ ĐƠN HÀNG</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">HISTORY</span>
                <span className="text-xs bg-indigo-500/80 text-white px-2 py-0.5 rounded-full font-bold">
                  {orders.length} đơn
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-medium">
                Tra cứu, tìm kiếm theo tên khách, ngày đặt, trạng thái đơn
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-indigo-300 group-hover:translate-x-1 transition-transform shrink-0" />
        </button>

        {/* 7. CUSTOMERS MANAGEMENT */}
        <button
          onClick={() => setCurrentScreen('CUSTOMERS')}
          className="w-full text-left bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 active:scale-[0.98] transition-all rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-teal-800/20 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
              <Users className="w-7 h-7 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-wide uppercase">KHÁCH HÀNG & BIỂU ĐỒ</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">CUSTOMERS</span>
                <span className="text-xs bg-white text-emerald-800 px-2 py-0.5 rounded-full font-black">
                  {customers.length} khách lưu
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-1 font-medium">
                Lịch sử mua hàng & Biểu đồ chi tiêu theo từng khách
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-1 transition-transform shrink-0" />
        </button>
      </div>

      {/* Condominium & Apartment Quick Locations Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Cấu hình Chung cư & Block</p>
            <p className="text-[11px] text-slate-500">Sunrise City, Vinhomes, Masteri... linh hoạt thêm Block</p>
          </div>
        </div>
        <button
          onClick={() => setCurrentScreen('CREATE_ORDER')}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-3 py-1.5 rounded-lg bg-emerald-100/60"
        >
          Xem vị trí →
        </button>
      </div>

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrderForDetail}
        isOpen={Boolean(selectedOrderForDetail)}
        onClose={() => setSelectedOrderForDetail(null)}
      />

      {/* PDF / Print / CSV Export Modal */}
      <ExportOrderReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        orders={filteredOrders}
        products={products}
        title="Danh sách Đơn hàng"
        periodLabel="Hôm nay"
        defaultDocType="ACCOUNTING_REPORT"
      />

      {/* Delivery Manifest Modal - Print compliant */}
      <PrintManifestModal
        isOpen={isManifestModalOpen}
        onClose={() => setIsManifestModalOpen(false)}
        orders={pendingDeliveries}
        currentUser="Quản lý điều phối"
        defaultScope="ALL_PENDING"
      />

      {/* Floating Quick Actions Menu */}
      <QuickActionsFloatingMenu />
    </div>
  );
};
