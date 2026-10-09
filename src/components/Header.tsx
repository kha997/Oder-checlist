import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationModal } from './NotificationModal';
import { OrderDetailModal } from './OrderDetailModal';
import { FirebaseSyncModal } from './FirebaseSyncModal';
import { searchOrders, OrderSearchMatch } from '../utils/searchHelper';
import { formatVND } from '../utils/storage';
import { Order } from '../types';
import {
  ClipboardCheck,
  UserCheck,
  RotateCcw,
  Home,
  History,
  Bell,
  Search,
  X,
  Building2,
  MapPin,
  CheckCircle2,
  Clock,
  Rocket,
  Banknote,
  ArrowRight,
  Sparkles,
  Phone,
  FileText,
  SlidersHorizontal,
  Cloud,
  CloudOff,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentUser,
    setCurrentUser,
    availableUsers,
    currentScreen,
    setCurrentScreen,
    resetToDemoData,
    unreadNotificationCount,
    orders,
    globalSearchQuery,
    setGlobalSearchQuery,
    firebaseUser,
    cloudSyncStatus,
  } = useApp();

  // Modals state
  const [showUserModal, setShowUserModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);

  // Search State
  const [searchInput, setSearchInput] = useState(globalSearchQuery || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Keep local search input in sync if globalSearchQuery changes externally
  useEffect(() => {
    if (globalSearchQuery !== searchInput) {
      setSearchInput(globalSearchQuery);
    }
  }, [globalSearchQuery]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Compute live search matches
  const matchingResults: OrderSearchMatch[] = useMemo(() => {
    if (!searchInput.trim()) return [];
    return searchOrders(orders, searchInput);
  }, [orders, searchInput]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    setGlobalSearchQuery(val);
    setIsDropdownOpen(true);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setGlobalSearchQuery('');
    setIsDropdownOpen(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSelectOrder = (order: Order) => {
    setSelectedOrderForModal(order);
    setIsDropdownOpen(false);
  };

  const handleViewAllInHistory = () => {
    setIsDropdownOpen(false);
    setGlobalSearchQuery(searchInput);
    setCurrentScreen('ORDER_HISTORY');
  };

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

              {/* Confirmer User Badge */}
              <button
                onClick={() => setShowUserModal(true)}
                className="flex items-center gap-1 sm:gap-1.5 bg-emerald-800/90 hover:bg-emerald-900 text-emerald-100 px-2 py-1.5 rounded-lg text-xs font-semibold border border-emerald-600/60 active:scale-95 transition"
                title="Đổi nhân viên xác nhận"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span className="max-w-[70px] sm:max-w-[100px] truncate">{currentUser.split(' ')[0]}</span>
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
          <div ref={searchContainerRef} className="relative">
            <div
              className={`relative flex items-center bg-emerald-800/90 hover:bg-emerald-900/90 focus-within:bg-emerald-950 focus-within:ring-2 focus-within:ring-emerald-300 border border-emerald-600/70 rounded-xl transition duration-150 ${
                isDropdownOpen && searchInput.trim() ? 'ring-2 ring-emerald-300 bg-emerald-950' : ''
              }`}
            >
              <Search className="w-4 h-4 text-emerald-300 ml-3 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={handleInputChange}
                onFocus={() => {
                  if (searchInput.trim()) {
                    setIsDropdownOpen(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (matchingResults.length > 0) {
                      handleViewAllInHistory();
                    }
                  } else if (e.key === 'Escape') {
                    setIsDropdownOpen(false);
                    searchInputRef.current?.blur();
                  }
                }}
                placeholder="Tìm kiếm: Tên khách (Hương, Tuấn...) hoặc Mã đơn (ORD-1001)..."
                className="w-full py-1.5 pl-2.5 pr-8 bg-transparent text-xs text-white placeholder-emerald-200/70 focus:outline-none font-medium"
                aria-label="Tìm kiếm đơn hàng toàn hệ thống"
              />

              {searchInput ? (
                <div className="flex items-center gap-1 mr-2 shrink-0">
                  <span className="text-[10px] font-black bg-emerald-700 text-emerald-100 px-1.5 py-0.5 rounded-full">
                    {matchingResults.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="p-1 rounded-full hover:bg-emerald-800 text-emerald-200 hover:text-white transition"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-emerald-300/60 font-semibold mr-2.5 hidden sm:inline-block pointer-events-none select-none">
                  Tìm kiếm toàn cục
                </span>
              )}
            </div>

            {/* LIVE SEARCH RESULTS DROPDOWN */}
            {isDropdownOpen && searchInput.trim().length > 0 && (
              <>
                {/* Backdrop Scrim */}
                <div
                  className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-2xs"
                  onClick={() => setIsDropdownOpen(false)}
                />

                {/* Dropdown Container */}
                <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden max-h-[75vh] flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Dropdown Header */}
                  <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-700 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        Kết quả tìm kiếm cho &ldquo;<strong className="text-indigo-900">{searchInput}</strong>&rdquo;
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                        {matchingResults.length} đơn
                      </span>
                      <button
                        onClick={() => setIsDropdownOpen(false)}
                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md transition"
                        title="Đóng"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Dropdown Results List */}
                  <div className="overflow-y-auto flex-1 p-2 space-y-1.5 divide-y divide-slate-100">
                    {matchingResults.length === 0 ? (
                      /* Empty State */
                      <div className="py-8 px-4 text-center space-y-2">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                          <Search className="w-6 h-6" />
                        </div>
                        <h4 className="font-extrabold text-slate-800 text-xs">
                          Không tìm thấy đơn hàng nào!
                        </h4>
                        <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                          Không có đơn hàng nào có tên khách hoặc mã đơn khớp với &ldquo;<strong>{searchInput}</strong>&rdquo;.
                        </p>
                        <p className="text-[10px] text-slate-400 italic pt-1">
                          Gợi ý: Thử tìm theo &ldquo;ORD&rdquo;, &ldquo;1001&rdquo;, tên khách (&ldquo;Hương&rdquo;, &ldquo;Tuấn&rdquo;), hoặc số phòng (&ldquo;B-20&rdquo;).
                        </p>
                        <button
                          type="button"
                          onClick={handleClearSearch}
                          className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                        >
                          Xóa tìm kiếm
                        </button>
                      </div>
                    ) : (
                      /* List of Matched Orders */
                      matchingResults.map(({ order, matchType }) => {
                        const isDelivered = order.deliveryStatus === 'DELIVERED';
                        const isReady = order.deliveryStatus === 'READY_FOR_DELIVERY';
                        const isPaid = order.paymentStatus === 'PAID';

                        return (
                          <div
                            key={order.id}
                            onClick={() => handleSelectOrder(order)}
                            className="pt-1.5 first:pt-0 p-2.5 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200 transition cursor-pointer group active:scale-[0.99]"
                          >
                            {/* Row 1: ID, Match Reason & Status Badges */}
                            <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-xs text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md font-mono">
                                  {order.id}
                                </span>

                                {/* Match tag */}
                                <span
                                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                                    matchType === 'CUSTOMER_NAME'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : matchType === 'ID'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : matchType === 'PHONE'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}
                                >
                                  {matchType === 'CUSTOMER_NAME'
                                    ? 'Khớp tên khách'
                                    : matchType === 'ID'
                                    ? 'Khớp mã đơn'
                                    : matchType === 'PHONE'
                                    ? 'Khớp SĐT'
                                    : 'Khớp địa chỉ'}
                                </span>

                                {order.priority && (
                                  <span
                                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${
                                      order.priority === 'HIGH'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : order.priority === 'LOW'
                                        ? 'bg-slate-100 text-slate-600'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}
                                  >
                                    {order.priority === 'HIGH' ? 'Ưu tiên Cao' : order.priority === 'LOW' ? 'Thấp' : 'Ưu tiên TB'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 text-[10px] font-black">
                                <span
                                  className={`px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                                    isDelivered
                                      ? 'bg-blue-100 text-blue-800'
                                      : isReady
                                      ? 'bg-emerald-100 text-emerald-800 font-extrabold'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {isDelivered ? (
                                    <>
                                      <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" />
                                      <span>Đã giao</span>
                                    </>
                                  ) : isReady ? (
                                    <>
                                      <Rocket className="w-2.5 h-2.5 text-emerald-600" />
                                      <span>Sẵn sàng</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-2.5 h-2.5 text-amber-600" />
                                      <span>Chờ giao</span>
                                    </>
                                  )}
                                </span>

                                <span
                                  className={`px-1.5 py-0.5 rounded-md ${
                                    isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {isPaid ? '✓ Đã thu' : 'Chưa thu'}
                                </span>
                              </div>
                            </div>

                            {/* Row 2: Customer Name, Phone & Address */}
                            <div className="flex items-start justify-between gap-2 text-xs">
                              <div>
                                <p className="font-extrabold text-slate-900 group-hover:text-emerald-800 transition">
                                  {order.customerName}
                                  {order.customerPhone && (
                                    <span className="text-slate-500 font-normal ml-1.5">
                                      ({order.customerPhone})
                                    </span>
                                  )}
                                </p>
                                <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-0.5">
                                  {order.location.type === 'condo' ? (
                                    <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  ) : (
                                    <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                                  )}
                                  <span className="font-semibold">{order.location.formattedAddress}</span>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-black text-slate-900 text-sm font-mono block">
                                  {formatVND(order.totalAmount)}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {order.items.reduce((s, i) => s + i.quantity, 0)} phần
                                </span>
                              </div>
                            </div>

                            {/* Row 3: Items preview */}
                            <p className="text-[10px] text-slate-500 truncate mt-1">
                              {order.items.map((i) => `${i.productName} x${i.quantity}`).join(', ')}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  {matchingResults.length > 0 && (
                    <div className="p-2 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs shrink-0">
                      <span className="text-[11px] text-slate-500">
                        Bấm vào đơn để xem chi tiết & thao tác
                      </span>
                      <button
                        onClick={handleViewAllInHistory}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 transition shadow-sm"
                      >
                        <span>Xem trong Lịch sử</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
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

            <div className="pt-2 border-t border-slate-100 mb-3">
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
    </>
  );
};
