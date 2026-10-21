import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { type Customer, type Order, type PaymentMethod } from '../types';
import { formatVND } from '../utils/storage';
import {
  cleanPhoneNumber,
  getZaloChatUrl,
  getTelUrl,
  generateCustomerDebtVietQrUrl,
} from '../utils/vietqr';
import { ZaloDebtStatementModal } from './ZaloDebtStatementModal';
import { VietQRModal } from './VietQRModal';
import { CustomerDebtReminderModal } from './CustomerDebtReminderModal';
import {
  X,
  User,
  Phone,
  Building2,
  MapPin,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Wallet,
  Clock,
  Banknote,
  Landmark,
  QrCode,
  MessageCircle,
  ShieldAlert,
  Crown,
  Edit2,
  Save,
  CheckSquare,
  Square,
  Sparkles,
  ExternalLink,
  PlusCircle,
  HelpCircle,
  Printer,
  ChevronRight,
  TrendingUp,
  BellRing,
  History,
} from 'lucide-react';

interface CustomerDebtLedgerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateOrder?: (customer: Customer) => void;
}

export const CustomerDebtLedgerModal: React.FC<CustomerDebtLedgerModalProps> = ({
  customer,
  isOpen,
  onClose,
  onOpenCreateOrder,
}) => {
  const {
    orders,
    bankConfig,
    markPaid,
    markMultiplePaid,
    updateCustomer,
    currentUser,
    roleConfig,
    calculateCustomerDebt,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'UNPAID' | 'HISTORY' | 'SETTINGS'>('UNPAID');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showZaloStatement, setShowZaloStatement] = useState(false);
  const [showVietQrModal, setShowVietQrModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Settings tab form state
  const [editLimit, setEditLimit] = useState<string>(
    customer?.debtLimit ? String(customer.debtLimit) : ''
  );
  const [editIsVip, setEditIsVip] = useState<boolean>(customer?.isVip || false);
  const [editNotes, setEditNotes] = useState<string>(customer?.notes || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state when customer changes
  React.useEffect(() => {
    if (customer) {
      setEditLimit(customer.debtLimit ? String(customer.debtLimit) : '');
      setEditIsVip(customer.isVip || false);
      setEditNotes(customer.notes || '');
      setSelectedOrderIds([]);
    }
  }, [customer]);

  if (!isOpen || !customer) return null;

  const debtSummary = calculateCustomerDebt(customer);
  const {
    unpaidOrders,
    paidOrders,
    totalDebt,
    totalSpent,
    totalOrdersCount,
    unpaidCount,
    oldestUnpaidOrder,
    daysSinceOldestDebt,
    isOverdue,
    isOverLimit,
  } = debtSummary;

  const phone = customer.phone || '';
  const cleanPhone = cleanPhoneNumber(phone);
  const zaloUrl = getZaloChatUrl(phone);
  const telUrl = getTelUrl(phone);

  const addressLabel =
    customer.defaultLocationType === 'condo'
      ? `${customer.block || ''}${customer.floor ? '-' + customer.floor : ''}${customer.unit ? '-' + customer.unit : ''} ${customer.condoName ? `(${customer.condoName})` : ''}`.trim()
      : customer.externalAddress || 'Địa chỉ đăng ký';

  // Selected orders computation
  const selectedOrders = unpaidOrders.filter((o) => selectedOrderIds.includes(o.id));
  const selectedTotalAmount = selectedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const handleSelectAll = () => {
    if (selectedOrderIds.length === unpaidOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(unpaidOrders.map((o) => o.id));
    }
  };

  const handleToggleSelect = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  // Settle single order
  const handleSettleSingle = (orderId: string, method: PaymentMethod) => {
    markPaid(orderId, method);
    const methodStr = method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản';
    setSuccessNotice(`Đã thu đơn #${orderId} (${methodStr})`);
    setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  // Batch settle selected or all
  const handleBatchSettle = (method: PaymentMethod) => {
    const targetIds = selectedOrderIds.length > 0 ? selectedOrderIds : unpaidOrders.map((o) => o.id);
    if (targetIds.length === 0) return;

    markMultiplePaid(targetIds, method, `Thu nợ gộp khách ${customer.name}`);
    const methodStr = method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản';
    setSuccessNotice(`Đã thanh toán gộp ${targetIds.length} đơn nợ (${methodStr}) thành công!`);
    setSelectedOrderIds([]);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = editLimit.trim() ? parseInt(editLimit.replace(/\D/g, ''), 10) : undefined;
    const updated: Customer = {
      ...customer,
      debtLimit: limitNum,
      isVip: editIsVip,
      notes: editNotes.trim() || undefined,
    };
    updateCustomer(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Virtual Order for VietQR modal of whole debt
  const virtualDebtOrder: Order | null = useMemo(() => {
    if (totalDebt <= 0) return null;
    const firstUnpaid = unpaidOrders[0];
    const transferMemo = cleanPhone
      ? `NO ${cleanPhone}`
      : `NO ${customer.unit || customer.name.replace(/\s+/g, '')}`;

    return {
      id: transferMemo,
      createdAt: new Date().toISOString(),
      customerName: customer.name,
      customerPhone: customer.phone,
      items: unpaidOrders.flatMap((o) => o.items),
      totalAmount: totalDebt,
      location: firstUnpaid?.location || {
        type: customer.defaultLocationType,
        formattedAddress: addressLabel,
      },
      deliveryStatus: 'DELIVERED',
      paymentStatus: 'UNPAID',
      status: 'ACTIVE',
    };
  }, [totalDebt, unpaidOrders, customer, cleanPhone, addressLabel]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn">
        <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-start justify-between shrink-0 border-b border-slate-800">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-white shrink-0 shadow-inner">
                {customer.isVip ? (
                  <Crown className="w-6 h-6 text-amber-300" />
                ) : (
                  <User className="w-6 h-6 text-indigo-200" />
                )}
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base sm:text-lg leading-tight text-white">
                    {customer.name}
                  </h3>
                  {customer.isVip && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5 text-amber-300" />
                      <span>Khách VIP</span>
                    </span>
                  )}
                  {customer.defaultLocationType === 'condo' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      Chung cư
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      Khách ngoài
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>{addressLabel || 'Chưa cập nhật địa chỉ'}</span>
                </p>

                {phone && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <a
                      href={telUrl}
                      className="text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3 text-emerald-400" />
                      <span>{phone}</span>
                    </a>
                    {zaloUrl && (
                      <a
                        href={zaloUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3 text-blue-400" />
                        <span>Zalo</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 bg-slate-50 border-b border-slate-200 text-xs shrink-0">
            {/* Total Debt */}
            <div
              className={`p-2.5 rounded-2xl border ${
                totalDebt > 0
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                Nợ hiện tại
              </span>
              <p className="text-sm sm:text-base font-black font-mono mt-0.5">
                {formatVND(totalDebt)}
              </p>
              <span className="text-[10px] font-semibold block opacity-80 mt-0.5">
                {unpaidCount > 0 ? `${unpaidCount} đơn chưa trả` : '✓ Đã thanh toán hết'}
              </span>
            </div>

            {/* Credit Limit */}
            <div className="p-2.5 rounded-2xl border bg-white border-slate-200 text-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">
                Hạn mức nợ
              </span>
              <p className="text-sm sm:text-base font-black font-mono mt-0.5">
                {customer.debtLimit ? formatVND(customer.debtLimit) : 'Không giới hạn'}
              </p>
              {customer.debtLimit && customer.debtLimit > 0 ? (
                <span
                  className={`text-[10px] font-bold block mt-0.5 ${
                    isOverLimit ? 'text-rose-600' : 'text-slate-500'
                  }`}
                >
                  {isOverLimit
                    ? `⚠️ Vượt ${(totalDebt - customer.debtLimit).toLocaleString('vi-VN')}đ`
                    : `Đã dùng ${Math.round((totalDebt / customer.debtLimit) * 100)}%`}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 block mt-0.5">Tùy ý điều chỉnh</span>
              )}
            </div>

            {/* Overdue Days & Reminder trigger */}
            <div
              className={`p-2.5 rounded-2xl border transition relative flex flex-col justify-between ${
                isOverdue
                  ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">
                    Thời gian nợ
                  </span>
                  {unpaidCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowReminderModal(true)}
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 active:scale-95 transition ${
                        isOverdue
                          ? 'bg-amber-200 text-amber-900 border-amber-300 hover:bg-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Mở bảng mẫu tin nhắn nhắc nợ Zalo/SMS"
                    >
                      <BellRing className="w-2.5 h-2.5" />
                      <span>Nhắc nợ</span>
                    </button>
                  )}
                </div>
                <p className="text-sm sm:text-base font-black font-mono mt-0.5">
                  {unpaidCount > 0 ? `${daysSinceOldestDebt} ngày` : '0 ngày'}
                </p>
              </div>

              <div className="mt-1">
                <span
                  className={`text-[10px] font-bold block ${
                    isOverdue ? 'text-amber-700 font-extrabold' : 'text-slate-400'
                  }`}
                >
                  {isOverdue ? '⏳ Nợ lâu >7 ngày' : 'Trong hạn bình thường'}
                </span>
                {customer.reminderCount && customer.reminderCount > 0 ? (
                  <span className="text-[9px] text-slate-500 block truncate">
                    Đã gửi nhắc: {customer.reminderCount} lần
                  </span>
                ) : null}
              </div>
            </div>

            {/* Total Spent / Total Orders */}
            <div className="p-2.5 rounded-2xl border bg-white border-slate-200 text-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">
                Tổng chi tiêu
              </span>
              <p className="text-sm sm:text-base font-black font-mono mt-0.5">
                {formatVND(totalSpent)}
              </p>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Đã đặt {totalOrdersCount} đơn
              </span>
            </div>
          </div>

          {/* Success Toast */}
          {successNotice && (
            <div className="mx-4 mt-3 bg-emerald-600 text-white p-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-md animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>{successNotice}</span>
              </div>
              <button onClick={() => setSuccessNotice(null)} className="text-emerald-200 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Overdue Warning Callout Banner (if >7 days overdue or over credit limit) */}
          {unpaidCount > 0 && (isOverdue || isOverLimit) && (
            <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="font-extrabold text-slate-900 leading-tight">
                    {isOverdue && isOverLimit
                      ? `Cảnh báo: Khách nợ quá hạn (${daysSinceOldestDebt} ngày) & vượt hạn mức!`
                      : isOverdue
                      ? `Đơn nợ đã quá hạn ${daysSinceOldestDebt} ngày (quy định >7 ngày)`
                      : `Công nợ hiện tại vượt hạn mức tối đa cho phép!`}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Khách có {unpaidCount} đơn chưa trả ({formatVND(totalDebt)}). Nên gửi tin nhắc Zalo/SMS để thu hồi công nợ.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowReminderModal(true)}
                className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95 transition"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-200" />
                <span>Nhắc nợ ngay</span>
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-white px-4 pt-2 text-xs font-bold shrink-0">
            <button
              onClick={() => setActiveTab('UNPAID')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeTab === 'UNPAID'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Đơn chưa thanh toán ({unpaidCount})</span>
              {totalDebt > 0 && (
                <span className="ml-1 text-[10px] bg-rose-100 text-rose-800 font-extrabold px-1.5 py-0.2 rounded-full">
                  {formatVND(totalDebt)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeTab === 'HISTORY'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Lịch sử đã trả ({paidOrders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('SETTINGS')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeTab === 'SETTINGS'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Cài đặt công nợ & Ghi chú</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
            {/* TAB 1: UNPAID ORDERS */}
            {activeTab === 'UNPAID' && (
              <div className="space-y-3">
                {unpaidOrders.length === 0 ? (
                  <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <h4 className="font-extrabold text-sm text-slate-800">
                      Khách hàng hiện không có công nợ!
                    </h4>
                    <p className="text-xs text-slate-500">
                      Tất cả các đơn hàng của {customer.name} đều đã được thanh toán đầy đủ.
                    </p>
                    {onOpenCreateOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCreateOrder(customer);
                        }}
                        className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition shadow-sm"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Tạo đơn mới cho khách</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Action ToolBar */}
                    <div className="bg-slate-100 p-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900"
                        >
                          {selectedOrderIds.length === unpaidOrders.length ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                          <span>
                            {selectedOrderIds.length > 0
                              ? `Đã chọn ${selectedOrderIds.length}/${unpaidOrders.length} đơn (${formatVND(selectedTotalAmount)})`
                              : 'Chọn tất cả đơn'}
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Automated Reminder Button */}
                        <button
                          type="button"
                          onClick={() => setShowReminderModal(true)}
                          className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95"
                          title="Hệ thống tự động tạo tin nhắc nợ Zalo hoặc SMS"
                        >
                          <BellRing className="w-3.5 h-3.5 text-amber-200" />
                          <span>Nhắc nợ Zalo/SMS</span>
                        </button>

                        {/* Zalo Statement Button */}
                        <button
                          type="button"
                          onClick={() => setShowZaloStatement(true)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95"
                          title="Tạo bảng sao kê gửi Zalo cho khách"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-blue-200" />
                          <span>Đối soát Zalo</span>
                        </button>

                        {/* VietQR Total Debt Button */}
                        <button
                          type="button"
                          onClick={() => setShowVietQrModal(true)}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95"
                          title="Mở mã VietQR tổng số tiền nợ"
                        >
                          <QrCode className="w-3.5 h-3.5 text-indigo-200" />
                          <span>VietQR Tổng Nợ</span>
                        </button>
                      </div>
                    </div>

                    {/* Batch Settlement Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleBatchSettle('CASH')}
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/20 active:scale-95 transition"
                      >
                        <Banknote className="w-4 h-4 text-emerald-200" />
                        <span>
                          {selectedOrderIds.length > 0
                            ? `Thu Tiền Mặt (${selectedOrderIds.length} đơn)`
                            : `Thu Tiền Mặt Tất Cả (${unpaidOrders.length} đơn)`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBatchSettle('BANK_TRANSFER')}
                        className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md shadow-blue-700/20 active:scale-95 transition"
                      >
                        <Landmark className="w-4 h-4 text-blue-200" />
                        <span>
                          {selectedOrderIds.length > 0
                            ? `Đã Nhận CK (${selectedOrderIds.length} đơn)`
                            : `Đã Nhận CK Tất Cả (${unpaidOrders.length} đơn)`}
                        </span>
                      </button>
                    </div>

                    {/* Unpaid Orders List */}
                    <div className="space-y-2">
                      {unpaidOrders.map((ord) => {
                        const isSelected = selectedOrderIds.includes(ord.id);
                        const orderDate = new Date(ord.createdAt);
                        const daysAgo = Math.floor(
                          (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
                        );

                        return (
                          <div
                            key={ord.id}
                            className={`p-3 rounded-2xl border transition ${
                              isSelected
                                ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSelect(ord.id)}
                                  className="mt-0.5 text-indigo-600 hover:scale-110 transition"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>

                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-black text-slate-900 text-xs">
                                      #{ord.id}
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                      {orderDate.toLocaleDateString('vi-VN')} ({orderDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                                    </span>
                                    {daysAgo >= 7 && (
                                      <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                        Nợ {daysAgo} ngày
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-xs text-slate-700 space-y-0.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    {ord.items.map((item, idx) => (
                                      <div key={idx} className="flex justify-between font-medium">
                                        <span>• {item.productName} x{item.quantity}</span>
                                        <span className="text-slate-500 font-mono">{formatVND(item.lineTotal)}</span>
                                      </div>
                                    ))}
                                  </div>

                                  {ord.deliveryNote && (
                                    <p className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                      Ghi chú: {ord.deliveryNote}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0 space-y-1.5">
                                <span className="text-sm font-black text-rose-600 font-mono block">
                                  {formatVND(ord.totalAmount)}
                                </span>

                                <div className="flex items-center gap-1 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleSettleSingle(ord.id, 'CASH')}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg border border-emerald-200 transition"
                                    title="Thu tiền mặt riêng đơn này"
                                  >
                                    Thu TM
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSettleSingle(ord.id, 'BANK_TRANSFER')}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-bold rounded-lg border border-blue-200 transition"
                                    title="Gạch nợ CK riêng đơn này"
                                  >
                                    Đã CK
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 2: PAID ORDER HISTORY */}
            {activeTab === 'HISTORY' && (
              <div className="space-y-2">
                {paidOrders.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                    Chưa có đơn hàng nào được ghi nhận đã thanh toán trước đây.
                  </div>
                ) : (
                  paidOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 bg-white rounded-2xl border border-slate-200 text-xs flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">#{ord.id}</span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(ord.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate max-w-[280px]">
                          {ord.items.map((i) => `${i.productName} x${i.quantity}`).join(', ')}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>
                            {ord.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} • Xác nhận: {ord.paidConfirmedBy || 'Nhân viên'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold text-slate-900 font-mono text-sm block">
                          {formatVND(ord.totalAmount)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1 border border-emerald-200">
                          ĐÃ THANH TOÁN
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: SETTINGS & NOTES */}
            {activeTab === 'SETTINGS' && (
              <form onSubmit={handleSaveSettings} className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                {saveSuccess && (
                  <div className="p-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>Đã lưu cài đặt hạn mức công nợ thành công!</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Hạn mức công nợ tối đa (VND)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    Hệ thống sẽ cảnh báo khi tổng nợ của khách hàng vượt quá số tiền này (Để trống nếu không giới hạn).
                  </p>
                  <input
                    type="number"
                    step="50000"
                    placeholder="VD: 500000 hoặc 1000000"
                    value={editLimit}
                    onChange={(e) => setEditLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="vipCheckbox"
                    checked={editIsVip}
                    onChange={(e) => setEditIsVip(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="vipCheckbox" className="font-bold text-slate-800 select-none cursor-pointer flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>Đánh dấu Khách hàng Thân thiết (VIP Resident)</span>
                  </label>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Ghi chú thỏa thuận công nợ / Thói quen thanh toán
                  </label>
                  <textarea
                    rows={3}
                    placeholder="VD: Khách trả dồn vào chiều thứ 6 hàng tuần qua tài khoản MBBank..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-sans text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu thay đổi cài đặt công nợ</span>
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
            {onOpenCreateOrder && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateOrder(customer);
                }}
                className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tạo đơn mới</span>
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Zalo Statement Modal */}
      <ZaloDebtStatementModal
        customer={customer}
        unpaidOrders={unpaidOrders}
        isOpen={showZaloStatement}
        onClose={() => setShowZaloStatement(false)}
      />

      {/* VietQR Modal for whole debt */}
      {virtualDebtOrder && (
        <VietQRModal
          order={virtualDebtOrder}
          isOpen={showVietQrModal}
          onClose={() => setShowVietQrModal(false)}
        />
      )}

      {/* Automated Overdue Debt Reminder Modal (Zalo / SMS) */}
      <CustomerDebtReminderModal
        customer={customer}
        unpaidOrders={unpaidOrders}
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        daysOverdue={daysSinceOldestDebt}
      />
    </>
  );
};
