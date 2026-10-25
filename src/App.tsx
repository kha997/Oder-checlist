/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { NotificationToast } from './components/NotificationToast';
import { ShieldAlert, ArrowRight, Clock, UserPlus, RefreshCw, Store, Hourglass } from 'lucide-react';
import { requestStaffAccess } from './firebase/firestoreService';
import { OnboardingModal } from './components/OnboardingModal';

// Screens are large and mutually exclusive — only one is mounted at a time, so
// each is loaded on demand. Combined with the vendor chunking in vite.config.ts
// this keeps the first-paint payload to the shell + HomeScreen instead of the
// whole application (~2.1 MB pre-split).
const lazyScreen = (
  load: () => Promise<{ default: React.ComponentType }>
): React.LazyExoticComponent<React.ComponentType> => React.lazy(load);

const HomeScreen = lazyScreen(() =>
  import('./components/HomeScreen').then((m) => ({ default: m.HomeScreen }))
);
const CreateOrderScreen = lazyScreen(() =>
  import('./components/CreateOrderScreen').then((m) => ({ default: m.CreateOrderScreen }))
);
const DeliveryModeScreen = lazyScreen(() =>
  import('./components/DeliveryModeScreen').then((m) => ({ default: m.DeliveryModeScreen }))
);
const UnpaidScreen = lazyScreen(() =>
  import('./components/UnpaidScreen').then((m) => ({ default: m.UnpaidScreen }))
);
const InventoryScreen = lazyScreen(() =>
  import('./components/InventoryScreen').then((m) => ({ default: m.InventoryScreen }))
);
const ReportScreen = lazyScreen(() =>
  import('./components/ReportScreen').then((m) => ({ default: m.ReportScreen }))
);
const OrderHistoryScreen = lazyScreen(() =>
  import('./components/OrderHistoryScreen').then((m) => ({ default: m.OrderHistoryScreen }))
);
const CustomersScreen = lazyScreen(() =>
  import('./components/CustomersScreen').then((m) => ({ default: m.CustomersScreen }))
);

/** Shown while a screen chunk is being fetched/compiled. */
const ScreenFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-16 gap-3" role="status">
    <div className="w-8 h-8 rounded-full border-[3px] border-emerald-200 border-t-emerald-600 animate-spin" />
    <span className="text-xs font-semibold text-slate-500">Đang tải màn hình...</span>
  </div>
);

const MainContent: React.FC = () => {
  const { currentScreen, setCurrentScreen, canAccessScreen, activeStaff, roleConfig } = useApp();

  if (!canAccessScreen(currentScreen)) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-md text-center">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-600">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Giới hạn quyền truy cập (Access Restricted)
        </h3>
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          Tài khoản <strong>{activeStaff.name}</strong> đang có vai trò{' '}
          <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded border ${roleConfig.badgeClass}`}>
            {roleConfig.label}
          </span>
          , không có quyền thao tác trên mục này.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => setCurrentScreen(roleConfig.allowedScreens[0] || 'HOME')}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>Về màn hình làm việc của bạn</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-3.5 sm:px-4 pt-3.5 pb-20">
      <Suspense fallback={<ScreenFallback />}>
        {currentScreen === 'HOME' && <HomeScreen />}
        {currentScreen === 'CREATE_ORDER' && <CreateOrderScreen />}
        {currentScreen === 'DELIVERY' && <DeliveryModeScreen />}
        {currentScreen === 'UNPAID' && <UnpaidScreen />}
        {currentScreen === 'INVENTORY' && <InventoryScreen />}
        {currentScreen === 'REPORT' && <ReportScreen />}
        {currentScreen === 'ORDER_HISTORY' && <OrderHistoryScreen />}
        {currentScreen === 'CUSTOMERS' && <CustomersScreen />}
      </Suspense>
    </main>
  );
};

const AppShell: React.FC = () => {
  const {
    cloudSyncStatus,
    firebaseUser,
    tenancyMode,
    shopStatus,
    currentShop,
    onboardingVisible,
    showOnboarding,
  } = useApp();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!firebaseUser || resending) return;
    setResending(true);
    try {
      await requestStaffAccess({
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        displayName: firebaseUser.displayName ?? firebaseUser.email ?? '',
        requestedAt: new Date().toISOString(),
      });
      alert('Đã gửi lại yêu cầu truy cập. Vui lòng chờ chủ quán duyệt.');
    } catch (err) {
      console.error('Failed to resend access request:', err);
      alert('Không thể gửi lại yêu cầu. Vui lòng thử lại sau.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white print-active-host">
      <Header />
      {/* Legacy (single-tenant) flow: server role pending. Never fires in
          tenancy mode — there the equivalent states are the two banners below. */}
      {cloudSyncStatus === 'needs_role' && tenancyMode !== 'tenancy' && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-2xl mx-auto px-3.5 sm:px-4 py-2 flex items-center gap-2 text-xs text-amber-900">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="flex-1 leading-relaxed">
              <strong>Tài khoản chưa được phân quyền.</strong> Đã gửi yêu cầu truy cập.
              Vui lòng nhờ chủ quán duyệt trong{' '}
              <span className="inline-flex items-center gap-1 font-semibold">
                <UserPlus className="w-3 h-3" />
                Quản lý nhân viên → Phân quyền truy cập
              </span>
              . App vẫn hoạt động cục bộ.
            </p>
            <button
              onClick={handleResend}
              disabled={resending || !firebaseUser}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-300 bg-white/70 hover:bg-white text-amber-900 font-semibold disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
              {resending ? 'Đang gửi...' : 'Gửi lại yêu cầu'}
            </button>
          </div>
        </div>
      )}
      {/* P3 tenancy: no shop yet → self-serve onboarding entry point. */}
      {tenancyMode === 'tenancy' && shopStatus === 'none' && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-2xl mx-auto px-3.5 sm:px-4 py-2 flex items-center gap-2 text-xs text-amber-900">
            <Store className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="flex-1 leading-relaxed">
              <strong>Chưa có cửa hàng.</strong> Dữ liệu đang chỉ lưu trên máy này — tạo cửa
              hàng để đồng bộ Cloud, hoặc tham gia cửa hàng khác bằng mã mời.
            </p>
            <button
              onClick={showOnboarding}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-300 bg-white/70 hover:bg-white text-amber-900 font-semibold shrink-0"
            >
              <Store className="w-3 h-3" /> Tạo / Tham gia
            </button>
          </div>
        </div>
      )}
      {/* P3 tenancy: join requested → waiting for an admin's approval. */}
      {tenancyMode === 'tenancy' && shopStatus === 'pending' && (
        <div className="bg-sky-50 border-b border-sky-200">
          <div className="max-w-2xl mx-auto px-3.5 sm:px-4 py-2 flex items-center gap-2 text-xs text-sky-900">
            <Hourglass className="w-4 h-4 text-sky-600 shrink-0" />
            <p className="flex-1 leading-relaxed">
              <strong>
                Đang chờ duyệt tham gia{currentShop ? ` “${currentShop.name}”` : ''}.
              </strong>{' '}
              Quản trị viên cần chấp nhận trước khi dữ liệu cửa hàng hiển thị. App vẫn hoạt
              động cục bộ.
            </p>
            <button
              onClick={showOnboarding}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-sky-300 bg-white/70 hover:bg-white text-sky-900 font-semibold shrink-0"
            >
              <Store className="w-3 h-3" /> Tạo cửa hàng riêng
            </button>
          </div>
        </div>
      )}
      <OnboardingModal isOpen={onboardingVisible} />
      <NotificationToast />
      <div className="flex-1">
        <MainContent />
      </div>
      <BottomNav />
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
