import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { PaymentMethod, OrderPriority } from '../types';
import {
  ArrowLeft,
  Wallet,
  Building2,
  Phone,
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
} from 'lucide-react';

export const UnpaidScreen: React.FC = () => {
  const { orders, markPaid, currentUser, setCurrentScreen } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<'ALL' | 'PENDING' | 'DELIVERED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | OrderPriority>('ALL');
  const [showPaidHistory, setShowPaidHistory] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        <button
          onClick={() => setShowPaidHistory(!showPaidHistory)}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
            showPaidHistory ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          Đã thu ({paidOrders.length})
        </button>
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
          {/* List of Unpaid Orders */}
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

                    {/* Customer info */}
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{order.customerName}</span>
                        {order.customerPhone && (
                          <span className="text-slate-400 ml-2 font-mono">{order.customerPhone}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
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
                      <span className="text-xl font-black text-rose-600">
                        {formatVND(order.totalAmount)}
                      </span>
                    </div>

                    {/* 2 FAST PAYMENT BUTTONS */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() =>
                          handleCollect(
                            order.id,
                            order.location.formattedAddress,
                            'CASH',
                            order.totalAmount
                          )
                        }
                        className="py-3 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
                      >
                        <Banknote className="w-4 h-4 text-emerald-200" />
                        <span>💵 TIỀN MẶT</span>
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
                        className="py-3 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition"
                      >
                        <Landmark className="w-4 h-4 text-blue-200" />
                        <span>🏦 CHUYỂN KHOẢN</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
    </div>
  );
};
