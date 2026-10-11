import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Customer, Order } from '../types';
import { formatVND } from '../utils/storage';
import {
  cleanPhoneNumber,
  getZaloChatUrl,
  getTelUrl,
  generateCustomerDebtZaloStatement,
  generateCustomerDebtVietQrUrl,
} from '../utils/vietqr';
import {
  MessageCircle,
  Copy,
  Check,
  CheckCircle2,
  X,
  Phone,
  QrCode,
  Printer,
  Building2,
  Calendar,
  AlertCircle,
  ExternalLink,
  Receipt,
  Share2,
} from 'lucide-react';

interface ZaloDebtStatementModalProps {
  customer: Customer | null;
  unpaidOrders: Order[];
  isOpen: boolean;
  onClose: () => void;
  onOpenVietQrModal?: (amount: number, memo: string) => void;
}

export const ZaloDebtStatementModal: React.FC<ZaloDebtStatementModalProps> = ({
  customer,
  unpaidOrders,
  isOpen,
  onClose,
  onOpenVietQrModal,
}) => {
  const { bankConfig } = useApp();
  const [copied, setCopied] = useState(false);
  const [showQrPreview, setShowQrPreview] = useState(true);

  if (!isOpen || !customer) return null;

  const phone = customer.phone || '';
  const cleanPhone = cleanPhoneNumber(phone);
  const zaloUrl = getZaloChatUrl(phone);
  const telUrl = getTelUrl(phone);

  const totalDebt = unpaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const statementText = generateCustomerDebtZaloStatement(customer, unpaidOrders, bankConfig);

  const debtQrUrl = generateCustomerDebtVietQrUrl(customer, totalDebt, bankConfig);

  const addressLabel =
    customer.defaultLocationType === 'condo'
      ? `${customer.block || ''}${customer.floor ? '-' + customer.floor : ''}${customer.unit ? '-' + customer.unit : ''} ${customer.condoName ? `(${customer.condoName})` : ''}`.trim()
      : customer.externalAddress || 'Địa chỉ khách hàng';

  const handleCopy = () => {
    navigator.clipboard.writeText(statementText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyAndOpenZalo = () => {
    navigator.clipboard.writeText(statementText);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      if (zaloUrl) {
        window.open(zaloUrl, '_blank');
      }
    }, 600);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Receipt className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Bảng Đối Soát Công Nợ & Gửi Zalo
              </h3>
              <p className="text-[11px] text-blue-200">
                {customer.name} • {addressLabel || 'Cư dân'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Quick Summary Card */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                Tổng nợ cần đối soát ({unpaidOrders.length} đơn):
              </span>
              <span className="text-xl font-black text-rose-900 font-mono">
                {formatVND(totalDebt)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {phone && (
                <a
                  href={telUrl}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1 shadow-2xs hover:bg-rose-100 transition active:scale-95"
                  title="Gọi điện thoại trực tiếp"
                >
                  <Phone className="w-3.5 h-3.5 text-rose-600" />
                  <span className="font-mono">{phone}</span>
                </a>
              )}
            </div>
          </div>

          {/* Action Bar: Copy & Zalo Direct */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Đã chép nội dung</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Sao chép tin nhắn</span>
                </>
              )}
            </button>

            {phone ? (
              <button
                type="button"
                onClick={handleCopyAndOpenZalo}
                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-md shadow-blue-600/25 ring-2 ring-blue-300/40"
              >
                <MessageCircle className="w-4 h-4 text-blue-200" />
                <span>Chép & Mở Zalo</span>
              </button>
            ) : (
              <div className="py-2 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Chưa có SĐT để mở Zalo</span>
              </div>
            )}
          </div>

          {/* VietQR Quick Scan Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>Mã VietQR Tổng Công Nợ ({formatVND(totalDebt)})</span>
              </span>
              <button
                type="button"
                onClick={() => setShowQrPreview(!showQrPreview)}
                className="text-[11px] font-bold text-indigo-600 hover:underline"
              >
                {showQrPreview ? 'Thu nhỏ' : 'Hiện mã QR'}
              </button>
            </div>

            {showQrPreview && (
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/80">
                <div className="w-32 h-32 bg-slate-50 rounded-xl border border-slate-200 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                  <img src={debtQrUrl} alt="VietQR Tổng Nợ" className="w-full h-full object-contain" />
                </div>
                <div className="text-xs space-y-1 text-slate-700 min-w-0 flex-1">
                  <p className="font-bold text-slate-900">
                    {bankConfig.bankName}
                  </p>
                  <p className="font-mono font-bold text-slate-800">
                    STK: <span className="text-blue-700 font-black">{bankConfig.accountNumber}</span>
                  </p>
                  <p className="text-[11px] text-slate-600 uppercase">
                    Chủ TK: <strong className="text-slate-800">{bankConfig.accountHolder}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Nội dung: <strong className="text-blue-700 font-mono">NO {cleanPhone || customer.unit || 'KHACH'}</strong>
                  </p>
                  <a
                    href={debtQrUrl}
                    target="_blank"
                    rel="noreferrer"
                    download={`VietQR_CongNo_${customer.name}.png`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline pt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Tải ảnh mã QR gửi kèm</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Statement Message Preview (Formatted text ready for Zalo) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wide">
                Nội dung tin nhắn sao kê đối soát (Zalo Text Preview):
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                {copied ? 'Đã sao chép ✓' : 'Sao chép văn bản'}
              </button>
            </div>
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-3.5 text-xs font-sans leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto select-all border border-slate-800">
              {statementText}
            </div>
          </div>

          {/* Detailed Breakdown Table */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
              Bảng chi tiết {unpaidOrders.length} đơn nợ:
            </span>
            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
              {unpaidOrders.map((ord, idx) => (
                <div key={ord.id} className="p-2.5 bg-white flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900">#{ord.id}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ord.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate max-w-[260px]">
                      {ord.items.map((i) => `${i.productName} x${i.quantity}`).join(', ')}
                    </p>
                  </div>
                  <span className="font-black text-rose-600 font-mono">
                    {formatVND(ord.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="py-2 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            title="In bảng sao kê ra giấy hoặc xuất PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">In sao kê (Print)</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
            >
              Đóng
            </button>
            {phone && (
              <button
                type="button"
                onClick={handleCopyAndOpenZalo}
                className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase flex items-center gap-1.5 transition shadow-sm active:scale-95"
              >
                <MessageCircle className="w-3.5 h-3.5 text-blue-200" />
                <span>Gửi Zalo ngay</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
