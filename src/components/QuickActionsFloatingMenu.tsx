import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { Order, DeliveryStatus } from '../types';
import { DeliveryReceiptScannerModal } from './DeliveryReceiptScannerModal';
import { QuickCreateOrderModal } from './QuickCreateOrderModal';
import { OrderDetailModal } from './OrderDetailModal';
import {
  Zap,
  X,
  Camera,
  PlusCircle,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Search,
  Building2,
  Sparkles,
  Check,
  CheckCheck,
  AlertCircle,
  RotateCcw,
  Plus,
  Coins,
  ArrowRight,
  Filter,
} from 'lucide-react';

export const QuickActionsFloatingMenu: React.FC = () => {
  const {
    setCurrentScreen,
    orders,
    markOutForDelivery,
    markDelivered,
    markMultipleDelivered,
    updateDeliveryStatus,
    markPaid,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showQuickOrderModal, setShowQuickOrderModal] = useState(false);
  const [scannedReceiptForOrder, setScannedReceiptForOrder] = useState<string | null>(null);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);

  // Quick Action Panel State
  const [activeTab, setActiveTab] = useState<'ACTION_NEEDED' | 'PENDING' | 'OUT_FOR_DELIVERY' | 'RECENT_DELIVERED'>('ACTION_NEEDED');
  const [quickSearch, setQuickSearch] = useState('');
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Clear notice after 3 seconds
  useEffect(() => {
    if (actionSuccessNotice) {
      const timer = setTimeout(() => setActionSuccessNotice(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccessNotice]);

  // Orders pool
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === 'ACTIVE'),
    [orders]
  );

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

  // Orders that need immediate action (PENDING or OUT_FOR_DELIVERY)
  const actionNeededOrders = useMemo(() => {
    return activeOrders
      .filter((o) => o.deliveryStatus !== 'DELIVERED')
      .sort((a, b) => {
        // High priority first
        if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
        if (b.priority === 'HIGH' && a.priority !== 'HIGH') return 1;
        // OUT_FOR_DELIVERY before PENDING so active deliveries stay on top
        if (a.deliveryStatus === 'OUT_FOR_DELIVERY' && b.deliveryStatus === 'PENDING') return -1;
        if (b.deliveryStatus === 'OUT_FOR_DELIVERY' && a.deliveryStatus === 'PENDING') return 1;
        // Newest created first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [activeOrders]);

  // Filtered orders based on selected tab and search query
  const displayedOrders = useMemo(() => {
    let list: Order[] = [];
    if (activeTab === 'ACTION_NEEDED') {
      list = actionNeededOrders;
    } else if (activeTab === 'PENDING') {
      list = pendingOrders;
    } else if (activeTab === 'OUT_FOR_DELIVERY') {
      list = outForDeliveryOrders;
    } else if (activeTab === 'RECENT_DELIVERED') {
      list = deliveredOrders.slice(-10).reverse();
    }

    if (quickSearch.trim()) {
      const q = quickSearch.toLowerCase().trim();
      list = list.filter((o) => {
        const nameMatch = o.customerName.toLowerCase().includes(q);
        const phoneMatch = (o.customerPhone || '').includes(q);
        const idMatch = o.id.toLowerCase().includes(q);
        const addrMatch = o.location.formattedAddress.toLowerCase().includes(q);
        const condoMatch = (o.location.condoName || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || idMatch || addrMatch || condoMatch;
      });
    }

    return list;
  }, [activeTab, actionNeededOrders, pendingOrders, outForDeliveryOrders, deliveredOrders, quickSearch]);

  const totalActionNeeded = actionNeededOrders.length;

  // One-Tap Action Handlers
  const handleOneTapOutForDelivery = (order: Order) => {
    markOutForDelivery(order.id);
    setActionSuccessNotice(`🚚 [${order.id}] ${order.customerName}: Đang xuất phát giao hàng!`);
  };

  const handleOneTapDelivered = (order: Order) => {
    markDelivered(order.id);
    setActionSuccessNotice(`✅ [${order.id}] ${order.customerName}: Đã giao hàng thành công!`);
  };

  const handleOneTapRevertToPending = (order: Order) => {
    updateDeliveryStatus(order.id, 'PENDING');
    setActionSuccessNotice(`↩️ [${order.id}] Đã hoàn về trạng thái Chờ giao.`);
  };

  const handleBatchMarkAllOutForDelivery = () => {
    if (pendingOrders.length === 0) return;
    pendingOrders.forEach((o) => markOutForDelivery(o.id));
    setActionSuccessNotice(`🚀 Đã chuyển tất cả ${pendingOrders.length} đơn sang Đang đi giao!`);
  };

  const handleBatchMarkAllDelivered = () => {
    if (outForDeliveryOrders.length === 0) return;
    const ids = outForDeliveryOrders.map((o) => o.id);
    markMultipleDelivered(ids);
    setActionSuccessNotice(`🎉 Đã đánh dấu hoàn tất giao ${ids.length} đơn hàng!`);
  };

  const handleOpenQuickCreate = () => {
    setIsOpen(false);
    setScannedReceiptForOrder(null);
    setShowQuickOrderModal(true);
  };

  const handleOpenScanner = () => {
    setIsOpen(false);
    setShowScannerModal(true);
  };

  const handleCreateWithScannedReceipt = (receiptDataUrl: string) => {
    setShowScannerModal(false);
    setScannedReceiptForOrder(receiptDataUrl);
    setShowQuickOrderModal(true);
  };

  return (
    <>
      {/* Backdrop Scrim when menu is expanded */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
        />
      )}

      {/* QUICK ACTIONS EXPANDED FLOATING MODAL / BOTTOM SHEET */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 sm:bottom-24 sm:right-6 sm:inset-x-auto sm:w-[480px] z-50 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[82vh] animate-in slide-in-from-bottom-4 duration-250">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 p-4 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
                  <Zap className="w-5 h-5 text-amber-300 fill-amber-300 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base uppercase tracking-wide">
                      Thao tác nhanh
                    </h3>
                    <span className="text-[10px] bg-white/20 font-bold px-2 py-0.5 rounded-full">
                      Quick Actions
                    </span>
                  </div>
                  <p className="text-[11px] text-white/80 font-medium">
                    1-Tap cập nhật trạng thái đơn & điều phối tức thì
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95"
                title="Đóng menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Success Toast / Banner inside panel */}
            {actionSuccessNotice && (
              <div className="mt-3 p-2.5 bg-emerald-500/90 text-white rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 shadow-md">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                <span className="flex-1 truncate">{actionSuccessNotice}</span>
              </div>
            )}

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar pb-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('ACTION_NEEDED')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeTab === 'ACTION_NEEDED'
                    ? 'bg-white text-indigo-900 shadow-sm font-black'
                    : 'bg-white/15 text-white/90 hover:bg-white/25'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Cần xử lý ({totalActionNeeded})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('OUT_FOR_DELIVERY')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeTab === 'OUT_FOR_DELIVERY'
                    ? 'bg-white text-indigo-900 shadow-sm font-black'
                    : 'bg-white/15 text-white/90 hover:bg-white/25'
                }`}
              >
                <Truck className="w-3.5 h-3.5 text-amber-300" />
                <span>Đang đi giao ({outForDeliveryOrders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PENDING')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeTab === 'PENDING'
                    ? 'bg-white text-indigo-900 shadow-sm font-black'
                    : 'bg-white/15 text-white/90 hover:bg-white/25'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-blue-200" />
                <span>Chờ giao ({pendingOrders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('RECENT_DELIVERED')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
                  activeTab === 'RECENT_DELIVERED'
                    ? 'bg-white text-indigo-900 shadow-sm font-black'
                    : 'bg-white/15 text-white/90 hover:bg-white/25'
                }`}
              >
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Đã giao ({deliveredOrders.length})</span>
              </button>
            </div>
          </div>

          {/* Search bar & Batch Action Controls */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm nhanh theo tên, số ĐT, căn hộ (e.g. Tuấn, B-20-10)..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              {quickSearch && (
                <button
                  type="button"
                  onClick={() => setQuickSearch('')}
                  className="absolute right-2 top-2 p-0.5 rounded-full bg-slate-200 text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Batch One-Tap Action Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5">
              {pendingOrders.length > 0 && (
                <button
                  type="button"
                  onClick={handleBatchMarkAllOutForDelivery}
                  className="text-[11px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 active:scale-95 shadow-2xs"
                >
                  <Truck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Xuất phát tất cả ({pendingOrders.length})</span>
                </button>
              )}

              {outForDeliveryOrders.length > 0 && (
                <button
                  type="button"
                  onClick={handleBatchMarkAllDelivered}
                  className="text-[11px] font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 active:scale-95 shadow-2xs"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Giao xong tất cả ({outForDeliveryOrders.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setCurrentScreen('DELIVERY');
                }}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 shrink-0 ml-auto"
              >
                <span>Chế độ đi giao</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Frequently Managed Orders Scrollable List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[180px] max-h-[50vh]">
            {displayedOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-xs font-bold text-slate-600">
                  {quickSearch
                    ? 'Không tìm thấy đơn hàng phù hợp'
                    : activeTab === 'ACTION_NEEDED'
                    ? 'Tuyệt vời! Hiện không còn đơn nào chờ giao hoặc đang đi giao.'
                    : 'Không có đơn hàng nào trong mục này.'}
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenQuickCreate}
                    className="text-xs font-bold bg-indigo-600 text-white px-3.5 py-2 rounded-xl shadow-sm hover:bg-indigo-700 transition"
                  >
                    + Tạo đơn hàng mới
                  </button>
                </div>
              </div>
            ) : (
              displayedOrders.map((order) => {
                const isCondo = order.location.type === 'condo';
                const isPending = order.deliveryStatus === 'PENDING';
                const isOutForDelivery =
                  order.deliveryStatus === 'OUT_FOR_DELIVERY' ||
                  order.deliveryStatus === 'READY_FOR_DELIVERY';
                const isDelivered = order.deliveryStatus === 'DELIVERED';
                const isHighPriority = order.priority === 'HIGH';

                return (
                  <div
                    key={order.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isHighPriority
                        ? 'bg-rose-50/40 border-rose-200 shadow-xs'
                        : isOutForDelivery
                        ? 'bg-blue-50/40 border-blue-200 shadow-xs'
                        : isDelivered
                        ? 'bg-emerald-50/20 border-emerald-200'
                        : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Customer info, Order ID, and amount */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForDetail(order)}
                            className="font-black text-xs text-slate-900 hover:text-indigo-600 truncate transition text-left"
                            title="Xem chi tiết đơn hàng"
                          >
                            {order.customerName}
                          </button>
                          <span className="text-[10px] font-mono text-slate-400">
                            #{order.id}
                          </span>
                          {isHighPriority && (
                            <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-full border border-rose-200 animate-pulse">
                              GẤP
                            </span>
                          )}
                          {order.paymentStatus === 'UNPAID' && (
                            <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                              Chưa thu tiền
                            </span>
                          )}
                        </div>

                        {/* Location address */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                          {isCondo ? (
                            <div className="flex items-center gap-1 text-indigo-700 font-bold truncate">
                              <Building2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="bg-indigo-100/80 px-1.5 py-0.2 rounded font-mono text-[11px]">
                                {order.location.formattedAddress}
                              </span>
                              <span className="text-slate-500 font-normal truncate text-[11px]">
                                ({order.location.condoName || 'Sunrise City'})
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-slate-700 truncate text-[11px]">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{order.location.formattedAddress}</span>
                            </div>
                          )}
                        </div>

                        {/* Items preview */}
                        <p className="text-[10px] text-slate-500 truncate mt-1">
                          {order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                        </p>
                      </div>

                      {/* Total Amount & Phone Quick Dial */}
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-slate-900 font-mono">
                          {formatVND(order.totalAmount)}
                        </p>
                        {order.customerPhone && (
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-lg mt-1 border border-emerald-200"
                            title={`Gọi điện: ${order.customerPhone}`}
                          >
                            <Phone className="w-2.5 h-2.5" />
                            <span>Gọi</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Delivery Note if any */}
                    {order.deliveryNote && (
                      <p className="text-[10px] text-amber-800 bg-amber-50/80 p-1.5 rounded-lg mt-1.5 border border-amber-200/60 truncate">
                        📝 {order.deliveryNote}
                      </p>
                    )}

                    {/* ONE-TAP STATUS UPDATE ACTIONS ROW */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      {/* Current Status Pill */}
                      <div className="flex items-center gap-1">
                        {isPending && (
                          <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Chờ giao</span>
                          </span>
                        )}
                        {isOutForDelivery && (
                          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Truck className="w-3 h-3 text-blue-600" />
                            <span>Đang đi giao</span>
                          </span>
                        )}
                        {isDelivered && (
                          <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Đã giao xong</span>
                          </span>
                        )}
                      </div>

                      {/* One-Tap Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {/* If PENDING: Primary is "Mark as Out for Delivery" (1 tap) */}
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOneTapOutForDelivery(order)}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition active:scale-95"
                              title="1-tap: Chuyển sang Đang đi giao"
                            >
                              <Truck className="w-3.5 h-3.5 text-white" />
                              <span>Xuất phát giao</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOneTapDelivered(order)}
                              className="p-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition active:scale-95"
                              title="1-tap: Đánh dấu Đã giao luôn"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* If OUT_FOR_DELIVERY: Primary is "Mark as Delivered" (1 tap) */}
                        {isOutForDelivery && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOneTapDelivered(order)}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition active:scale-95 animate-pulse"
                              title="1-tap: Đánh dấu đã giao thành công"
                            >
                              <CheckCircle2 className="w-4 h-4 text-white" />
                              <span>Đã giao xong (Delivered)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOneTapRevertToPending(order)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                              title="Hoàn về Chờ giao"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* If DELIVERED: Option to undo or collect payment */}
                        {isDelivered && (
                          <div className="flex items-center gap-1.5">
                            {order.paymentStatus === 'UNPAID' && (
                              <button
                                type="button"
                                onClick={() => {
                                  markPaid(order.id, 'CASH');
                                  setActionSuccessNotice(`💵 Đã thu tiền đơn ${order.id}`);
                                }}
                                className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center gap-1"
                              >
                                <Coins className="w-3 h-3 text-amber-600" />
                                <span>Thu tiền</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOneTapRevertToPending(order)}
                              className="text-[10px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition"
                              title="Hủy trạng thái đã giao"
                            >
                              Đổi lại
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Fast Shortcuts Bar */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 grid grid-cols-3 gap-2 shrink-0">
            {/* Quick 30s Order */}
            <button
              type="button"
              onClick={handleOpenQuickCreate}
              className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>Tạo đơn 30s</span>
            </button>

            {/* Camera Receipt Scanner */}
            <button
              type="button"
              onClick={handleOpenScanner}
              className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Quét phiếu</span>
            </button>

            {/* Delivery Mode Screen */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setCurrentScreen('DELIVERY');
              }}
              className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Chế độ giao</span>
            </button>
          </div>
        </div>
      )}

      {/* PRIMARY FLOATING ACTION BUTTON (FAB) ON HOMESCREEN */}
      <div className="fixed bottom-20 right-4 sm:right-6 sm:bottom-22 z-40 flex flex-col items-end gap-2.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className={`group flex items-center gap-2.5 px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider text-white shadow-2xl transition-all duration-200 active:scale-95 border border-white/20 ${
            isOpen
              ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/50'
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 shadow-indigo-600/40 ring-2 ring-white/30'
          }`}
          title="Mở Thao tác nhanh: 1-Tap cập nhật trạng thái đơn hàng"
        >
          <div className="relative">
            {isOpen ? (
              <X className="w-5 h-5 text-white transition-transform duration-200" />
            ) : (
              <Zap className="w-5 h-5 text-amber-300 fill-amber-300 animate-pulse" />
            )}
          </div>
          <span className="font-extrabold whitespace-nowrap">
            {isOpen ? 'Đóng' : 'Thao tác nhanh'}
          </span>

          {/* Badge count of orders needing status updates */}
          {!isOpen && totalActionNeeded > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse shadow-xs">
              {totalActionNeeded}
            </span>
          )}

          {!isOpen && totalActionNeeded === 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
          )}
        </button>
      </div>

      {/* Camera Receipt Scanner Modal */}
      <DeliveryReceiptScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onOpenQuickCreateWithReceipt={handleCreateWithScannedReceipt}
      />

      {/* Quick Create Order Modal */}
      <QuickCreateOrderModal
        isOpen={showQuickOrderModal}
        onClose={() => setShowQuickOrderModal(false)}
        initialReceiptImage={scannedReceiptForOrder}
      />

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrderForDetail}
        isOpen={Boolean(selectedOrderForDetail)}
        onClose={() => setSelectedOrderForDetail(null)}
      />
    </>
  );
};
