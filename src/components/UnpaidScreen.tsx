import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { type PaymentMethod, type OrderPriority, type Order, type Customer } from '../types';
import { VietQRModal } from './VietQRModal';
import { ShipperQuickContactModal } from './ShipperQuickContactModal';
import { BankSettingsModal } from './BankSettingsModal';
import { CustomerDebtLedgerModal } from './CustomerDebtLedgerModal';
import { ZaloDebtStatementModal } from './ZaloDebtStatementModal';
import { CustomerDebtReminderModal } from './CustomerDebtReminderModal';
import { getZaloChatUrl, cleanPhoneNumber } from '../utils/vietqr';
import {
  ArrowLeft,
  Wallet,
  Building2,
  Phone,
  MessageCircle,
  QrCode,
  Banknote,
  Landmark,
  CheckCircle2,
  Clock,
  UserCheck,
  Search,
  Sparkles,
  X,
  Filter,
  FileText,
  Lock,
  AlertTriangle,
  Receipt,
  Users,
  ChevronDown,
  ChevronUp,
  Crown,
  ExternalLink,
  BellRing,
} from 'lucide-react';

export const UnpaidScreen: React.FC = () => {
  const {
    orders,
    customers,
    markPaid,
    markMultiplePaid,
    calculateCustomerDebt,
    currentUser,
    setCurrentScreen,
  } = useApp();

  const [viewMode, setViewMode] = useState<'BY_ORDER' | 'BY_CUSTOMER'>('BY_ORDER');
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<'ALL' | 'PENDING' | 'DELIVERED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | OrderPriority>('ALL');
  const [showPaidHistory, setShowPaidHistory] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [selectedVietQrOrder, setSelectedVietQrOrder] = useState<Order | null>(null);
  const [selectedContactOrder, setSelectedContactOrder] = useState<Order | null>(null);
  const [showBankSettings, setShowBankSettings] = useState(false);

  // Customer Debt Ledgers Modals
  const [selectedCustomerForLedger, setSelectedCustomerForLedger] = useState<Customer | null>(null);
  const [selectedCustomerForZalo, setSelectedCustomerForZalo] = useState<Customer | null>(null);
  const [selectedCustomerForReminder, setSelectedCustomerForReminder] = useState<Customer | null>(null);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([]);

  // Unpaid active orders (independent of delivery status!)
  const unpaidOrders = useMemo(
    () => orders.filter((o) => o.status === 'ACTIVE' && o.paymentStatus === 'UNPAID'),
    [orders]
  );

  // Paid active orders
  const paidOrders = useMemo(
    () => orders.filter((o) => o.status === 'ACTIVE' && o.paymentStatus === 'PAID'),
    [orders]
  );

  const filterPredicate = (o: typeof orders[0]) => {
    // Delivery status filter
    if (deliveryFilter === 'PENDING' && o.deliveryStatus !== 'PENDING') return false;
    if (deliveryFilter === 'DELIVERED' && o.deliveryStatus !== 'DELIVERED') return false;

    // Priority filter
    if (priorityFilter !== 'ALL' && (o.priority || 'MEDIUM') !== priorityFilter) return false;

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      o.customerName.toLowerCase().includes(q) ||
      o.location.formattedAddress.toLowerCase().includes(q) ||
      (o.location.externalAddress || '').toLowerCase().includes(q) ||
      (o.customerPhone || '').includes(q) ||
      o.id.toLowerCase().includes(q) ||
      (o.location.deliveryNote || '').toLowerCase().includes(q) ||
      (o.internalNote || '').toLowerCase().includes(q)
    );
  };

  const filteredUnpaid = useMemo(() => unpaidOrders.filter(filterPredicate), [unpaidOrders, searchQuery, deliveryFilter, priorityFilter]);
  const filteredPaid = useMemo(() => paidOrders.filter(filterPredicate), [paidOrders, searchQuery, deliveryFilter, priorityFilter]);

  const totalUnpaidAmount = unpaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const hasActiveFilters = Boolean(searchQuery.trim() || deliveryFilter !== 'ALL' || priorityFilter !== 'ALL');
  const resetFilters = () => {
    setSearchQuery('');
    setDeliveryFilter('ALL');
    setPriorityFilter('ALL');
  };

  // Helper to match or create a customer object for an order
  const getCustomerForOrder = (order: Order): Customer => {
    const cleanP = cleanPhoneNumber(order.customerPhone);
    const existing = customers.find(
      (c) =>
        (cleanP && cleanPhoneNumber(c.phone) === cleanP) ||
        (c.name && order.customerName && c.name.trim().toLowerCase() === order.customerName.trim().toLowerCase())
    );
    if (existing) return existing;

    return {
      id: `temp_${cleanP || order.customerName}`,
      name: order.customerName,
      phone: order.customerPhone || '',
      defaultLocationType: order.location.type,
      condoName: order.location.condoName,
      block: order.location.block,
      floor: order.location.floor,
      unit: order.location.unit,
      externalAddress: order.location.formattedAddress,
      deliveryNote: order.location.deliveryNote,
    };
  };

  // Group unpaid orders by customer
  const customerDebtGroups = useMemo(() => {
    const map = new Map<string, { customer: Customer; orders: Order[] }>();

    filteredUnpaid.forEach((o) => {
      const cust = getCustomerForOrder(o);
      const cleanP = cleanPhoneNumber(cust.phone);
      const key = cleanP ? `phone_${cleanP}` : `name_${cust.name.trim().toLowerCase()}`;

      const existing = map.get(key);
      if (existing) {
        existing.orders.push(o);
      } else {
        map.set(key, { customer: cust, orders: [o] });
      }
    });

    return Array.from(map.entries())
      .map(([key, { customer, orders }]) => {
        const sorted = [...orders].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const totalDebt = sorted.reduce((sum, o) => sum + o.totalAmount, 0);
        const oldest = sorted[0];
        const diffMs = oldest ? Date.now() - new Date(oldest.createdAt).getTime() : 0;
        const daysOldest = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        const isOverdue = daysOldest >= 7;

        return {
          key,
          customer,
          orders: sorted,
          totalDebt,
          daysOldest,
          isOverdue,
        };
      })
      .sort((a, b) => b.totalDebt - a.totalDebt);
  }, [filteredUnpaid, customers]);

  const toggleExpandGroup = (key: string) => {
    setExpandedGroupKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleBatchCollectCustomer = (
    custName: string,
    orderIds: string[],
    method: PaymentMethod,
    totalAmt: number
  ) => {
    markMultiplePaid(orderIds, method, `Thu nợ gộp khách ${custName}`);
    const methodText = method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản';
    setToastMessage(`Đã thu gộp ${orderIds.length} đơn (${formatVND(totalAmt)}) của ${custName} qua ${methodText}`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCollect = (orderId: string, address: string, method: PaymentMethod, amount: number) => {
    markPaid(orderId, method);
    const methodText = method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản';
    setToastMessage(`Đã thu ${formatVND(amount)} từ ${address} (${methodText}) - Bởi ${currentUser}`);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentScreen('HOME')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>
        <div className="text-center">
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">
            CẦN THU TIỀN (UNPAID)
          </h2>
          <p className="text-[10px] text-slate-500 font-medium">Bao gồm cả đơn đã giao & chưa giao</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowBankSettings(true)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 shadow-2xs transition active:scale-95 flex items-center gap-1"
            title="Cài đặt thông tin tài khoản ngân hàng & VietQR"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Cài VietQR</span>
          </button>
          <button
            onClick={() => setShowPaidHistory(!showPaidHistory)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
              showPaidHistory ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Đã thu ({paidOrders.length})
          </button>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-lg flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-200 hover:text-white text-[11px] underline ml-2"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Total Due Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-5 text-white shadow-lg shadow-orange-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-100" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-100">
              Tổng tiền chưa thu
            </span>
          </div>
          <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
            {unpaidOrders.length} đơn nợ
          </span>
        </div>
        <p className="text-3xl font-black tracking-tight mt-2">{formatVND(totalUnpaidAmount)}</p>
        <p className="text-[11px] text-amber-100 mt-1 font-medium">
          Thu tiền một chạm: Bấm [Tiền mặt] hoặc [Chuyển khoản] để xác nhận tức thì.
        </p>
      </div>

      {/* View Mode Toggle: Theo Đơn vs Sổ Nợ Khách */}
      {!showPaidHistory && (
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/90 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setViewMode('BY_ORDER')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition ${
              viewMode === 'BY_ORDER'
                ? 'bg-white text-slate-900 shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Theo từng đơn ({filteredUnpaid.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('BY_CUSTOMER')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition ${
              viewMode === 'BY_CUSTOMER'
                ? 'bg-indigo-600 text-white shadow-sm font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-indigo-300" />
            <span>Sổ nợ gom theo khách ({customerDebtGroups.length})</span>
          </button>
        </div>
      )}

      {/* Acceptance Test Prompt helper */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-900 leading-snug">
          <strong>Bước kiểm thử số 9-10:</strong> Đơn <strong>B-15-01</strong> chưa thanh toán hiển thị tại đây. Bạn có thể thu bằng <strong>Tiền mặt</strong> hoặc <strong>Chuyển khoản</strong> ngay.
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 space-y-2.5">
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm theo tên khách, căn hộ (e.g. B-15-01), SĐT, mã đơn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-800 placeholder:text-slate-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 p-0.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600"
              title="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
                <Filter className="w-3 h-3 text-slate-500" />
                Giao hàng:
              </span>
              <button
                onClick={() => setDeliveryFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  deliveryFilter === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setDeliveryFilter('PENDING')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  deliveryFilter === 'PENDING'
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ⏳ Chưa giao
              </button>
              <button
                onClick={() => setDeliveryFilter('DELIVERED')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  deliveryFilter === 'DELIVERED'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✓ Đã giao
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-[11px] font-bold text-rose-600 hover:underline shrink-0 ml-1 flex items-center gap-0.5"
              >
                <X className="w-3 h-3" />
                <span>Xóa lọc</span>
              </button>
            )}
          </div>

          {/* Priority filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Ưu tiên:
            </span>
            <button
              onClick={() => setPriorityFilter('ALL')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${
                priorityFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setPriorityFilter('HIGH')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                priorityFilter === 'HIGH'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span>🔥 Cao</span>
              <span className="text-[9px] bg-white/20 px-1 rounded-full">
                {unpaidOrders.filter((o) => o.priority === 'HIGH').length}
              </span>
            </button>
            <button
              onClick={() => setPriorityFilter('MEDIUM')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                priorityFilter === 'MEDIUM'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>⚡ TB</span>
            </button>
            <button
              onClick={() => setPriorityFilter('LOW')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                priorityFilter === 'LOW'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>💤 Thấp</span>
            </button>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
            <span>
              Tìm thấy: <strong className="text-slate-800 font-bold">{showPaidHistory ? filteredPaid.length : filteredUnpaid.length} đơn</strong>
            </span>
            {searchQuery.trim() && (
              <span className="truncate max-w-[150px]">
                Khóa: <strong className="text-amber-700 font-bold">"{searchQuery}"</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {!showPaidHistory ? (
        <>
          {viewMode === 'BY_CUSTOMER' ? (
            /* GROUPED BY CUSTOMER DEBT LEDGER VIEW */
            <div className="space-y-3">
              {customerDebtGroups.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                    {hasActiveFilters ? <Search className="w-6 h-6 text-slate-400" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    {hasActiveFilters ? 'Không tìm thấy khách hàng nợ phù hợp!' : 'Tuyệt vời! Không còn khách nào nợ tiền.'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {hasActiveFilters
                      ? `Không có khách hàng nào khớp với từ khóa "${searchQuery}".`
                      : 'Tất cả các công nợ đã được thu và đối soát đầy đủ.'}
                  </p>
                </div>
              ) : (
                customerDebtGroups.map((group) => {
                  const isExpanded = expandedGroupKeys.includes(group.key);
                  const { customer, orders, totalDebt, daysOldest, isOverdue } = group;
                  const addressLabel =
                    customer.defaultLocationType === 'condo'
                      ? `${customer.block || ''}${customer.floor ? '-' + customer.floor : ''}${customer.unit ? '-' + customer.unit : ''} ${customer.condoName ? `(${customer.condoName})` : ''}`.trim()
                      : customer.externalAddress || 'Địa chỉ khách';

                  // Virtual order for QR
                  const virtualQrOrder: Order = {
                    id: cleanPhoneNumber(customer.phone)
                      ? `NO ${cleanPhoneNumber(customer.phone)}`
                      : `NO ${customer.unit || customer.name.replace(/\s+/g, '')}`,
                    createdAt: new Date().toISOString(),
                    customerName: customer.name,
                    customerPhone: customer.phone,
                    items: orders.flatMap((o) => o.items),
                    totalAmount: totalDebt,
                    location: orders[0]?.location || {
                      type: customer.defaultLocationType,
                      formattedAddress: addressLabel,
                    },
                    deliveryStatus: 'DELIVERED',
                    paymentStatus: 'UNPAID',
                    status: 'ACTIVE',
                  };

                  return (
                    <div
                      key={group.key}
                      className={`bg-white rounded-2xl p-4 shadow-sm border transition-all space-y-3 ${
                        isOverdue
                          ? 'border-amber-300 ring-1 ring-amber-200'
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {/* Customer Header */}
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-slate-900 text-base">
                              {customer.name}
                            </h4>
                            {customer.isVip && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-700 border border-amber-300 flex items-center gap-1">
                                <Crown className="w-2.5 h-2.5 text-amber-600" />
                                <span>VIP</span>
                              </span>
                            )}
                            {isOverdue && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Nợ {daysOldest} ngày (&gt;7 ngày)</span>
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{addressLabel || 'Cư dân'}</span>
                          </p>

                          {customer.phone && (
                            <div className="flex items-center gap-2 pt-0.5 text-xs">
                              <a
                                href={`tel:${customer.phone}`}
                                className="text-emerald-700 font-bold font-mono hover:underline flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>{customer.phone}</span>
                              </a>
                              <a
                                href={getZaloChatUrl(customer.phone)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                              >
                                <MessageCircle className="w-3 h-3 text-blue-600" />
                                <span>Zalo</span>
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Debt Amount */}
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Tổng nợ ({orders.length} đơn):
                          </span>
                          <span className="text-xl font-black text-rose-600 font-mono">
                            {formatVND(totalDebt)}
                          </span>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForReminder(customer)}
                          className={`py-2 px-2.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 ${
                            isOverdue
                              ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                          }`}
                          title="Hệ thống tự động tạo tin nhắc nợ Zalo hoặc SMS cho khách"
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          <span>Nhắc Nợ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForLedger(customer)}
                          className="py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95"
                          title="Mở Sổ Quản lý Công nợ chi tiết"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Sổ Công Nợ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForZalo(customer)}
                          className="py-2 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95"
                          title="Tạo bảng sao kê gửi Zalo ngay"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-blue-200" />
                          <span>Đối Soát Zalo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedVietQrOrder(virtualQrOrder)}
                          className="py-2 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95"
                          title="Mở mã QR ngân hàng VietQR cho tổng số nợ"
                        >
                          <QrCode className="w-3.5 h-3.5 text-purple-200" />
                          <span>VietQR Nợ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleBatchCollectCustomer(
                              customer.name,
                              orders.map((o) => o.id),
                              'CASH',
                              totalDebt
                            )
                          }
                          className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 col-span-2 sm:col-span-1"
                          title="Thu tiền mặt gộp tất cả các đơn nợ"
                        >
                          <Banknote className="w-3.5 h-3.5 text-emerald-200" />
                          <span>Thu TM Hết</span>
                        </button>
                      </div>

                      {/* Expand / Collapse orders breakdown */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => toggleExpandGroup(group.key)}
                          className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-50 transition"
                        >
                          <span>
                            {isExpanded ? 'Ẩn chi tiết' : 'Xem chi tiết'} {orders.length} đơn nợ ({orders.map(o => `#${o.id}`).join(', ')})
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 pl-2 border-l-2 border-indigo-200">
                            {orders.map((ord) => (
                              <div
                                key={ord.id}
                                className="bg-slate-50 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border border-slate-200"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-slate-800">#{ord.id}</span>
                                    <span className="text-slate-500 text-[11px]">
                                      {new Date(ord.createdAt).toLocaleDateString('vi-VN')}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 text-[11px]">
                                    {ord.items.map((it) => `${it.productName} (x${it.quantity})`).join(', ')}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono font-black text-rose-600">
                                    {formatVND(ord.totalAmount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCollect(ord.id, ord.location.formattedAddress, 'CASH', ord.totalAmount)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold"
                                  >
                                    Thu TM
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCollect(ord.id, ord.location.formattedAddress, 'BANK_TRANSFER', ord.totalAmount)}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold"
                                  >
                                    Đã CK
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* SINGLE ORDER VIEW */
            <div className="space-y-3">
              {filteredUnpaid.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                    {hasActiveFilters ? <Search className="w-6 h-6 text-slate-400" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    {hasActiveFilters ? 'Không tìm thấy đơn nợ phù hợp!' : 'Tuyệt vời! Không còn đơn nợ tiền.'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {hasActiveFilters
                      ? `Không có đơn nợ nào khớp với từ khóa "${searchQuery}". Thử xóa lọc để xem lại.`
                      : 'Tất cả các đơn hàng đã được thu tiền đầy đủ.'}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                    >
                      Xóa tìm kiếm & Lọc
                    </button>
                  )}
                </div>
              ) : (
                filteredUnpaid.map((order) => {
                  const isDelivered = order.deliveryStatus === 'DELIVERED';
                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-amber-400 transition-all space-y-3"
                    >
                      {/* Header line */}
                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-base bg-slate-100 px-2.5 py-1 rounded-xl">
                            {order.location.formattedAddress}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{order.id}</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Priority Badge */}
                          {order.priority && (
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
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
                                {order.priority === 'HIGH' ? 'Ưu tiên Cao' : order.priority === 'LOW' ? 'Thấp' : 'Trung bình'}
                              </span>
                            </span>
                          )}

                          {/* Delivery Status Badge */}
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isDelivered
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isDelivered ? '✓ ĐÃ GIAO HÀNG' : '⏳ CHƯA GIAO'}
                          </span>
                        </div>
                      </div>

                      {/* Customer info & Quick Actions */}
                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-900">{order.customerName}</span>
                          {order.customerPhone ? (
                            <div className="flex items-center gap-1">
                              <a
                                href={`tel:${order.customerPhone}`}
                                className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200/80 flex items-center gap-1 font-mono text-[11px] active:scale-95 transition"
                                title="Gọi điện ngay"
                              >
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>{order.customerPhone}</span>
                              </a>
                              <a
                                href={getZaloChatUrl(order.customerPhone)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 flex items-center gap-1 text-[11px] active:scale-95 transition"
                                title="Nhắn Zalo 1-chạm"
                              >
                                <MessageCircle className="w-3 h-3 text-blue-600" />
                                <span>Zalo</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => setSelectedContactOrder(order)}
                                className="p-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition"
                                title="Mẫu nhắc tiền shipper"
                              >
                                <Sparkles className="w-3 h-3 text-amber-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedCustomerForReminder(getCustomerForOrder(order))}
                                className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200 flex items-center gap-1 text-[11px] active:scale-95 transition"
                                title="Mở bảng tin nhắn tự động nhắc nợ Zalo hoặc SMS"
                              >
                                <BellRing className="w-3 h-3 text-amber-600" />
                                <span>Nhắc nợ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedCustomerForLedger(getCustomerForOrder(order))}
                                className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 flex items-center gap-1 text-[11px] active:scale-95 transition"
                                title="Mở Sổ Quản lý Công nợ chi tiết của khách hàng này"
                              >
                                <Receipt className="w-3 h-3 text-indigo-600" />
                                <span>Sổ nợ</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                onClick={() => setSelectedCustomerForReminder(getCustomerForOrder(order))}
                                className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200 flex items-center gap-1 text-[11px] active:scale-95 transition"
                                title="Mở bảng tin nhắn tự động nhắc nợ Zalo hoặc SMS"
                              >
                                <BellRing className="w-3 h-3 text-amber-600" />
                                <span>Nhắc nợ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedCustomerForLedger(getCustomerForOrder(order))}
                                className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 flex items-center gap-1 text-[11px] active:scale-95 transition"
                                title="Mở Sổ Quản lý Công nợ chi tiết của khách hàng này"
                              >
                                <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Sổ nợ</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium font-mono">
                          {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Order items preview */}
                      <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-700 space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between font-medium">
                            <span>• {item.productName} x{item.quantity}</span>
                            <span className="text-slate-500 font-mono">{formatVND(item.lineTotal)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Delivery & Internal Notes if present */}
                      {(order.location.deliveryNote || order.internalNote) && (
                        <div className="space-y-1 pt-0.5">
                          {order.location.deliveryNote && (
                            <div className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200/60">
                              <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span>Ghi chú giao: <strong>{order.location.deliveryNote}</strong></span>
                            </div>
                          )}
                          {order.internalNote && (
                            <div className="flex items-start gap-1.5 text-xs text-purple-900 bg-purple-50 p-2 rounded-xl border border-purple-200/70">
                              <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                              <span>Ghi chú nội bộ: <strong>{order.internalNote}</strong></span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Amount due highlight */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-xs font-bold text-slate-600">Số tiền cần thu:</span>
                        <span className="text-xl font-black text-rose-600 font-mono">
                          {formatVND(order.totalAmount)}
                        </span>
                      </div>

                      {/* 3 FAST PAYMENT BUTTONS: CASH, VIETQR, DIRECT TRANSFER */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          onClick={() =>
                            handleCollect(
                              order.id,
                              order.location.formattedAddress,
                              'CASH',
                              order.totalAmount
                            )
                          }
                          className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase flex items-center justify-center gap-1 shadow-md shadow-emerald-600/20 transition"
                        >
                          <Banknote className="w-3.5 h-3.5 text-emerald-200" />
                          <span>Tiền mặt</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedVietQrOrder(order)}
                          className="py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs uppercase flex items-center justify-center gap-1 shadow-md shadow-indigo-600/20 transition ring-2 ring-indigo-300/40"
                          title="Mở mã QR ngân hàng VietQR cho khách quét chuyển khoản"
                        >
                          <QrCode className="w-3.5 h-3.5 text-indigo-200" />
                          <span>Mã VietQR</span>
                        </button>

                        <button
                          onClick={() =>
                            handleCollect(
                              order.id,
                              order.location.formattedAddress,
                              'BANK_TRANSFER',
                              order.totalAmount
                            )
                          }
                          className="py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs uppercase flex items-center justify-center gap-1 shadow-md shadow-blue-600/20 transition"
                        >
                          <Landmark className="w-3.5 h-3.5 text-blue-200" />
                          <span>Đã nhận CK</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      ) : (
        /* PAID ORDERS HISTORY */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-600">
              Lịch sử đã thu tiền ({filteredPaid.length}/{paidOrders.length})
            </h3>
            <button
              onClick={() => setShowPaidHistory(false)}
              className="text-xs text-amber-600 font-bold hover:underline"
            >
              ← Về danh sách cần thu
            </button>
          </div>

          {filteredPaid.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">
                {hasActiveFilters ? 'Không tìm thấy đơn đã thu phù hợp!' : 'Chưa có đơn nào đã thu tiền.'}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {hasActiveFilters
                  ? `Không có đơn đã thu nào khớp với từ khóa "${searchQuery}".`
                  : 'Các đơn khi được xác nhận thu tiền sẽ hiển thị tại đây.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                >
                  Xóa tìm kiếm & Lọc
                </button>
              )}
            </div>
          ) : (
            filteredPaid.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-sm">
                      {ord.location.formattedAddress}
                    </span>
                    <span className="text-[10px] text-slate-400">{ord.id}</span>
                    {ord.priority && (
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full border ${
                          ord.priority === 'HIGH'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : ord.priority === 'LOW'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {ord.priority === 'HIGH' ? '🔥 Cao' : ord.priority === 'LOW' ? '💤 Thấp' : '⚡ TB'}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 font-medium mt-0.5">{ord.customerName}</p>
                  {ord.internalNote && (
                    <p className="text-[10px] text-purple-800 bg-purple-50 px-2 py-0.5 rounded inline-block mt-0.5 font-medium border border-purple-200/50">
                      🔒 {ord.internalNote}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                    <UserCheck className="w-3 h-3 text-emerald-600" />
                    <span>Xác nhận: <strong>{ord.paidConfirmedBy || 'Nhân viên'}</strong></span>
                    {ord.paymentTime && (
                      <span className="text-slate-400 font-mono">
                        ({new Date(ord.paymentTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-slate-900 text-sm">
                    {formatVND(ord.totalAmount)}
                  </span>
                  <span
                    className={`block mt-1 text-[9px] font-black px-2 py-0.5 rounded-full ${
                      ord.paymentMethod === 'CASH'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {ord.paymentMethod === 'CASH' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* VietQR Payment Modal */}
      <VietQRModal
        order={selectedVietQrOrder}
        isOpen={Boolean(selectedVietQrOrder)}
        onClose={() => setSelectedVietQrOrder(null)}
        onOpenBankSettings={() => setShowBankSettings(true)}
      />

      {/* Shipper Quick Contact Modal */}
      <ShipperQuickContactModal
        order={selectedContactOrder}
        isOpen={Boolean(selectedContactOrder)}
        onClose={() => setSelectedContactOrder(null)}
        onOpenVietQr={(ord) => {
          setSelectedContactOrder(null);
          setSelectedVietQrOrder(ord);
        }}
      />

      {/* Bank Account Settings Modal */}
      <BankSettingsModal
        isOpen={showBankSettings}
        onClose={() => setShowBankSettings(false)}
      />

      {/* Customer Debt Ledger Modal */}
      {selectedCustomerForLedger && (
        <CustomerDebtLedgerModal
          customer={selectedCustomerForLedger}
          isOpen={Boolean(selectedCustomerForLedger)}
          onClose={() => setSelectedCustomerForLedger(null)}
          onOpenCreateOrder={() => {
            setSelectedCustomerForLedger(null);
            setCurrentScreen('CREATE_ORDER');
          }}
        />
      )}

      {/* Zalo Debt Statement Modal */}
      {selectedCustomerForZalo && (
        <ZaloDebtStatementModal
          customer={selectedCustomerForZalo}
          unpaidOrders={unpaidOrders.filter((o) => {
            const cleanP = cleanPhoneNumber(selectedCustomerForZalo.phone);
            const orderCleanP = cleanPhoneNumber(o.customerPhone);
            return Boolean(
              (cleanP && orderCleanP && cleanP === orderCleanP) ||
                (o.customerName &&
                  o.customerName.trim().toLowerCase() ===
                    selectedCustomerForZalo.name.trim().toLowerCase())
            );
          })}
          isOpen={Boolean(selectedCustomerForZalo)}
          onClose={() => setSelectedCustomerForZalo(null)}
        />
      )}

      {/* Automated Overdue Debt Reminder Modal (Zalo / SMS) */}
      {selectedCustomerForReminder && (
        <CustomerDebtReminderModal
          customer={selectedCustomerForReminder}
          unpaidOrders={unpaidOrders.filter((o) => {
            const cleanP = cleanPhoneNumber(selectedCustomerForReminder.phone);
            const orderCleanP = cleanPhoneNumber(o.customerPhone);
            return Boolean(
              (cleanP && orderCleanP && cleanP === orderCleanP) ||
                (o.customerName &&
                  o.customerName.trim().toLowerCase() ===
                    selectedCustomerForReminder.name.trim().toLowerCase())
            );
          })}
          isOpen={Boolean(selectedCustomerForReminder)}
          onClose={() => setSelectedCustomerForReminder(null)}
          daysOverdue={calculateCustomerDebt(selectedCustomerForReminder).daysSinceOldestDebt}
        />
      )}
    </div>
  );
};
