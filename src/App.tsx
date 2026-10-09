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

const MainContent: React.FC = () => {
  const { currentScreen } = useApp();

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
