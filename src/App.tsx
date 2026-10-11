/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { CreateOrderScreen } from './components/CreateOrderScreen';
import { DeliveryModeScreen } from './components/DeliveryModeScreen';
import { UnpaidScreen } from './components/UnpaidScreen';
import { InventoryScreen } from './components/InventoryScreen';
import { ReportScreen } from './components/ReportScreen';
import { OrderHistoryScreen } from './components/OrderHistoryScreen';
import { CustomersScreen } from './components/CustomersScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { NotificationToast } from './components/NotificationToast';
import { ShieldAlert, ArrowRight } from 'lucide-react';

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
      {currentScreen === 'HOME' && <HomeScreen />}
      {currentScreen === 'CREATE_ORDER' && <CreateOrderScreen />}
      {currentScreen === 'DELIVERY' && <DeliveryModeScreen />}
      {currentScreen === 'UNPAID' && <UnpaidScreen />}
      {currentScreen === 'INVENTORY' && <InventoryScreen />}
      {currentScreen === 'REPORT' && <ReportScreen />}
      {currentScreen === 'ORDER_HISTORY' && <OrderHistoryScreen />}
      {currentScreen === 'CUSTOMERS' && <CustomersScreen />}
    </main>
  );
};

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-slate-100/90 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white print-active-host">
        <Header />
        <NotificationToast />
        <div className="flex-1">
          <MainContent />
        </div>
        <BottomNav />
        <OfflineIndicator />
      </div>
    </AppProvider>
  );
}
