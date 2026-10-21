import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { VIETNAM_POPULAR_BANKS, type BankDirectoryItem, generateVietQrUrl } from '../utils/vietqr';
import {
  CreditCard,
  Building2,
  CheckCircle2,
  X,
  Search,
  Save,
  QrCode,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface BankSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BankSettingsModal: React.FC<BankSettingsModalProps> = ({ isOpen, onClose }) => {
  const { bankConfig, updateBankConfig } = useApp();

  const [selectedBankBin, setSelectedBankBin] = useState(bankConfig.bankBin || '970422');
  const [accountNumber, setAccountNumber] = useState(bankConfig.accountNumber || '');
  const [accountHolder, setAccountHolder] = useState(bankConfig.accountHolder || '');
  const [qrTemplate, setQrTemplate] = useState(bankConfig.qrTemplate || 'compact2');
  const [bankSearch, setBankSearch] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const filteredBanks = VIETNAM_POPULAR_BANKS.filter(
    (b) =>
      b.shortName.toLowerCase().includes(bankSearch.toLowerCase()) ||
      b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
      b.code.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const selectedBank =
    VIETNAM_POPULAR_BANKS.find((b) => b.bin === selectedBankBin) || VIETNAM_POPULAR_BANKS[0];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateBankConfig({
      bankBin: selectedBank.bin,
      bankCode: selectedBank.code,
      bankName: `${selectedBank.shortName} - ${selectedBank.name}`,
      accountNumber: accountNumber.trim(),
      accountHolder: accountHolder.trim().toUpperCase(),
      qrTemplate: qrTemplate as any,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1500);
  };

  const previewQrUrl = generateVietQrUrl({
    bankBin: selectedBank.bin,
    accountNumber: accountNumber || '00000000',
    accountHolder: accountHolder || 'CHU QUAN',
    amount: 50000,
    memo: 'DEMO 50K',
    template: qrTemplate as any,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <CreditCard className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Cài Đặt Tài Khoản Ngân Hàng Quán (VietQR)
              </h3>
              <p className="text-[11px] text-emerald-200">
                Tự động tạo mã QR chuyển khoản chính xác theo từng đơn hàng
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

        {savedSuccess && (
          <div className="bg-emerald-600 text-white p-2.5 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>Đã lưu cấu hình tài khoản ngân hàng thành công!</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Select Bank */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Chọn Ngân Hàng Thụ Hưởng *
            </label>

            {/* Bank Search */}
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Tìm ngân hàng (MB, VCB, Techcom, VPBank, ACB...)"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50">
              {filteredBanks.map((bank) => {
                const isSelected = selectedBankBin === bank.bin;
                return (
                  <button
                    type="button"
                    key={bank.bin}
                    onClick={() => setSelectedBankBin(bank.bin)}
                    className={`p-2 rounded-lg border text-left flex items-center gap-2 transition ${
                      isSelected
                        ? 'border-emerald-600 bg-white shadow-xs ring-2 ring-emerald-500'
                        : 'border-slate-200 bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 leading-tight">
                        {bank.shortName}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{bank.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Number & Account Holder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Số Tài Khoản Nhận Tiền *
              </label>
              <input
                type="text"
                required
                placeholder="VD: 0901234567 hoặc 1903..."
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Tên Chủ Tài Khoản *
              </label>
              <input
                type="text"
                required
                placeholder="VD: NGUYEN THI HOA"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-xs font-bold uppercase bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Template Style */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Giao Diện Khung Mã VietQR
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'compact2', label: 'Hiện đại (Gợi ý)' },
                { id: 'compact', label: 'Chuẩn Napas' },
                { id: 'qr_only', label: 'Chỉ mã QR' },
              ].map((tmpl) => (
                <button
                  type="button"
                  key={tmpl.id}
                  onClick={() => setQrTemplate(tmpl.id as any)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition ${
                    qrTemplate === tmpl.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center gap-3">
            <div className="w-20 h-20 bg-white rounded-xl border border-slate-200 p-1 shrink-0 overflow-hidden flex items-center justify-center">
              <img src={previewQrUrl} alt="Xem trước VietQR" className="w-full h-full object-contain" />
            </div>
            <div className="text-xs min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Xem trước cấu hình:</span>
              <p className="font-extrabold text-slate-900 mt-0.5 truncate">
                {selectedBank.shortName} • {accountNumber || '(Chưa nhập STK)'}
              </p>
              <p className="font-semibold text-slate-700 uppercase text-[11px] mt-0.5 truncate">
                {accountHolder || '(Chưa nhập tên)'}
              </p>
              <p className="text-[10px] text-emerald-700 mt-1">
                ✓ Khách hàng quét mã sẽ tự điền chính xác số tiền và mã đơn.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition"
            >
              <Save className="w-4 h-4" />
              <span>Lưu Cấu Hình VietQR</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
