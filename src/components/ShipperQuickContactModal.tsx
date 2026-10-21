import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { type Order } from '../types';
import { formatVND } from '../utils/storage';
import {
  cleanPhoneNumber,
  getZaloChatUrl,
  getTelUrl,
  getShipperMessageTemplates,
} from '../utils/vietqr';
import {
  Phone,
  MessageCircle,
  QrCode,
  Copy,
  Check,
  X,
  ExternalLink,
  Building2,
  FileText,
  User,
  Sparkles,
} from 'lucide-react';

interface ShipperQuickContactModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenVietQr: (order: Order) => void;
}

export const ShipperQuickContactModal: React.FC<ShipperQuickContactModalProps> = ({
  order,
  isOpen,
  onClose,
  onOpenVietQr,
}) => {
  const { bankConfig } = useApp();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const phone = order.customerPhone || '';
  const cleanPhone = cleanPhoneNumber(phone);
  const zaloUrl = getZaloChatUrl(phone);
  const telUrl = getTelUrl(phone);
  const templates = getShipperMessageTemplates(order, bankConfig);

  const handleCopyAndOpenZalo = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
      if (zaloUrl) {
        window.open(zaloUrl, '_blank');
      }
    }, 700);
  };

  const handleCopyTemplateOnly = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-blue-700 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Phone className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Liên Hệ Khách Hàng (1-Tap)
              </h3>
              <p className="text-[11px] text-emerald-200">
                {order.customerName} • {order.location.formattedAddress}
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
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {/* Customer Card */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Khách hàng:</span>
              <p className="text-sm font-black text-slate-900">{order.customerName}</p>
              <p className="text-xs text-slate-600 font-semibold mt-0.5">
                {phone ? phone : 'Chưa có SĐT khách'}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Tiền thu:</span>
              <span className="text-sm font-black text-emerald-700 font-mono">
                {formatVND(order.totalAmount)}
              </span>
            </div>
          </div>

          {/* Quick Primary Actions: Call & Zalo */}
          <div className="grid grid-cols-2 gap-2">
            {phone ? (
              <>
                <a
                  href={telUrl}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition"
                >
                  <Phone className="w-4 h-4 text-emerald-200" />
                  <span>GỌI ĐIỆN NGAY</span>
                </a>

                <a
                  href={zaloUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-3 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-700/20 flex items-center justify-center gap-2 transition"
                >
                  <MessageCircle className="w-4 h-4 text-blue-200" />
                  <span>MỞ ZALO CHAT</span>
                </a>
              </>
            ) : (
              <div className="col-span-2 p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200 text-center font-medium">
                Đơn hàng này chưa có số điện thoại khách.
              </div>
            )}
          </div>

          {/* Open VietQR Action */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenVietQr(order);
            }}
            className="w-full py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 active:scale-98 text-indigo-900 border border-indigo-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
          >
            <QrCode className="w-4 h-4 text-indigo-600" />
            <span>Mở Mã VietQR Chuyển Khoản ({formatVND(order.totalAmount)})</span>
          </button>

          {/* Pre-written SMS / Zalo Templates for Shipper */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Mẫu Tin Nhắn Soạn Sẵn (1-Tap Copy)
              </span>
            </div>

            <div className="space-y-2">
              {templates.map((tmpl) => {
                const isCopied = copiedId === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{tmpl.title}</span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100 whitespace-pre-wrap font-sans">
                      {tmpl.content}
                    </p>

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleCopyTemplateOnly(tmpl.content, tmpl.id)}
                        className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Đã chép tin nhắn</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>

                      {phone && (
                        <button
                          type="button"
                          onClick={() => handleCopyAndOpenZalo(tmpl.content, tmpl.id)}
                          className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 active:scale-95 text-[11px] font-bold rounded-lg border border-blue-200 flex items-center justify-center gap-1 transition"
                        >
                          <MessageCircle className="w-3 h-3 text-blue-600" />
                          <span>Chép & Mở Zalo</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
