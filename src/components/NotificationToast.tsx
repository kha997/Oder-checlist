import React from 'react';
import { useApp } from '../context/AppContext';
import { Bell, Rocket, X, ArrowRight, Volume2, VolumeX, Clock, Repeat, AlertTriangle } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const {
    activeToastNotification,
    dismissToastNotification,
    setCurrentScreen,
    markNotificationAsRead,
    soundEnabled,
    toggleSound,
    setGlobalSearchQuery,
  } = useApp();

  if (!activeToastNotification) return null;

  const type = activeToastNotification.type;
  const isDue = type === 'OUT_FOR_DELIVERY_DUE';
  const isRecurring = type === 'RECURRING_ORDER_GENERATED';
  const isReady = type === 'READY_FOR_DELIVERY';
  const isNew = type === 'NEW_ORDER';

  const handleAction = () => {
    markNotificationAsRead(activeToastNotification.id);
    dismissToastNotification();
    if (activeToastNotification.orderId) {
      setGlobalSearchQuery(activeToastNotification.orderId);
    }
    if (isDue || isReady) {
      setCurrentScreen('DELIVERY');
    } else {
      setCurrentScreen('ORDER_HISTORY');
    }
  };

  return (
    <aside
      aria-label="Thông báo đơn hàng"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md animate-slideDown"
    >
      <div
        className={`rounded-2xl p-3.5 shadow-2xl border backdrop-blur-md transition-all ${
          isDue
            ? 'bg-rose-950/95 text-white border-rose-500/50 shadow-rose-900/30 ring-1 ring-rose-500/30'
            : isRecurring
            ? 'bg-purple-950/95 text-white border-purple-400/50 shadow-purple-900/30 ring-1 ring-purple-400/30'
            : isReady
            ? 'bg-emerald-950/95 text-white border-emerald-500/40 shadow-emerald-900/30'
            : 'bg-slate-900/95 text-white border-purple-500/40 shadow-purple-900/30'
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                isDue
                  ? 'bg-rose-600 text-white ring-2 ring-rose-400/40 animate-pulse'
                  : isRecurring
                  ? 'bg-purple-600 text-white ring-2 ring-purple-300/40'
                  : isReady
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/40'
                  : 'bg-indigo-600 text-white ring-2 ring-indigo-400/40'
              }`}
            >
              {isDue ? (
                <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
              ) : isRecurring ? (
                <Repeat className="w-5 h-5" />
              ) : isReady ? (
                <Rocket className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5 animate-bounce" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.2 rounded-full ${
                    isDue
                      ? 'bg-rose-500/40 text-rose-200 border border-rose-400/40'
                      : isRecurring
                      ? 'bg-purple-500/40 text-purple-200 border border-purple-400/40'
                      : isReady
                      ? 'bg-emerald-500/30 text-emerald-300'
                      : 'bg-indigo-500/30 text-indigo-300'
                  }`}
                >
                  {isDue
                    ? '⏰ Hết giờ giao hàng'
                    : isRecurring
                    ? '🔁 Đơn định kỳ mới'
                    : isReady
                    ? '🚀 Sẵn sàng giao'
                    : '🔔 Đơn hàng mới'}
                </span>
                <span className="text-[10px] text-slate-400">Vừa xong</span>
              </div>

              <h4 className="text-xs font-black truncate mt-0.5 text-white">
                {activeToastNotification.title}
              </h4>
              <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                {activeToastNotification.message}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-white/10">
                <button
                  onClick={handleAction}
                  className={`text-[11px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 transition active:scale-95 ${
                    isDue
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
                      : isRecurring
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-xs'
                      : isReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                  }`}
                >
                  <span>
                    {isDue
                      ? 'Kiểm tra giao hàng'
                      : isRecurring
                      ? 'Xem đơn định kỳ'
                      : isReady
                      ? 'Mở danh sách giao'
                      : 'Xem chi tiết đơn'}
                  </span>
                  <ArrowRight className="w-3 h-3" />
                </button>

                <button
                  onClick={toggleSound}
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition"
                  title={soundEnabled ? 'Tắt âm thanh chuông' : 'Bật âm thanh chuông'}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={dismissToastNotification}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition shrink-0 -mr-1 -mt-1"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
