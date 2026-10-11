import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationModal } from './NotificationModal';
import { OrderDetailModal } from './OrderDetailModal';
import { FirebaseSyncModal } from './FirebaseSyncModal';
import { StaffManagementModal } from './StaffManagementModal';
import { BankSettingsModal } from './BankSettingsModal';
import { GlobalSearchBar } from './GlobalSearchBar';
import { Order } from '../types';
import {
  ClipboardCheck,
  UserCheck,
  RotateCcw,
  Home,
  History,
  Bell,
  Cloud,
  CloudOff,
  QrCode,
  Users,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentUser,
    setCurrentUser,
    availableUsers,
    activeStaff,
    roleConfig,
    currentScreen,
    setCurrentScreen,
    resetToDemoData,
    unreadNotificationCount,
    firebaseUser,
  } = useApp();

  // Modals state
  const [showUserModal, setShowUserModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showBankSettingsModal, setShowBankSettingsModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);

  return (
    <>
      <header className="sticky top-0 z-40 bg-emerald-700 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 pt-2.5 pb-2">
          {/* Top Brand & Actions Bar */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              {currentScreen !== 'HOME' && (
                <button
                  onClick={() => setCurrentScreen('HOME')}
                  className="p-1.5 -ml-1 rounded-lg bg-emerald-800/80 hover:bg-emerald-900 active:scale-95 transition text-white"
                  title="Về trang chủ"
                >
                  <Home className="w-4 h-4" />
                </button>
              )}
              <div
                onClick={() => setCurrentScreen('HOME')}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/15 flex items-center justify-center border border-white/20">
                  <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-200" />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-black tracking-wider leading-none uppercase">
                    ODER CHECKLIST
                  </h1>
                  <p className="text-[9px] sm:text-[10px] text-emerald-200 font-medium">
                    Bán hàng & Giao chung cư
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <PWAInstallButton />

              {/* Cloud Sync (Firebase) Button */}
              <button
                onClick={() => setShowSyncModal(true)}
                className={`p-1.5 rounded-lg transition active:scale-95 flex items-center gap-1 text-xs font-semibold ${
                  firebaseUser
                    ? 'bg-emerald-800 text-emerald-100 hover:bg-emerald-900 ring-1 ring-emerald-400/50'
                    : 'bg-emerald-800/80 hover:bg-emerald-800 text-amber-200'
                }`}
                title={
                  firebaseUser
                    ? `Đã đồng bộ Cloud: ${firebaseUser.email}`
                    : 'Đồng bộ Cloud đa thiết bị (Firebase)'
                }
              >
                {firebaseUser ? (
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </span>
                    <Cloud className="w-3.5 h-3.5 text-emerald-200" />
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <CloudOff className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden sm:inline text-[10px] text-amber-200 font-bold">Cloud</span>
                  </span>
                )}
              </button>

              {/* Notification Bell with Badge */}
              <button
                onClick={() => setShowNotificationModal(true)}
                className="relative p-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100 transition active:scale-95"
                title="Thông báo đơn hàng"
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-emerald-700 animate-pulse">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>

              {/* Quick Order History Button */}
              <button
                onClick={() => setCurrentScreen('ORDER_HISTORY')}
                className={`p-1.5 rounded-lg transition active:scale-95 ${
                  currentScreen === 'ORDER_HISTORY'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100'
                }`}
                title="Lịch sử đơn hàng"
              >
                <History className="w-3.5 h-3.5" />
              </button>

              {/* Customers & Debt Ledger Shortcut */}
              <button
                onClick={() => setCurrentScreen('CUSTOMERS')}
                className={`p-1.5 rounded-lg transition active:scale-95 ${
                  currentScreen === 'CUSTOMERS'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100'
                }`}
                title="Sổ công nợ & Khách quen (Customer Debt Ledger)"
              >
                <Users className="w-3.5 h-3.5" />
              </button>

              {/* Bank Settings & VietQR Modal Button */}
              <button
                onClick={() => setShowBankSettingsModal(true)}
                className="p-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100 transition active:scale-95"
                title="Cài đặt tài khoản ngân hàng & VietQR"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>

              {/* Confirmer User & RBAC Role Badge */}
              <button
                onClick={() => setShowStaffModal(true)}
                className="flex items-center gap-1 sm:gap-1.5 bg-emerald-800/90 hover:bg-emerald-900 text-emerald-100 px-2 py-1.5 rounded-lg text-xs font-semibold border border-emerald-600/60 active:scale-95 transition"
                title={`Người trực ca: ${activeStaff.name} - ${roleConfig.label} (Bấm để đổi ca / phân quyền)`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${roleConfig.dotColor}`}></span>
                <span className="max-w-[65px] sm:max-w-[85px] truncate font-medium">{activeStaff.name.split(' ')[0]}</span>
                <span className="text-[9px] px-1 py-0.2 bg-emerald-950/70 text-emerald-200 rounded font-bold uppercase tracking-wider">
                  {roleConfig.shortLabel}
                </span>
              </button>

              {/* Reset / Demo Scenario Button */}
              <button
                onClick={() => setShowResetConfirm(true)}
                className="p-1.5 rounded-lg bg-emerald-800/60 hover:bg-emerald-800 text-emerald-200 hover:text-white transition"
                title="Khôi phục kịch bản mẫu (MVP Demo)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* GLOBAL SEARCH BAR */}
          <GlobalSearchBar onSelectOrder={(order) => setSelectedOrderForModal(order)} />
        </div>
      </header>

      {/* User Switch Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-1">Chọn người xác nhận</h3>
            <p className="text-xs text-slate-500 mb-3">
              Tên nhân viên sẽ được lưu khi bấm ĐÃ GIAO hoặc ĐÃ THU TIỀN
            </p>
            <div className="space-y-2 mb-4">
              {availableUsers.map((user) => (
                <button
                  key={user}
                  onClick={() => {
                    setCurrentUser(user);
                    setShowUserModal(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition ${
                    currentUser === user
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{user}</span>
                  {currentUser === user && <span className="text-xs bg-emerald-700 px-2 py-0.5 rounded-full">Đang chọn</span>}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 mb-3 space-y-2">
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setShowBankSettingsModal(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 flex items-center justify-center gap-1.5 transition"
              >
                <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cài đặt tài khoản ngân hàng & VietQR</span>
              </button>

              <button
                onClick={() => {
                  setShowUserModal(false);
                  setShowSyncModal(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center justify-center gap-1.5 transition"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {firebaseUser
                    ? `Đồng bộ Cloud (${firebaseUser.email?.split('@')[0]})`
                    : 'Kích hoạt Cloud Sync (Firebase)'}
                </span>
              </button>
            </div>

            <button
              onClick={() => setShowUserModal(false)}
              className="w-full py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Đóng (Close)
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-2">Tải lại kịch bản kiểm thử (MVP Scenario)?</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Thao tác này sẽ nạp lại đầy đủ dữ liệu mẫu theo đúng 14 bước kiểm thử: hàng hóa, tồn kho, đơn B-20-10, B-15-01, B-12-05, đơn khách ngoài và khớp toán tài chính.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  resetToDemoData();
                  setShowResetConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Tải lại ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Center Modal */}
      <NotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrderForModal}
        isOpen={!!selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
      />

      {/* Cloud Sync (Firebase) Modal */}
      <FirebaseSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />

      {/* Staff & Role-Based Access Control Modal */}
      <StaffManagementModal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
      />

      {/* Bank Account Settings Modal */}
      <BankSettingsModal
        isOpen={showBankSettingsModal}
        onClose={() => setShowBankSettingsModal(false)}
      />
    </>
  );
};
