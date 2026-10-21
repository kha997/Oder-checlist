import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { type Customer, type Order } from '../types';
import { formatVND } from '../utils/storage';
import {
  cleanPhoneNumber,
  getZaloChatUrl,
  getTelUrl,
  getSmsUrl,
  getOverdueReminderTemplates,
  type OverdueReminderTemplate,
  generateCustomerDebtVietQrUrl,
} from '../utils/vietqr';
import {
  BellRing,
  MessageCircle,
  Smartphone,
  Copy,
  Check,
  CheckCircle2,
  X,
  Phone,
  AlertTriangle,
  Clock,
  Sparkles,
  ExternalLink,
  History,
  Send,
  User,
  QrCode,
  ShieldAlert,
} from 'lucide-react';

interface CustomerDebtReminderModalProps {
  customer: Customer | null;
  unpaidOrders: Order[];
  isOpen: boolean;
  onClose: () => void;
  daysOverdue?: number;
}

export const CustomerDebtReminderModal: React.FC<CustomerDebtReminderModalProps> = ({
  customer,
  unpaidOrders,
  isOpen,
  onClose,
  daysOverdue = 0,
}) => {
  const { bankConfig, recordCustomerDebtReminder } = useApp();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('GENTLE');
  const [customizedText, setCustomizedText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showQrPreview, setShowQrPreview] = useState<boolean>(false);

  // Initialize templates
  const templates = React.useMemo(() => {
    if (!customer) return [];
    return getOverdueReminderTemplates(customer, unpaidOrders, bankConfig, daysOverdue);
  }, [customer, unpaidOrders, bankConfig, daysOverdue]);

  // Sync selected template text
  React.useEffect(() => {
    if (templates.length > 0) {
      const defaultTmpl =
        daysOverdue >= 7
          ? templates.find((t) => t.id === 'URGENT') || templates[0]
          : templates.find((t) => t.id === selectedTemplateId) || templates[0];
      setSelectedTemplateId(defaultTmpl.id);
      setCustomizedText(defaultTmpl.content);
    }
  }, [templates, daysOverdue]);

  if (!isOpen || !customer) return null;

  const phone = customer.phone || '';
  const cleanPhone = cleanPhoneNumber(phone);
  const zaloUrl = getZaloChatUrl(phone);
  const telUrl = getTelUrl(phone);
  const smsUrl = getSmsUrl(phone, customizedText);

  const totalDebt = unpaidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const debtQrUrl = generateCustomerDebtVietQrUrl(customer, totalDebt, bankConfig);

  const handleSelectTemplate = (tmpl: OverdueReminderTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setCustomizedText(tmpl.content);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyOnly = () => {
    navigator.clipboard.writeText(customizedText);
    setCopiedId('CUSTOM');
    showToast('Đã sao chép nội dung tin nhắc nợ vào bộ nhớ tạm!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSendZalo = () => {
    navigator.clipboard.writeText(customizedText);
    recordCustomerDebtReminder(customer.id, 'ZALO');
    showToast('Đã chép nội dung và mở Zalo khách hàng! Hệ thống đã ghi nhận lịch sử nhắc.');
    setTimeout(() => {
      if (zaloUrl) {
        window.open(zaloUrl, '_blank');
      }
    }, 400);
  };

  const handleSendSMS = () => {
    recordCustomerDebtReminder(customer.id, 'SMS');
    showToast('Đang mở ứng dụng Tin nhắn SMS... Hệ thống đã lưu lịch sử nhắc nợ.');
    if (smsUrl) {
      window.location.href = smsUrl;
    }
  };

  const lastReminderDate = customer.lastReminderAt
    ? new Date(customer.lastReminderAt).toLocaleString('vi-VN')
    : null;

  return (
    <div className="fixed inset-0 z-65 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 text-white p-4 sm:p-5 flex items-start justify-between shrink-0 shadow-md">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0 shadow-inner">
              <BellRing className="w-6 h-6 text-amber-100 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg leading-tight text-white">
                  Nhắc Nợ Tự Động (Zalo / SMS)
                </h3>
                {daysOverdue >= 7 && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-900/60 text-rose-200 border border-rose-400/50 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>Quá hạn {daysOverdue} ngày</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                Khách: <strong className="text-white font-bold">{customer.name}</strong> •{' '}
                {phone ? <span className="font-mono">{phone}</span> : 'Chưa có SĐT'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white/90 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banner */}
        <div className="bg-amber-50/90 border-b border-amber-200 p-3 sm:px-5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-semibold">Tổng nợ cần nhắc:</span>
            <span className="text-base font-black text-rose-700 font-mono">
              {formatVND(totalDebt)}
            </span>
            <span className="text-[11px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded-full border border-amber-200">
              ({unpaidOrders.length} đơn nợ)
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <History className="w-3.5 h-3.5 text-amber-700" />
            <span>
              {customer.reminderCount && customer.reminderCount > 0 ? (
                <>
                  Đã nhắc: <strong className="text-amber-800">{customer.reminderCount} lần</strong>
                  {lastReminderDate && ` (Gần nhất: ${lastReminderDate})`}
                </>
              ) : (
                'Chưa gửi nhắc nợ lần nào'
              )}
            </span>
          </div>
        </div>

        {/* Toast alert */}
        {toastMessage && (
          <div className="mx-4 mt-3 bg-emerald-600 text-white p-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-md animate-fadeIn shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-200 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Template Choice Tabs */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Chọn Kịch Bản & Giọng Điệu Nhắc Nợ:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templates.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`p-3 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300/60 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-extrabold text-xs text-slate-900 leading-tight">
                        {tmpl.title}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border shrink-0 ${tmpl.badgeColor}`}
                      >
                        {tmpl.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {tmpl.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message Textarea (Editable & Pre-filled) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <span>Nội dung tin nhắn soạn sẵn (Có thể tự chỉnh sửa trực tiếp):</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {customizedText.length} ký tự
              </span>
            </div>

            <textarea
              rows={7}
              value={customizedText}
              onChange={(e) => setCustomizedText(e.target.value)}
              className="w-full p-3.5 bg-slate-900 text-slate-100 rounded-2xl font-sans text-xs leading-relaxed outline-none focus:ring-2 focus:ring-amber-500 border border-slate-800 resize-none selection:bg-amber-600"
              placeholder="Nội dung tin nhắn nhắc nợ..."
            />
          </div>

          {/* Quick Bank & VietQR toggle */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-600" />
              <div>
                <span className="font-bold text-slate-800 block">Kèm mã VietQR Chuyển Khoản</span>
                <span className="text-[11px] text-slate-500">
                  {bankConfig.bankCode || bankConfig.bankName} • {bankConfig.accountNumber} ({formatVND(totalDebt)})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowQrPreview(!showQrPreview)}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-700 font-bold border border-indigo-200 rounded-xl transition"
            >
              {showQrPreview ? 'Ẩn mã QR' : 'Xem mã QR'}
            </button>
          </div>

          {/* VietQR Preview Box */}
          {showQrPreview && (
            <div className="p-3 bg-white border border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-center gap-3 animate-fadeIn">
              <div className="w-28 h-28 bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0 overflow-hidden">
                <img src={debtQrUrl} alt="VietQR Nợ" className="w-full h-full object-contain" />
              </div>
              <div className="text-xs space-y-1 text-slate-700">
                <p className="font-bold text-slate-900">Mã VietQR Tổng Công Nợ</p>
                <p className="text-[11px] text-slate-600">
                  Khách hàng chỉ cần mở app ngân hàng quét mã này là đúng số tiền{' '}
                  <strong className="text-rose-600">{formatVND(totalDebt)}</strong> và đúng cú pháp.
                </p>
                <a
                  href={debtQrUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={`VietQR_NhacNo_${customer.name}.png`}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline pt-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Tải ảnh QR về máy để gửi kèm Zalo</span>
                </a>
              </div>
            </div>
          )}

          {/* Notice on Customer Phone */}
          {!phone && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Khách hàng chưa có số điện thoại trong danh bạ. Vui lòng bấm sao chép nội dung hoặc cập nhật SĐT để mở Zalo/SMS trực tiếp.
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopyOnly}
              className="flex-1 sm:flex-initial py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              {copiedId === 'CUSTOM' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Đã chép nội dung</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Sao chép tin</span>
                </>
              )}
            </button>

            {/* Direct Phone Call */}
            {phone && (
              <a
                href={telUrl}
                className="py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                title="Gọi điện trực tiếp"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Gọi điện</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* SMS Direct Button */}
            {phone && (
              <button
                type="button"
                onClick={handleSendSMS}
                className="flex-1 sm:flex-initial py-2.5 px-3.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs"
                title="Mở ứng dụng Tin nhắn SMS soạn sẵn"
              >
                <Smartphone className="w-4 h-4 text-amber-200" />
                <span>Gửi Tin SMS</span>
              </button>
            )}

            {/* Zalo Direct Button */}
            {phone ? (
              <button
                type="button"
                onClick={handleSendZalo}
                className="flex-1 sm:flex-initial py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition shadow-md shadow-blue-600/25 ring-2 ring-blue-300/40"
                title="Sao chép nội dung và mở Zalo khách"
              >
                <MessageCircle className="w-4 h-4 text-blue-200" />
                <span>Mở Zalo Gửi Ngay</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopyOnly}
                className="flex-1 sm:flex-initial py-2.5 px-4 bg-slate-800 text-white font-bold text-xs rounded-xl"
              >
                Sao chép tin nhắn
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 text-xs font-semibold text-slate-500 hover:bg-slate-200 rounded-xl transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
