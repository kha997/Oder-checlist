import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { type Order } from '../types';
import { formatVND } from '../utils/storage';
import { generateVietQrUrl } from '../utils/vietqr';
import { QrCode, Copy, Check, CheckCircle2, X, Building2, AlertCircle, ExternalLink, Settings } from 'lucide-react';

interface VietQRModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenBankSettings?: () => void;
}

export const VietQRModal: React.FC<VietQRModalProps> = ({
  order,
  isOpen,
  onClose,
  onOpenBankSettings,
}) => {
  const { bankConfig, markPaid, roleConfig } = useApp();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!isOpen || !order) return null;

  const amount = order.totalAmount;
  const transferContent = order.id.replace(/[^a-zA-Z0-9]/g, '');

  const qrImageUrl = generateVietQrUrl({
    bankBin: bankConfig.bankBin,
    accountNumber: bankConfig.accountNumber,
    accountHolder: bankConfig.accountHolder,
    amount,
    memo: transferContent,
    template: bankConfig.qrTemplate || 'compact2',
  });

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleConfirmPaid = () => {
    markPaid(order.id, 'BANK_TRANSFER');
    setIsPaidSuccess(true);
    setTimeout(() => {
      setIsPaidSuccess(false);
      onClose();
    }, 1500);
  };

  const isAlreadyPaid = order.paymentStatus === 'PAID';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <QrCode className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Mã VietQR Chuyển Khoản
              </h3>
              <p className="text-[11px] text-blue-200">
                Đơn hàng {order.id} • {order.customerName}
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

        {/* Success Alert if marked paid */}
        {isPaidSuccess && (
          <div className="bg-emerald-600 text-white p-3 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>Đã xác nhận thanh toán thành công!</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {/* QR Code Container */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col items-center justify-center relative">
            <div className="w-full max-w-[270px] aspect-square bg-white rounded-xl shadow-xs border border-slate-100 p-2 flex items-center justify-center overflow-hidden">
              {!imageError ? (
                <img
                  src={qrImageUrl}
                  alt={`VietQR ${order.id}`}
                  className="w-full h-full object-contain"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="text-center p-4 text-xs text-slate-500 space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="font-semibold text-slate-700">Không tải được hình ảnh QR</p>
                  <p className="text-[11px]">Vui lòng kiểm tra kết nối mạng hoặc chuyển khoản thủ công theo thông tin bên dưới.</p>
                </div>
              )}
            </div>

            <div className="mt-2 text-center">
              <span className="text-[11px] font-semibold text-slate-500">
                Quét bằng mọi ứng dụng ngân hàng hoặc ví điện tử
              </span>
            </div>
          </div>

          {/* Amount Highlight */}
          <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide block">
                Số tiền thanh toán:
              </span>
              <span className="text-lg font-black text-emerald-900 font-mono">
                {formatVND(amount)}
              </span>
            </div>
            <button
              onClick={() => handleCopy(String(amount), 'amount')}
              className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-300 flex items-center gap-1 shadow-2xs active:scale-95 transition"
              title="Sao chép số tiền"
            >
              {copiedField === 'amount' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Chép tiền</span>
                </>
              )}
            </button>
          </div>

          {/* Bank Account Details */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Ngân hàng:</span>
              <span className="font-extrabold text-slate-900 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>{bankConfig.bankName}</span>
              </span>
            </div>

            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Số tài khoản:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-slate-900 text-sm tracking-wide">
                  {bankConfig.accountNumber}
                </span>
                <button
                  onClick={() => handleCopy(bankConfig.accountNumber, 'account')}
                  className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                  title="Sao chép số tài khoản"
                >
                  {copiedField === 'account' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Chủ tài khoản:</span>
              <span className="font-extrabold text-slate-900 uppercase">
                {bankConfig.accountHolder}
              </span>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <span className="text-slate-500 font-medium">Nội dung (Memo):</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {transferContent}
                </span>
                <button
                  onClick={() => handleCopy(transferContent, 'memo')}
                  className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                  title="Sao chép nội dung chuyển khoản"
                >
                  {copiedField === 'memo' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            {!isAlreadyPaid ? (
              <button
                type="button"
                onClick={handleConfirmPaid}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>XÁC NHẬN KHÁCH ĐÃ CHUYỂN KHOẢN XONG</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Đơn hàng này đã được xác nhận thanh toán</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              {roleConfig.canManageStaff && onOpenBankSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBankSettings();
                  }}
                  className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-semibold text-[11px]"
                >
                  <Settings className="w-3 h-3" />
                  <span>Đổi tài khoản ngân hàng quán</span>
                </button>
              )}

              <a
                href={qrImageUrl}
                target="_blank"
                rel="noreferrer"
                download={`VietQR_${order.id}.png`}
                className="text-blue-600 hover:underline ml-auto flex items-center gap-1 font-semibold text-[11px]"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Tải ảnh mã QR</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
