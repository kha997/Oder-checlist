import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { Order, PaymentMethod, getOrderCost, getOrderPrice, getOrderProfit } from '../types';
import { ProofOfDeliveryCameraModal } from './ProofOfDeliveryCameraModal';
import {
  X,
  CheckCircle2,
  Clock,
  Rocket,
  Banknote,
  Phone,
  Building2,
  MapPin,
  FileText,
  Lock,
  Copy,
  Check,
  Truck,
  UserCheck,
  Package,
  Camera,
  ArrowRight,
  ExternalLink,
  Repeat,
  TrendingUp,
  Maximize2,
  Download,
  Sparkles,
} from 'lucide-react';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToHistory?: (orderId: string) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onNavigateToHistory,
}) => {
  const { markReadyForDelivery, markDelivered, markPaid, currentUser, setCurrentScreen, setGlobalSearchQuery } = useApp();
  const [copied, setCopied] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);

  if (!isOpen || !order) return null;

  const isDelivered = order.deliveryStatus === 'DELIVERED';
  const isReady = order.deliveryStatus === 'READY_FOR_DELIVERY';
  const isPaid = order.paymentStatus === 'PAID';
  const specialDeliveryInstructions = order.notes || order.deliveryNote || order.note || order.location?.notes || order.location?.deliveryNote;

  const handleCopy = () => {
    const lines = [
      `📦 ĐƠN HÀNG: ${order.id}`,
      `👤 Khách hàng: ${order.customerName}`,
      order.customerPhone ? `📞 SĐT: ${order.customerPhone}` : '',
      `📍 Địa chỉ: ${order.location.formattedAddress}`,
      specialDeliveryInstructions ? `📝 Ghi chú: ${specialDeliveryInstructions}` : '',
      order.internalNote ? `🔒 Ghi chú nội bộ: ${order.internalNote}` : '',
      `🍽️ Món ăn:`,
      ...order.items.map((i) => `  • ${i.productName} x${i.quantity}: ${formatVND(i.lineTotal)}`),
      `💰 TỔNG CỘNG: ${formatVND(order.totalAmount)}`,
      `💳 Thanh toán: ${isPaid ? 'ĐÃ THU' : 'CHƯA THU'}`,
      `🚚 Giao hàng: ${isDelivered ? 'ĐÃ GIAO' : isReady ? 'SẴN SÀNG GIAO' : 'CHỜ GIAO'}`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewInHistory = () => {
    setGlobalSearchQuery(order.id);
    setCurrentScreen('ORDER_HISTORY');
    if (onNavigateToHistory) {
      onNavigateToHistory(order.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center font-black text-sm">
              {order.id.replace('ORD-', '#')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-wide">{order.id}</h3>
                {order.priority && (
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      order.priority === 'HIGH'
                        ? 'bg-rose-500 text-white'
                        : order.priority === 'LOW'
                        ? 'bg-slate-500 text-white'
                        : 'bg-amber-400 text-slate-900'
                    }`}
                  >
                    {order.priority === 'HIGH' ? 'Ưu tiên Cao' : order.priority === 'LOW' ? 'Ưu tiên Thấp' : 'Ưu tiên TB'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-emerald-200">
                {new Date(order.createdAt).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Status Badges Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Delivery Status */}
            <div
              className={`p-2.5 rounded-2xl border flex items-center gap-2 ${
                isDelivered
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : isReady
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {isDelivered ? (
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              ) : isReady ? (
                <Rocket className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
              ) : (
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div className="text-xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Giao hàng</span>
                <span className="font-black">
                  {isDelivered ? 'ĐÃ GIAO XONG' : isReady ? 'SẴN SÀNG GIAO' : 'CHỜ GIAO HÀNG'}
                </span>
              </div>
            </div>

            {/* Payment Status */}
            <div
              className={`p-2.5 rounded-2xl border flex items-center gap-2 ${
                isPaid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <Banknote className={`w-4 h-4 shrink-0 ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`} />
              <div className="text-xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Thanh toán</span>
                <span className="font-black">
                  {isPaid ? `ĐÃ THU (${order.paymentMethod === 'CASH' ? 'Tiền mặt' : 'CK'})` : 'CHƯA THU TIỀN'}
                </span>
              </div>
            </div>
          </div>

          {/* Customer & Address Card */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Khách hàng</span>
                <p className="text-sm font-black text-slate-900">{order.customerName}</p>
              </div>
              {order.customerPhone && (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold flex items-center gap-1.5 transition active:scale-95 border border-blue-200"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{order.customerPhone}</span>
                </a>
              )}
            </div>

            <div className="flex items-start gap-2 pt-1">
              {order.location.type === 'condo' ? (
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold text-slate-800">
                  {order.location.formattedAddress}
                </span>
                {order.location.condoName && (
                  <p className="text-[11px] text-slate-500">{order.location.condoName}</p>
                )}
              </div>
            </div>

            {specialDeliveryInstructions && (
              <div className="p-3.5 rounded-2xl bg-amber-50/95 border border-amber-300 text-amber-950 space-y-1.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="uppercase text-[11px] font-black tracking-wide">
                    Ghi chú & Hướng dẫn giao hàng (Notes / Delivery Instructions):
                  </span>
                </div>
                <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200">
                  <p className="text-xs font-bold whitespace-pre-wrap text-amber-950 leading-relaxed font-sans">
                    {specialDeliveryInstructions}
                  </p>
                </div>
              </div>
            )}

            {order.internalNote && (
              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 flex items-start gap-2">
                <Lock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-purple-700 uppercase block">Ghi chú nội bộ:</span>
                  <p className="font-semibold whitespace-pre-wrap">{order.internalNote}</p>
                </div>
              </div>
            )}
          </div>

          {/* Recurring Schedule Card */}
          {order.isRecurring && (
            <div className="bg-purple-50/80 rounded-2xl p-3.5 border border-purple-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-black text-purple-900 text-xs block">Đơn Hàng Giao Định Kỳ</span>
                    <span className="text-[10px] text-purple-600 font-semibold">
                      Tần suất:{' '}
                      {order.recurringFrequency === 'DAILY'
                        ? 'Hàng ngày'
                        : order.recurringFrequency === 'WEEKLY'
                        ? 'Hàng tuần'
                        : order.recurringFrequency === 'BIWEEKLY'
                        ? '2 tuần/lần'
                        : 'Hàng tháng'}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    order.recurringActive === false
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-purple-200 text-purple-800'
                  }`}
                >
                  {order.recurringActive === false ? 'Tạm dừng' : 'Đang hoạt động'}
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Kỳ giao tiếp theo</span>
                  <span className="font-extrabold text-slate-900">
                    {order.nextRecurringDate
                      ? new Date(order.nextRecurringDate).toLocaleDateString('vi-VN', {
                          weekday: 'long',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : 'Chưa định ngày'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Items Breakdown Card */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                <span>Chi tiết món ({order.items.reduce((s, i) => s + i.quantity, 0)} phần):</span>
              </span>
              <span className="text-[11px] text-slate-400">Thành tiền</span>
            </div>

            <div className="space-y-1.5">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200/70">
                  <div>
                    <span className="font-bold text-slate-900">{item.productName}</span>
                    <span className="text-slate-500 ml-1.5 font-semibold">x{item.quantity}</span>
                  </div>
                  <span className="font-black text-slate-800 font-mono">
                    {formatVND(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <div className="flex justify-between items-center text-[11px] text-slate-500">
                <span>Giá bán (Selling Price):</span>
                <span className="font-bold text-slate-700 font-mono">{formatVND(getOrderPrice(order))}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-500">
                <span>Giá vốn ước tính (Cost):</span>
                <span className="font-bold text-slate-700 font-mono">{formatVND(getOrderCost(order))}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-dashed border-slate-200">
                <span className="flex items-center gap-1 text-emerald-800">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Lợi nhuận gộp (Profit):</span>
                </span>
                <div className="text-right">
                  <span className="font-black text-emerald-700 font-mono">
                    {formatVND(getOrderProfit(order))}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold ml-1.5">
                    ({getOrderPrice(order) > 0 ? Math.round((getOrderProfit(order) / getOrderPrice(order)) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-black">
                <span className="text-slate-900">TỔNG TIỀN THU:</span>
                <span className="text-base text-emerald-700 font-mono">
                  {formatVND(order.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* PROOF-OF-DELIVERY PHOTO CARD */}
          <div className="p-3.5 bg-gradient-to-br from-indigo-50/90 to-purple-50/80 rounded-2xl border border-indigo-200/90 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-indigo-950">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Camera className="w-3.5 h-3.5" />
                </div>
                <span>ẢNH XÁC NHẬN GIAO HÀNG (PROOF OF DELIVERY)</span>
              </div>

              {order.receiptImageUrl ? (
                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1 active:scale-95 transition"
                >
                  <Camera className="w-3 h-3 text-indigo-600" />
                  <span>Chụp lại</span>
                </button>
              ) : null}
            </div>

            {order.receiptImageUrl ? (
              <div className="space-y-2">
                <div className="relative group rounded-xl overflow-hidden border border-indigo-300 max-h-56 bg-slate-900 flex items-center justify-center shadow-inner cursor-pointer"
                  onClick={() => setShowFullImageModal(true)}
                >
                  <img
                    src={order.receiptImageUrl}
                    alt="Bằng chứng giao hàng"
                    className="w-full max-h-56 object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <span className="text-white text-xs font-black bg-black/60 px-3 py-1.5 rounded-xl backdrop-blur-xs flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Xem ảnh lớn</span>
                    </span>
                  </div>

                  <span className="absolute bottom-2 left-2 bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-xs">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Đã đính kèm</span>
                  </span>
                </div>

                {/* Proof metadata: Time and Note */}
                <div className="flex items-center justify-between text-[11px] text-indigo-950 bg-white/80 p-2 rounded-xl border border-indigo-100">
                  <div className="space-y-0.5">
                    {order.proofOfDeliveryNote && (
                      <p className="font-bold text-slate-800">
                        📍 Vị trí: <span className="text-indigo-700">{order.proofOfDeliveryNote}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500 font-mono">
                      Thời gian chụp: {order.proofOfDeliveryTime ? new Date(order.proofOfDeliveryTime).toLocaleString('vi-VN') : 'Đã lưu'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowFullImageModal(true)}
                      className="p-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 transition"
                      title="Phóng to ảnh"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={order.receiptImageUrl}
                      download={`POD_${order.id}.jpg`}
                      className="p-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 transition"
                      title="Tải ảnh về máy"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white/80 rounded-xl border border-dashed border-indigo-300 text-center space-y-2">
                <p className="text-[11px] text-slate-600 font-medium">
                  Chưa có ảnh chụp gói hàng xác nhận giao (Proof-of-Delivery).
                </p>
                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95 transition"
                >
                  <Camera className="w-4 h-4 text-white" />
                  <span>CHỤP ẢNH GÓI HÀNG BẰNG CAMERA (POD)</span>
                </button>
              </div>
            )}
          </div>

          {/* Operator Audit Info */}
          {(order.deliveredBy || order.paidConfirmedBy) && (
            <div className="text-[11px] text-slate-500 bg-slate-100 p-2.5 rounded-xl space-y-1">
              {order.deliveredBy && (
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Giao bởi: <strong>{order.deliveredBy}</strong></span>
                  {order.deliveryTime && (
                    <span className="text-slate-400">
                      ({new Date(order.deliveryTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  )}
                </div>
              )}
              {order.paidConfirmedBy && (
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Thu tiền bởi: <strong>{order.paidConfirmedBy}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Quick Action Buttons */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            {/* Ready button if still pending */}
            {!isDelivered && !isReady && (
              <button
                onClick={() => markReadyForDelivery(order.id)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition shadow-sm"
              >
                <Rocket className="w-3.5 h-3.5 text-emerald-200" />
                <span>Sẵn sàng giao</span>
              </button>
            )}

            {/* Deliver button if not delivered */}
            {!isDelivered && (
              <>
                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition shadow-2xs"
                  title="Chụp ảnh gói hàng và xác nhận giao"
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Chụp POD</span>
                </button>

                <button
                  onClick={() => markDelivered(order.id)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-200" />
                  <span>Xác nhận đã giao</span>
                </button>
              </>
            )}

            {/* Pay buttons if unpaid */}
            {!isPaid && (
              <button
                onClick={() => markPaid(order.id, 'CASH')}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition shadow-sm"
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Thu tiền mặt</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={handleCopy}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép đơn'}</span>
            </button>

            <button
              onClick={handleViewInHistory}
              className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition border border-indigo-200"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Xem trong Lịch sử</span>
            </button>
          </div>
        </div>
      </div>

      {/* Proof-of-Delivery Camera Modal */}
      <ProofOfDeliveryCameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        order={order}
      />

      {/* Full-Screen Lightbox Image Modal */}
      {showFullImageModal && order.receiptImageUrl && (
        <div className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl flex items-center justify-between text-white p-2 mb-2">
            <div>
              <p className="font-black text-sm uppercase">ẢNH XÁC NHẬN GIAO HÀNG (POD)</p>
              <p className="text-xs text-slate-400">{order.id} • {order.customerName}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={order.receiptImageUrl}
                download={`POD_${order.id}.jpg`}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white flex items-center gap-1.5 text-xs font-bold transition"
              >
                <Download className="w-4 h-4" />
                <span>Tải về</span>
              </a>
              <button
                type="button"
                onClick={() => setShowFullImageModal(false)}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl border border-white/20 bg-slate-950 flex items-center justify-center">
            <img
              src={order.receiptImageUrl}
              alt="Ảnh xác nhận giao hàng đầy đủ"
              className="max-h-[80vh] w-auto object-contain"
            />
          </div>

          {order.proofOfDeliveryNote && (
            <p className="text-xs text-white/90 bg-white/10 px-4 py-2 rounded-xl mt-3 border border-white/20">
              📍 Ghi chú vị trí: <strong>{order.proofOfDeliveryNote}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
