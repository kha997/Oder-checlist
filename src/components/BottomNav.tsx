import React from 'react';
import { useApp } from '../context/AppContext';
import { ScreenType } from '../types';
import { Home, PlusCircle, Bike, Wallet, BarChart3, Boxes, History } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { currentScreen, setCurrentScreen, orders } = useApp();

  const pendingDeliveryCount = orders.filter(
    (o) => o.status === 'ACTIVE' && o.deliveryStatus !== 'DELIVERED'
  ).length;

  const unpaidCount = orders.filter(
    (o) => o.status === 'ACTIVE' && o.paymentStatus === 'UNPAID'
  ).length;

  const navItems: { screen: ScreenType; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { screen: 'HOME', label: 'Trang chủ', icon: Home },
    { screen: 'CREATE_ORDER', label: 'Tạo đơn', icon: PlusCircle },
    { screen: 'DELIVERY', label: 'Giao hàng', icon: Bike, badge: pendingDeliveryCount },
    { screen: 'UNPAID', label: 'Chưa thu', icon: Wallet, badge: unpaidCount },
    { screen: 'INVENTORY', label: 'Kho hàng', icon: Boxes },
    { screen: 'ORDER_HISTORY', label: 'Lịch sử', icon: History },
    { screen: 'REPORT', label: 'Báo cáo', icon: BarChart3 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
      <div className="max-w-2xl mx-auto px-1 py-1 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.screen;
          return (
            <button
              key={item.screen}
              onClick={() => setCurrentScreen(item.screen)}
              className={`relative flex flex-col items-center justify-center py-1 px-1 sm:px-1.5 rounded-xl transition ${
                isActive
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? 'scale-110 text-emerald-600' : ''} transition-transform`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] sm:text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-0.5"></span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
