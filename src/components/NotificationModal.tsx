import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bell,
  Rocket,
  CheckCircle,
  X,
  Volume2,
  VolumeX,
  ShieldCheck,
  BellRing,
  Trash2,
  ArrowRight,
  Clock,
  Sparkles,
  Repeat,
  Sliders,
  Calendar,
  Check,
  Play,
  RotateCcw,
} from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} ngày trước`;
  } catch {
    return 'Gần đây';
  }
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose }) => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,
    soundEnabled,
    toggleSound,
    browserNotificationPermission,
    requestNotificationPermission,
    setCurrentScreen,
    setGlobalSearchQuery,
    schedulerConfig,
    updateSchedulerConfig,
    runNotificationSchedulerCheck,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'NOTIFICATIONS' | 'SCHEDULER'>('NOTIFICATIONS');
  const [schedulerRunResult, setSchedulerRunResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    markNotificationAsRead(notif.id);
    onClose();
    if (notif.orderId) {
      setGlobalSearchQuery(notif.orderId);
    }
    if (notif.type === 'READY_FOR_DELIVERY' || notif.type === 'OUT_FOR_DELIVERY_DUE') {
      setCurrentScreen('DELIVERY');
    } else {
      setCurrentScreen('ORDER_HISTORY');
    }
  };

  const handleManualSchedulerCheck = () => {
    const result = runNotificationSchedulerCheck();
    const text = `Đã kiểm tra: ${result.outForDeliveryRemindersCount} đơn quá hạn cần giao, ${result.recurringGeneratedCount} đơn định kỳ đã tạo.`;
    setSchedulerRunResult(text);
    setTimeout(() => setSchedulerRunResult(null), 4000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trung tâm thông báo & Lập lịch"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl flex flex-col max-h-[88vh] overflow-hidden border border-slate-200 animate-scaleUp">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shadow-2xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800">Thông báo & Lập lịch</h3>
                {unreadNotificationCount > 0 && (
                  <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                    {unreadNotificationCount} mới
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Cảnh báo giao hàng & Lập lịch tự động đơn định kỳ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 px-4 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('NOTIFICATIONS')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'NOTIFICATIONS'
                ? 'border-purple-600 text-purple-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Danh sách thông báo ({notifications.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('SCHEDULER')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'SCHEDULER'
                ? 'border-purple-600 text-purple-700 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Bộ lập lịch nhắc nhở (Scheduler)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </button>
        </div>

        {activeTab === 'SCHEDULER' ? (
          /* Scheduler Configuration Panel */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {/* Master Switch */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-black text-slate-900 block">Kích hoạt bộ lập lịch (Scheduler)</span>
                <span className="text-[11px] text-slate-500">
                  Tự động kiểm tra đơn đang giao quá hạn và sinh đơn định kỳ
                </span>
              </div>
              <button
                type="button"
                onClick={() => updateSchedulerConfig({ enabled: !schedulerConfig.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  schedulerConfig.enabled ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    schedulerConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Out for Delivery Due Reminder Config */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      Nhắc nhở đơn "Đang giao" đến hạn (Due Reminder)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Cảnh báo khi shipper đi giao quá thời gian dự kiến
                    </p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={schedulerConfig.remindOnOutForDeliveryDue}
                  onChange={(e) => updateSchedulerConfig({ remindOnOutForDeliveryDue: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
              </div>

              {schedulerConfig.remindOnOutForDeliveryDue && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5 animate-fadeIn">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Mốc thời gian nhắc nhở (Delivery due window):
                  </span>
                  <div className="grid grid-cols-5 gap-1.5 text-xs">
                    {[10, 15, 20, 30, 45].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => updateSchedulerConfig({ outForDeliveryReminderMinutes: mins })}
                        className={`py-1.5 rounded-xl text-center font-black transition active:scale-95 text-xs border ${
                          schedulerConfig.outForDeliveryReminderMinutes === mins
                            ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/20 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {mins}p
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Hệ thống sẽ đổ chuông & thông báo khi đơn giao quá {schedulerConfig.outForDeliveryReminderMinutes} phút.
                  </p>
                </div>
              )}
            </div>

            {/* Recurring Order Generator & Reminder Config */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      Lập lịch đơn định kỳ (Recurring Orders)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Tự động hóa đơn hàng hàng ngày, hàng tuần, hàng tháng
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100 text-xs">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[11px] font-bold text-slate-700">
                    Tự động tạo đơn khi đến ngày giao:
                  </span>
                  <input
                    type="checkbox"
                    checked={schedulerConfig.autoGenerateRecurringOrders}
                    onChange={(e) => updateSchedulerConfig({ autoGenerateRecurringOrders: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[11px] font-bold text-slate-700">
                    Đổ chuông & thông báo khi đơn định kỳ được tạo:
                  </span>
                  <input
                    type="checkbox"
                    checked={schedulerConfig.notifyOnRecurringGenerated}
                    onChange={(e) => updateSchedulerConfig({ notifyOnRecurringGenerated: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                </label>
              </div>
            </div>

            {/* Manual Run Scheduler Button */}
            <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-purple-900 block">Kiểm tra lịch ngay</span>
                  <span className="text-[10px] text-purple-700">
                    Chạy quét ngay các đơn giao quá hạn và đơn định kỳ hôm nay
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleManualSchedulerCheck}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Quét ngay</span>
                </button>
              </div>
              {schedulerRunResult && (
                <div className="p-2 bg-white rounded-xl border border-purple-300 text-[11px] font-bold text-purple-800 animate-fadeIn">
                  {schedulerRunResult}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Normal Notifications Tab */
          <>
            {/* Settings Bar: Push Permission & Sound */}
            <div className="p-3 bg-slate-100/70 border-b border-slate-200/80 space-y-2">
              {/* Browser Push Permission Card */}
              <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                    <BellRing className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-800 text-[11px]">Thông báo đẩy trình duyệt</p>
                    <p className="text-[10px] text-slate-500">
                      {browserNotificationPermission === 'granted'
                        ? 'Đang hoạt động: nhận thông báo ngay cả khi ẩn tab'
                        : 'Bật để không bỏ lỡ đơn mới khi đang làm việc khác'}
                    </p>
                  </div>
                </div>

                {browserNotificationPermission === 'granted' ? (
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1 shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đã bật</span>
                  </span>
                ) : (
                  <button
                    onClick={requestNotificationPermission}
                    className="text-[10px] font-extrabold bg-purple-700 hover:bg-purple-800 text-white px-2.5 py-1 rounded-xl shadow-xs transition active:scale-95 shrink-0 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Cho phép</span>
                  </button>
                )}
              </div>

              {/* Sound alert switch */}
              <div className="flex items-center justify-between px-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-bold text-[11px]">
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Âm thanh chuông báo (Chime sound)</span>
                </div>

                <button
                  onClick={toggleSound}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    soundEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      soundEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Bell className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-600">Chưa có thông báo nào</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Khi có đơn mới tạo, đơn đến hạn giao, hoặc đơn định kỳ sinh mới, bạn sẽ nhận được thông báo tại đây.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const isNew = notif.type === 'NEW_ORDER';
                  const isDue = notif.type === 'OUT_FOR_DELIVERY_DUE';
                  const isRecurring = notif.type === 'RECURRING_ORDER_GENERATED';
                  const isReady = notif.type === 'READY_FOR_DELIVERY';

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`pt-2.5 first:pt-0 cursor-pointer group transition p-2.5 rounded-2xl ${
                        !notif.read ? 'bg-purple-50/60 border border-purple-200/80 shadow-2xs' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isDue
                              ? 'bg-rose-100 text-rose-700 border border-rose-300'
                              : isRecurring
                              ? 'bg-purple-100 text-purple-700 border border-purple-300'
                              : isNew
                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isDue ? (
                            <Clock className="w-4 h-4 text-rose-600" />
                          ) : isRecurring ? (
                            <Repeat className="w-4 h-4 text-purple-600" />
                          ) : isNew ? (
                            <Bell className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Rocket className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.2 rounded-full ${
                                isDue
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : isRecurring
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : isNew
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isDue
                                ? '⏰ Hết giờ giao'
                                : isRecurring
                                ? '🔁 Đơn định kỳ'
                                : isNew
                                ? 'Đơn hàng mới'
                                : 'Sẵn sàng giao'}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span>{formatTimeAgo(notif.timestamp)}</span>
                            </div>
                          </div>

                          <h4 className="text-xs font-black text-slate-800 mt-1">{notif.title}</h4>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{notif.message}</p>

                          <div className="flex items-center gap-1 text-[11px] font-bold text-purple-700 group-hover:text-purple-800 mt-1.5">
                            <span>
                              {isDue
                                ? 'Kiểm tra chuyến giao'
                                : isRecurring
                                ? 'Xem đơn định kỳ'
                                : isNew
                                ? 'Xem đơn hàng'
                                : 'Xem danh sách giao'}
                            </span>
                            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>

                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Actions */}
            {notifications.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                <button
                  onClick={markAllNotificationsAsRead}
                  className="text-[11px] font-bold text-slate-600 hover:text-purple-700 transition flex items-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đã đọc tất cả</span>
                </button>

                <button
                  onClick={clearNotifications}
                  className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa lịch sử</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
