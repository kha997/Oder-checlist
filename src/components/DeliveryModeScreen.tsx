import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { Order, PREDEFINED_ORDER_TAGS, OrderPriority } from '../types';
import { ExportOrderReportModal } from './ExportOrderReportModal';
import { RouteMapView } from './RouteMapView';
import { OrderDetailModal } from './OrderDetailModal';
import { ProofOfDeliveryCameraModal } from './ProofOfDeliveryCameraModal';
import { getOrderDeliveryDueStatus } from '../utils/notificationScheduler';
import {
  ArrowLeft,
  Truck,
  Building2,
  CheckCircle2,
  Phone,
  FileText,
  Clock,
  UserCheck,
  MapPin,
  Sparkles,
  Search,
  X,
  Filter,
  AlertCircle,
  AlertTriangle,
  SlidersHorizontal,
  Lock,
  CheckSquare,
  Square,
  PackageCheck,
  Layers,
  Tag,
  Rocket,
  Camera,
  Printer,
  FileDown,
  Route as RouteIcon,
} from 'lucide-react';

export const DeliveryModeScreen: React.FC = () => {
  const { condos, orders, markReadyForDelivery, markDelivered, markMultipleDelivered, currentUser, setCurrentScreen, schedulerConfig } = useApp();

  // Mode: condo vs external
  const [activeTab, setActiveTab] = useState<'condo' | 'external'>('condo');

  // Delivery View Mode: List vs Route Map
  const [deliveryViewMode, setDeliveryViewMode] = useState<'LIST' | 'ROUTE_MAP'>('LIST');
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [podModalOrder, setPodModalOrder] = useState<Order | null>(null);

  // Selected Condo & Block
  const [selectedCondoId, setSelectedCondoId] = useState(condos[0]?.id || '');
  const [selectedBlock, setSelectedBlock] = useState('B');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | OrderPriority>('ALL');
  const [hasNoteOnly, setHasNoteOnly] = useState(false);
  const [searchAllBlocks, setSearchAllBlocks] = useState(false);

  // History modal / toggle
  const [showHistory, setShowHistory] = useState(false);
  const [lastDeliveredNotice, setLastDeliveredNotice] = useState<string | null>(null);

  // Bulk Delivery Selection State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const [isPrintManifestOpen, setIsPrintManifestOpen] = useState(false);

  const activeCondo = condos.find((c) => c.id === selectedCondoId) || condos[0];

  // Active Pending Orders (Both PENDING preparation and READY_FOR_DELIVERY)
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'ACTIVE' && o.deliveryStatus !== 'DELIVERED'),
    [orders]
  );

  // Delivered Orders (for history)
  const deliveredOrders = useMemo(
    () => orders.filter((o) => o.status === 'ACTIVE' && o.deliveryStatus === 'DELIVERED'),
    [orders]
  );

  // Match helper
  const filterPredicate = (o: Order) => {
    // Payment filter
    if (paymentFilter === 'UNPAID' && o.paymentStatus !== 'UNPAID') return false;
    if (paymentFilter === 'PAID' && o.paymentStatus !== 'PAID') return false;

    // Priority filter
    if (priorityFilter !== 'ALL' && (o.priority || 'MEDIUM') !== priorityFilter) return false;

    // Note filter
    if (hasNoteOnly && !o.location.deliveryNote && !o.note && !o.internalNote) return false;

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = o.customerName.toLowerCase().includes(q);
    const addrMatch = o.location.formattedAddress.toLowerCase().includes(q);
    const extMatch = (o.location.externalAddress || '').toLowerCase().includes(q);
    const condoMatch = (o.location.condoName || '').toLowerCase().includes(q);
    const blockMatch = (o.location.block || '').toLowerCase().includes(q);
    const floorMatch = (o.location.floor || '').includes(q);
    const unitMatch = (o.location.unit || '').includes(q);
    const phoneMatch = (o.customerPhone || '').includes(q);
    const idMatch = o.id.toLowerCase().includes(q);
    const noteMatch = (o.location.deliveryNote || '').toLowerCase().includes(q) || (o.internalNote || '').toLowerCase().includes(q);
    const deliveredByMatch = (o.deliveredBy || '').toLowerCase().includes(q);

    return (
      nameMatch ||
      addrMatch ||
      extMatch ||
      condoMatch ||
      blockMatch ||
      floorMatch ||
      unitMatch ||
      phoneMatch ||
      idMatch ||
      noteMatch ||
      deliveredByMatch
    );
  };

  // Condo pending orders for the selected block (or all blocks if searchAllBlocks is checked when searching)
  const condoBlockPendingOrders = useMemo(() => {
    return pendingOrders
      .filter((o) => {
        if (o.location.type !== 'condo') return false;

        // Condo selection check
        if (activeCondo && o.location.condoName && o.location.condoName !== activeCondo.name) {
          return false;
        }

        // Block check: unless searchAllBlocks is enabled and user is actively searching
        if (!searchAllBlocks || !searchQuery.trim()) {
          if (o.location.block?.toUpperCase() !== selectedBlock.toUpperCase()) {
            return false;
          }
        }

        return filterPredicate(o);
      })
      .sort((a, b) => {
        // If user defined a custom deliverySequenceIndex via Route Map, respect that order
        if (a.deliverySequenceIndex !== undefined && b.deliverySequenceIndex !== undefined) {
          return a.deliverySequenceIndex - b.deliverySequenceIndex;
        }
        if (a.deliverySequenceIndex !== undefined) return -1;
        if (b.deliverySequenceIndex !== undefined) return 1;

        // If from different blocks in all-blocks search, group by block first
        if (searchAllBlocks && searchQuery.trim() && a.location.block !== b.location.block) {
          return (a.location.block || '').localeCompare(b.location.block || '');
        }

        // Sort FLOOR numerically highest to lowest: 20 -> 15 -> 12
        const floorA = parseInt(a.location.floor || '0', 10);
        const floorB = parseInt(b.location.floor || '0', 10);

        if (floorA !== floorB) {
          return floorB - floorA; // Highest to lowest
        }

        // Same floor: sort UNIT ascending: 01 -> 05 -> 10
        const unitA = parseInt(a.location.unit || '0', 10);
        const unitB = parseInt(b.location.unit || '0', 10);

        if (!isNaN(unitA) && !isNaN(unitB) && unitA !== unitB) {
          return unitA - unitB;
        }
        return (a.location.unit || '').localeCompare(b.location.unit || '');
      });
  }, [pendingOrders, activeCondo, selectedBlock, searchAllBlocks, searchQuery, paymentFilter, priorityFilter, hasNoteOnly]);

  // External pending orders filtered
  const externalPendingOrders = useMemo(() => {
    return pendingOrders
      .filter((o) => o.location.type === 'external')
      .filter(filterPredicate)
      .sort((a, b) => {
        if (a.deliverySequenceIndex !== undefined && b.deliverySequenceIndex !== undefined) {
          return a.deliverySequenceIndex - b.deliverySequenceIndex;
        }
        if (a.deliverySequenceIndex !== undefined) return -1;
        if (b.deliverySequenceIndex !== undefined) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [pendingOrders, searchQuery, paymentFilter, priorityFilter, hasNoteOnly]);

  // Filtered Delivered Orders (for history)
  const filteredDeliveredOrders = useMemo(() => {
    return deliveredOrders.filter(filterPredicate);
  }, [deliveredOrders, searchQuery, paymentFilter, priorityFilter, hasNoteOnly]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() || paymentFilter !== 'ALL' || priorityFilter !== 'ALL' || hasNoteOnly || searchAllBlocks
  );

  const resetFilters = () => {
    setSearchQuery('');
    setPaymentFilter('ALL');
    setPriorityFilter('ALL');
    setHasNoteOnly(false);
    setSearchAllBlocks(false);
    setSelectedOrderIds([]);
  };

  const handleDeliver = (orderId: string, address: string) => {
    markDelivered(orderId);
    setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
    setLastDeliveredNotice(`Đã giao xong căn ${address} (xác nhận bởi ${currentUser})`);
    setTimeout(() => {
      setLastDeliveredNotice(null);
    }, 4000);
  };

  // Current visible orders based on active tab and search/filter
  const currentVisibleOrders = useMemo(() => {
    if (showHistory) return [];
    return activeTab === 'condo' ? condoBlockPendingOrders : externalPendingOrders;
  }, [showHistory, activeTab, condoBlockPendingOrders, externalPendingOrders]);

  // Selected orders detail
  const selectedOrders = useMemo(() => {
    return orders.filter(
      (o) => o.status === 'ACTIVE' && o.deliveryStatus === 'PENDING' && selectedOrderIds.includes(o.id)
    );
  }, [orders, selectedOrderIds]);

  const isAllVisibleSelected =
    currentVisibleOrders.length > 0 &&
    currentVisibleOrders.every((o) => selectedOrderIds.includes(o.id));

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      const visibleIdSet = new Set(currentVisibleOrders.map((o) => o.id));
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleIdSet.has(id)));
    } else {
      const newSet = new Set(selectedOrderIds);
      currentVisibleOrders.forEach((o) => newSet.add(o.id));
      setSelectedOrderIds(Array.from(newSet));
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const clearSelection = () => {
    setSelectedOrderIds([]);
  };

  const handleExecuteBulkDelivery = () => {
    if (selectedOrderIds.length === 0) return;
    const count = selectedOrderIds.length;
    markMultipleDelivered(selectedOrderIds);
    setLastDeliveredNotice(`Đã giao thành công ${count} đơn hàng cùng lúc (xác nhận bởi ${currentUser})`);
    setSelectedOrderIds([]);
    setShowBulkConfirmModal(false);
    setTimeout(() => {
      setLastDeliveredNotice(null);
    }, 4500);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentScreen('HOME')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>
        <div className="text-center">
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">
            CHẾ ĐỘ GIAO HÀNG
          </h2>
          <p className="text-[10px] text-slate-500 font-medium">Sắp xếp tối ưu từ tầng cao xuống thấp</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPrintManifestOpen(true)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition active:scale-95 flex items-center gap-1"
            title="In bảng kê / lộ trình giao hàng ra PDF hoặc giấy"
          >
            <Printer className="w-3.5 h-3.5 text-rose-100" />
            <span className="hidden sm:inline">In lộ trình (PDF)</span>
          </button>
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              clearSelection();
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
              showHistory ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Lịch sử ({deliveredOrders.length})
          </button>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {lastDeliveredNotice && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-lg flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>{lastDeliveredNotice}</span>
          </div>
          <button
            onClick={() => setLastDeliveredNotice(null)}
            className="text-emerald-200 hover:text-white text-[11px] underline ml-2"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Primary Delivery View Toggle: LIST vs ROUTE MAP */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/90 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setDeliveryViewMode('LIST');
            setShowHistory(false);
          }}
          className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
            deliveryViewMode === 'LIST' && !showHistory
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>DANH SÁCH GIAO ({pendingOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDeliveryViewMode('ROUTE_MAP');
            setShowHistory(false);
          }}
          className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
            deliveryViewMode === 'ROUTE_MAP' && !showHistory
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-400/40'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <RouteIcon className="w-4 h-4" />
          <span>BẢN ĐỒ LỘ TRÌNH (ROUTE MAP)</span>
          <span className="text-[10px] bg-amber-400 text-amber-950 font-black px-1.5 py-0.2 rounded-full">Kéo thả</span>
        </button>
      </div>

      {deliveryViewMode === 'ROUTE_MAP' && !showHistory ? (
        <RouteMapView
          onOpenDetailModal={(order) => setSelectedOrderForDetail(order)}
          onOpenPrintManifest={() => setIsPrintManifestOpen(true)}
        />
      ) : (
        <>
          {/* Location Type Tabs: Apartment vs External */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/80 rounded-2xl">
        <button
          onClick={() => {
            setActiveTab('condo');
            setShowHistory(false);
            clearSelection();
          }}
          className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
            activeTab === 'condo' && !showHistory
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>GIAO CHUNG CƯ ({pendingOrders.filter((o) => o.location.type === 'condo').length})</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('external');
            setShowHistory(false);
            clearSelection();
          }}
          className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
            activeTab === 'external' && !showHistory
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>KHÁCH NGOÀI ({externalPendingOrders.length})</span>
        </button>
      </div>

      {/* CONDO FILTER BAR (WHEN IN CONDO TAB) */}
      {activeTab === 'condo' && !showHistory && (
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 space-y-2.5">
          {/* Condo dropdown */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={selectedCondoId}
              onChange={(e) => {
                setSelectedCondoId(e.target.value);
                clearSelection();
                const found = condos.find((c) => c.id === e.target.value);
                if (found && found.blocks.length > 0) {
                  setSelectedBlock(found.blocks[0]);
                }
              }}
              className="flex-1 py-1.5 px-3 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
            >
              {condos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Block Selection Pills */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Chọn Block đang giao:
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                Block {selectedBlock}: {condoBlockPendingOrders.length} đơn chờ
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeCondo?.blocks.map((b) => {
                const countForBlock = pendingOrders.filter(
                  (o) =>
                    o.location.type === 'condo' &&
                    o.location.block?.toUpperCase() === b.toUpperCase() &&
                    (!activeCondo || !o.location.condoName || o.location.condoName === activeCondo.name)
                ).length;

                const isSelected = selectedBlock === b;
                return (
                  <button
                    key={b}
                    onClick={() => {
                      setSelectedBlock(b);
                      clearSelection();
                    }}
                    className={`relative min-w-[54px] py-2 px-3 rounded-xl font-black text-sm transition active:scale-95 flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-600 ring-offset-2'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{b}</span>
                    {countForBlock > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                          isSelected ? 'bg-white text-blue-700' : 'bg-rose-500 text-white'
                        }`}
                      >
                        {countForBlock}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SEARCH & FILTER BAR */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 space-y-2.5">
        {/* Search input with icon and clear button */}
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng hoặc địa chỉ (e.g. Mai, B-20-10, Lê Lợi)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder:text-slate-400 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 p-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 transition"
              title="Xóa từ khóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills row */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5 text-xs">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5">
              <Filter className="w-3 h-3 text-slate-500" />
              Lọc:
            </span>

            {/* Payment filter pills */}
            <button
              onClick={() => setPaymentFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition active:scale-95 ${
                paymentFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setPaymentFilter('UNPAID')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition active:scale-95 ${
                paymentFilter === 'UNPAID'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/70'
              }`}
            >
              <span>⚠️ Chưa thu</span>
            </button>
            <button
              onClick={() => setPaymentFilter('PAID')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition active:scale-95 ${
                paymentFilter === 'PAID'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/70'
              }`}
            >
              <span>✓ Đã thu</span>
            </button>

            {/* Note filter toggle */}
            <button
              onClick={() => setHasNoteOnly(!hasNoteOnly)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 active:scale-95 ${
                hasNoteOnly
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Có ghi chú</span>
            </button>
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-[11px] font-bold text-rose-600 hover:underline shrink-0 ml-1.5 flex items-center gap-0.5"
            >
              <X className="w-3 h-3" />
              <span>Xóa lọc</span>
            </button>
          )}
        </div>

        {/* Priority Filter Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-slate-100 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5 shrink-0">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Ưu tiên:
          </span>
          <button
            onClick={() => setPriorityFilter('ALL')}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition active:scale-95 shrink-0 ${
              priorityFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setPriorityFilter('HIGH')}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition active:scale-95 shrink-0 ${
              priorityFilter === 'HIGH'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <span>🔥 Cao</span>
            <span className="text-[9px] bg-white/20 px-1 rounded-full">
              {pendingOrders.filter((o) => o.priority === 'HIGH').length}
            </span>
          </button>
          <button
            onClick={() => setPriorityFilter('MEDIUM')}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition active:scale-95 shrink-0 ${
              priorityFilter === 'MEDIUM'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <span>⚡ TB</span>
          </button>
          <button
            onClick={() => setPriorityFilter('LOW')}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition active:scale-95 shrink-0 ${
              priorityFilter === 'LOW'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>💤 Thấp</span>
          </button>
        </div>

        {/* Search across all blocks option (when in condo mode & searching) */}
        {activeTab === 'condo' && !showHistory && searchQuery.trim() && (
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-semibold select-none">
              <input
                type="checkbox"
                checked={searchAllBlocks}
                onChange={(e) => setSearchAllBlocks(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span>Tìm trên tất cả các Block</span>
            </label>
            <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
              Khớp {condoBlockPendingOrders.length} đơn
            </span>
          </div>
        )}

        {/* Active search/filter status line */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            <span>
              Tìm thấy:{' '}
              <strong className="text-slate-900 font-bold">
                {showHistory
                  ? filteredDeliveredOrders.length
                  : activeTab === 'condo'
                  ? condoBlockPendingOrders.length
                  : externalPendingOrders.length}{' '}
                đơn hàng
              </strong>
            </span>
            {searchQuery.trim() && (
              <span className="truncate max-w-[160px]">
                Khóa: <strong className="text-blue-700 font-bold">"{searchQuery}"</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* HIGHLIGHT ACCEPTANCE SCENARIO HELPER */}
      {activeTab === 'condo' && selectedBlock === 'B' && !showHistory && !searchQuery.trim() && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-900 leading-snug">
            <strong>Kịch bản kiểm thử Block B:</strong> Danh sách hiển thị theo thứ tự tầng từ cao xuống thấp (20 → 15 → 12).
            Bấm <strong>DELIVERED</strong> tại từng đơn, hoặc <strong>chọn nhiều ô và bấm GIAO HÀNG LOẠT</strong> để hoàn tất nhiều đơn trong 1 thao tác.
          </div>
        </div>
      )}

      {/* BULK DELIVERY TOOLBAR */}
      {!showHistory && currentVisibleOrders.length > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 transition select-none cursor-pointer py-1.5 px-2.5 rounded-xl hover:bg-slate-100 border border-slate-200"
            >
              {isAllVisibleSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {isAllVisibleSelected
                  ? `Bỏ chọn tất cả (${currentVisibleOrders.length})`
                  : `Chọn tất cả (${currentVisibleOrders.length} đơn)`}
              </span>
            </button>

            {selectedOrders.length > 0 && (
              <span className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                Đã chọn {selectedOrders.length} đơn
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedOrders.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs text-slate-500 hover:text-rose-600 font-semibold px-2 py-1 transition"
                >
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkConfirmModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wide shadow-md shadow-blue-600/20 active:scale-95 transition"
                >
                  <PackageCheck className="w-4 h-4 text-blue-200" />
                  <span>GIAO HÀNG LOẠT ({selectedOrders.length})</span>
                </button>
              </>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                Tích chọn các ô để giao hàng loạt cùng lúc
              </span>
            )}
          </div>
        </div>
      )}

      {/* LIST OF ORDERS */}
      {!showHistory ? (
        activeTab === 'condo' ? (
          /* Condo Delivery List */
          <div className="space-y-3">
            {condoBlockPendingOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  {hasActiveFilters ? <Search className="w-6 h-6 text-slate-500" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                </div>
                <h3 className="font-extrabold text-slate-800 text-base">
                  {hasActiveFilters
                    ? 'Không tìm thấy đơn hàng phù hợp!'
                    : `Hết đơn cần giao tại Block ${selectedBlock}!`}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {hasActiveFilters
                    ? `Không có đơn hàng nào khớp với từ khóa "${searchQuery || 'bộ lọc'}". Thử đổi từ khóa hoặc xóa bộ lọc.`
                    : `Tất cả các căn hộ tại Block ${selectedBlock} đã được giao hoàn tất.`}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                  >
                    Xóa tìm kiếm & Lọc
                  </button>
                )}
              </div>
            ) : (
              condoBlockPendingOrders.map((order, index) => {
                const isPaid = order.paymentStatus === 'PAID';
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl p-4 shadow-sm border transition-all space-y-3 ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/25 bg-blue-50/20 shadow-md'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {/* Top Row: Address Badge & Step Number */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Bulk selection checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleSelectOrder(order.id)}
                          className="p-1 -ml-1 text-slate-400 hover:text-blue-600 rounded-lg transition focus:outline-none"
                          title={isSelected ? 'Bỏ chọn' : 'Chọn giao hàng loạt'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-black flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div
                          onClick={() => toggleSelectOrder(order.id)}
                          className="bg-blue-600 text-white font-black text-xl px-3 py-1 rounded-xl tracking-wider shadow-sm cursor-pointer select-none"
                          title="Bấm để chọn/bỏ chọn giao hàng loạt"
                        >
                          {order.location.formattedAddress}
                        </div>
                        {searchAllBlocks && order.location.block && order.location.block !== selectedBlock && (
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                            Block {order.location.block}
                          </span>
                        )}
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {order.deliveryStatus === 'READY_FOR_DELIVERY' ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1 shadow-xs animate-pulse">
                              <Rocket className="w-3 h-3 text-emerald-200" />
                              <span>SẴN SÀNG GIAO</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span>Đang chuẩn bị</span>
                            </span>
                          )}

                          {order.deliveryStatus === 'OUT_FOR_DELIVERY' && (() => {
                            const dueStatus = getOrderDeliveryDueStatus(order, schedulerConfig.outForDeliveryReminderMinutes);
                            if (!dueStatus) return null;
                            return (
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                  dueStatus.isOverdue
                                    ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                    : dueStatus.isDue
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-blue-100 text-blue-800 border-blue-200'
                                }`}
                                title={`Thời gian giao dự kiến: ${schedulerConfig.outForDeliveryReminderMinutes} phút (Lập lịch nhắc nhở)`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>{dueStatus.formattedText}</span>
                              </span>
                            );
                          })()}

                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800 animate-pulse'
                            }`}
                          >
                            {isPaid ? '✓ ĐÃ THANH TOÁN' : '⚠️ CHƯA THU TIỀN'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{order.id}</p>
                      </div>
                    </div>

                    {/* Order Tags & Priority */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {order.priority && (
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            order.priority === 'HIGH'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : order.priority === 'LOW'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              order.priority === 'HIGH'
                                ? 'bg-rose-500'
                                : order.priority === 'LOW'
                                ? 'bg-slate-400'
                                : 'bg-amber-500'
                            }`}
                          />
                          <span>
                            {order.priority === 'HIGH'
                              ? 'Ưu tiên Cao'
                              : order.priority === 'LOW'
                              ? 'Ưu tiên Thấp'
                              : 'Ưu tiên TB'}
                          </span>
                        </span>
                      )}

                      {order.tags &&
                        order.tags.length > 0 &&
                        order.tags.map((tag) => {
                          const predefined = PREDEFINED_ORDER_TAGS.find((p) => p.id === tag);
                          return (
                            <span
                              key={tag}
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs ${
                                predefined ? predefined.color : 'bg-teal-50 text-teal-700 border-teal-200'
                              }`}
                            >
                              #{tag}
                            </span>
                          );
                        })}
                    </div>

                    {/* Customer & Phone */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{order.customerName}</span>
                        {order.customerPhone && (
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="text-blue-600 font-semibold flex items-center gap-1 hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{order.customerPhone}</span>
                          </a>
                        )}
                      </div>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {formatVND(order.totalAmount)}
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-700 space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between font-medium">
                          <span>
                            • {item.productName} <strong className="text-slate-900">x{item.quantity}</strong>
                          </span>
                          <span className="text-slate-500 font-mono">{formatVND(item.lineTotal)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Delivery Note if present */}
                    {(order.deliveryNote || order.note || order.location.deliveryNote) && (
                      <div className="flex items-start gap-1.5 text-xs text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                        <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-[10px] text-amber-700 uppercase block">Ghi chú giao hàng:</span>
                          <p className="font-semibold whitespace-pre-wrap">
                            {order.deliveryNote || order.note || order.location.deliveryNote}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Internal Note for seller/shipper */}
                    {order.internalNote && (
                      <div className="flex items-start gap-1.5 text-xs text-purple-900 bg-purple-50 p-2 rounded-xl border border-purple-200/70">
                        <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                        <span>Ghi chú nội bộ: <strong>{order.internalNote}</strong></span>
                      </div>
                    )}

                    {/* Receipt Image if present */}
                    {order.receiptImageUrl && (
                      <div className="flex items-center gap-2 p-2 bg-indigo-50/80 rounded-xl border border-indigo-200 text-xs">
                        <img
                          src={order.receiptImageUrl}
                          alt="Biên nhận giao hàng"
                          className="w-10 h-10 object-cover rounded-lg border border-indigo-300 shadow-xs"
                        />
                        <div>
                          <p className="font-extrabold text-indigo-950 flex items-center gap-1">
                            <Camera className="w-3 h-3 text-indigo-600" />
                            <span>Biên nhận giao hàng</span>
                          </p>
                          <p className="text-[10px] text-indigo-700">Đã chụp bằng camera</p>
                        </div>
                      </div>
                    )}

                    {/* ACTION BUTTONS: READY FOR DELIVERY & DELIVERED */}
                    {order.deliveryStatus !== 'READY_FOR_DELIVERY' ? (
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={() => markReadyForDelivery(order.id)}
                          className="py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center justify-center gap-1 transition"
                          title="Đánh dấu đã chuẩn bị xong, sẵn sàng giao (kích hoạt chuông & thông báo)"
                        >
                          <Rocket className="w-3.5 h-3.5 text-emerald-200" />
                          <span>SẴN SÀNG</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPodModalOrder(order)}
                          className="py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 active:scale-[0.98] font-black text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1 transition"
                          title="Chụp ảnh gói hàng xác nhận giao (Proof of Delivery)"
                        >
                          <Camera className="w-3.5 h-3.5 text-indigo-600" />
                          <span>CHỤP POD</span>
                        </button>
                        <button
                          onClick={() => handleDeliver(order.id, order.location.formattedAddress)}
                          className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center justify-center gap-1 transition"
                        >
                          <CheckCircle2 className="w-4 h-4 text-blue-200" />
                          <span>ĐÃ GIAO</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setPodModalOrder(order)}
                          className="px-3.5 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 active:scale-[0.98] font-black text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition"
                          title="Chụp ảnh gói hàng xác nhận giao"
                        >
                          <Camera className="w-4 h-4 text-indigo-600" />
                          <span>CHỤP POD</span>
                        </button>
                        <button
                          onClick={() => handleDeliver(order.id, order.location.formattedAddress)}
                          className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-md shadow-emerald-700/25 flex items-center justify-center gap-2 transition"
                        >
                          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                          <span>XÁC NHẬN ĐÃ GIAO (DELIVERED)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* External Customer Delivery List */
          <div className="space-y-3">
            {externalPendingOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  {hasActiveFilters ? <Search className="w-6 h-6 text-slate-500" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                </div>
                <h3 className="font-extrabold text-slate-800 text-base">
                  {hasActiveFilters
                    ? 'Không tìm thấy đơn khách ngoài phù hợp!'
                    : 'Hết đơn khách ngoài cần giao!'}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {hasActiveFilters
                    ? `Không có đơn hàng nào khớp với từ khóa "${searchQuery || 'bộ lọc'}".`
                    : 'Tất cả các đơn địa chỉ ngoài đã hoàn thành.'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                  >
                    Xóa tìm kiếm & Lọc
                  </button>
                )}
              </div>
            ) : (
              externalPendingOrders.map((order, index) => {
                const isPaid = order.paymentStatus === 'PAID';
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl p-4 shadow-sm border transition-all space-y-3 ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/25 bg-indigo-50/20 shadow-md'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Bulk selection checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleSelectOrder(order.id)}
                          className="p-1 -ml-1 text-slate-400 hover:text-indigo-600 rounded-lg transition focus:outline-none"
                          title={isSelected ? 'Bỏ chọn' : 'Chọn giao hàng loạt'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 text-xs font-black flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-500">Khách ngoài:</span>
                          <h4
                            onClick={() => toggleSelectOrder(order.id)}
                            className="font-black text-slate-900 text-base cursor-pointer select-none"
                            title="Bấm để chọn/bỏ chọn giao hàng loạt"
                          >
                            {order.customerName}
                          </h4>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {order.deliveryStatus === 'READY_FOR_DELIVERY' ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1 shadow-xs animate-pulse">
                              <Rocket className="w-3 h-3 text-emerald-200" />
                              <span>SẴN SÀNG GIAO</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span>Đang chuẩn bị</span>
                            </span>
                          )}

                          {order.deliveryStatus === 'OUT_FOR_DELIVERY' && (() => {
                            const dueStatus = getOrderDeliveryDueStatus(order, schedulerConfig.outForDeliveryReminderMinutes);
                            if (!dueStatus) return null;
                            return (
                              <span
                                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                  dueStatus.isOverdue
                                    ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                    : dueStatus.isDue
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                }`}
                                title={`Thời gian giao dự kiến: ${schedulerConfig.outForDeliveryReminderMinutes} phút (Lập lịch nhắc nhở)`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>{dueStatus.formattedText}</span>
                              </span>
                            );
                          })()}

                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPaid ? '✓ ĐÃ THANH TOÁN' : '⚠️ CHƯA THU TIỀN'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{order.id}</p>
                      </div>
                    </div>

                    {/* Order Tags & Priority */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {order.priority && (
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            order.priority === 'HIGH'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : order.priority === 'LOW'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              order.priority === 'HIGH'
                                ? 'bg-rose-500'
                                : order.priority === 'LOW'
                                ? 'bg-slate-400'
                                : 'bg-amber-500'
                            }`}
                          />
                          <span>
                            {order.priority === 'HIGH'
                              ? 'Ưu tiên Cao'
                              : order.priority === 'LOW'
                              ? 'Ưu tiên Thấp'
                              : 'Ưu tiên TB'}
                          </span>
                        </span>
                      )}

                      {order.tags &&
                        order.tags.length > 0 &&
                        order.tags.map((tag) => {
                          const predefined = PREDEFINED_ORDER_TAGS.find((p) => p.id === tag);
                          return (
                            <span
                              key={tag}
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs ${
                                predefined ? predefined.color : 'bg-teal-50 text-teal-700 border-teal-200'
                              }`}
                            >
                              #{tag}
                            </span>
                          );
                        })}
                    </div>

                    {/* Free-form Address */}
                    <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100 text-xs text-indigo-950 font-medium">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-indigo-900">Địa chỉ giao hàng:</p>
                          <p className="mt-0.5">{order.location.externalAddress || order.location.formattedAddress}</p>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Note */}
                    {(order.deliveryNote || order.note || order.location.deliveryNote) && (
                      <div className="flex items-start gap-1.5 text-xs text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                        <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold text-[10px] text-amber-700 uppercase block">Ghi chú giao hàng:</span>
                          <p className="font-semibold whitespace-pre-wrap">
                            {order.deliveryNote || order.note || order.location.deliveryNote}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Internal Note for seller/shipper */}
                    {order.internalNote && (
                      <div className="flex items-start gap-1.5 text-xs text-purple-900 bg-purple-50 p-2 rounded-xl border border-purple-200/70">
                        <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                        <span>Ghi chú nội bộ: <strong>{order.internalNote}</strong></span>
                      </div>
                    )}

                    {/* Customer phone & items */}
                    <div className="flex items-center justify-between text-xs">
                      {order.customerPhone ? (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="text-blue-600 font-bold flex items-center gap-1 hover:underline"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{order.customerPhone}</span>
                        </a>
                      ) : (
                        <span></span>
                      )}
                      <span className="font-black text-slate-900 text-base">
                        {formatVND(order.totalAmount)}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2 text-xs text-slate-700 space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>• {item.productName} x{item.quantity}</span>
                          <span className="text-slate-500 font-mono">{formatVND(item.lineTotal)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Receipt Image if present */}
                    {order.receiptImageUrl && (
                      <div className="flex items-center gap-2 p-2 bg-indigo-50/80 rounded-xl border border-indigo-200 text-xs">
                        <img
                          src={order.receiptImageUrl}
                          alt="Biên nhận giao hàng"
                          className="w-10 h-10 object-cover rounded-lg border border-indigo-300 shadow-xs"
                        />
                        <div>
                          <p className="font-extrabold text-indigo-950 flex items-center gap-1">
                            <Camera className="w-3 h-3 text-indigo-600" />
                            <span>Biên nhận giao hàng</span>
                          </p>
                          <p className="text-[10px] text-indigo-700">Đã chụp bằng camera</p>
                        </div>
                      </div>
                    )}

                    {/* ACTION BUTTONS: READY FOR DELIVERY & DELIVERED */}
                    {order.deliveryStatus !== 'READY_FOR_DELIVERY' ? (
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={() => markReadyForDelivery(order.id)}
                          className="py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center justify-center gap-1 transition"
                          title="Đánh dấu đã chuẩn bị xong, sẵn sàng giao (kích hoạt chuông & thông báo)"
                        >
                          <Rocket className="w-3.5 h-3.5 text-emerald-200" />
                          <span>SẴN SÀNG</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPodModalOrder(order)}
                          className="py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 active:scale-[0.98] font-black text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1 transition"
                          title="Chụp ảnh gói hàng xác nhận giao (Proof of Delivery)"
                        >
                          <Camera className="w-3.5 h-3.5 text-indigo-600" />
                          <span>CHỤP POD</span>
                        </button>
                        <button
                          onClick={() => handleDeliver(order.id, order.customerName)}
                          className="py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-4 h-4 text-indigo-200" />
                          <span>ĐÃ GIAO</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setPodModalOrder(order)}
                          className="px-3.5 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 active:scale-[0.98] font-black text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition"
                          title="Chụp ảnh gói hàng xác nhận giao"
                        >
                          <Camera className="w-4 h-4 text-indigo-600" />
                          <span>CHỤP POD</span>
                        </button>
                        <button
                          onClick={() => handleDeliver(order.id, order.customerName)}
                          className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-md shadow-emerald-700/25 flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                          <span>XÁC NHẬN ĐÃ GIAO (DELIVERED)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )
      ) : (
        /* DELIVERED ORDER HISTORY */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-600">
              Lịch sử đơn đã giao ({filteredDeliveredOrders.length}/{deliveredOrders.length})
            </h3>
            <button
              onClick={() => setShowHistory(false)}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              ← Trở lại danh sách chờ
            </button>
          </div>

          {filteredDeliveredOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-2">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">
                {hasActiveFilters
                  ? 'Không tìm thấy đơn hàng trong lịch sử!'
                  : 'Chưa có đơn hàng nào được đánh dấu đã giao.'}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {hasActiveFilters
                  ? `Không có đơn đã giao nào khớp với từ khóa "${searchQuery}". Thử xóa bộ lọc để xem toàn bộ.`
                  : 'Khi bấm [Xác nhận đã giao] ở danh sách đơn, các đơn hoàn thành sẽ lưu lại tại đây.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
                >
                  Xóa tìm kiếm & Lọc
                </button>
              )}
            </div>
          ) : (
            filteredDeliveredOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition-all space-y-2.5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 text-base bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      {ord.location.formattedAddress}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{ord.id}</span>
                  </div>

                  <span
                    className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                      ord.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {ord.paymentStatus === 'PAID'
                      ? `✓ Đã thu (${ord.paymentMethod === 'CASH' ? 'Tiền mặt' : 'CK'})`
                      : '⚠️ Chưa thu'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{ord.customerName}</span>
                  <span className="font-black text-slate-900 text-sm">{formatVND(ord.totalAmount)}</span>
                </div>

                {/* Items preview */}
                <div className="bg-slate-50 rounded-xl p-2 text-xs text-slate-600 space-y-0.5">
                  {ord.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>• {item.productName} x{item.quantity}</span>
                      <span className="text-slate-400 font-mono">{formatVND(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>

                {/* Notes in history if present */}
                {(ord.location.deliveryNote || ord.internalNote) && (
                  <div className="space-y-1 pt-1">
                    {ord.location.deliveryNote && (
                      <div className="flex items-start gap-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/60">
                        <FileText className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                        <span>Ghi chú: {ord.location.deliveryNote}</span>
                      </div>
                    )}
                    {ord.internalNote && (
                      <div className="flex items-start gap-1 text-[11px] text-purple-800 bg-purple-50 px-2 py-1 rounded-lg border border-purple-200/60">
                        <Lock className="w-3 h-3 text-purple-600 shrink-0 mt-0.5" />
                        <span>Ghi chú nội bộ: {ord.internalNote}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Delivered time & Confirmer */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Giao bởi: <strong>{ord.deliveredBy || 'Shipper'}</strong></span>
                  </div>
                  {ord.deliveryTime && (
                    <span className="font-mono text-slate-400">
                      {new Date(ord.deliveryTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })},{' '}
                      {new Date(ord.deliveryTime).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
        </>
      )}

      {/* STICKY FLOATING BOTTOM BAR FOR BULK ACTION */}
      {selectedOrders.length > 0 && !showHistory && deliveryViewMode === 'LIST' && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl border border-slate-700 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-extrabold text-xs text-white truncate">
                Đã chọn {selectedOrders.length} đơn hàng
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-semibold font-mono mt-0.5">
              {formatVND(selectedOrders.reduce((sum, o) => sum + o.totalAmount, 0))}
              {selectedOrders.some((o) => o.paymentStatus === 'UNPAID') && (
                <span className="text-amber-400 font-bold ml-1.5 font-sans text-[10px]">
                  (⚠️ {selectedOrders.filter((o) => o.paymentStatus === 'UNPAID').length} chưa thu tiền)
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={clearSelection}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => setShowBulkConfirmModal(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-1.5 transition active:scale-95"
            >
              <PackageCheck className="w-4 h-4 text-blue-200" />
              <span>Giao ({selectedOrders.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* BULK DELIVERY CONFIRMATION MODAL */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <PackageCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-base uppercase tracking-wide">
                    Xác nhận Giao Hàng Hàng Loạt
                  </h3>
                  <p className="text-xs text-blue-100 font-medium">
                    Chuyển {selectedOrders.length} đơn hàng sang trạng thái "ĐÃ GIAO"
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Summary */}
            <div className="p-5 overflow-y-auto space-y-4 max-h-[60vh]">
              {/* Metric tiles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-blue-700 uppercase">Số lượng đơn</span>
                  <p className="text-2xl font-black text-blue-900 mt-0.5">{selectedOrders.length}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase">Tổng tiền hàng</span>
                  <p className="text-lg font-black text-emerald-900 mt-1 font-mono">
                    {formatVND(selectedOrders.reduce((sum, o) => sum + o.totalAmount, 0))}
                  </p>
                </div>
              </div>

              {/* Warning if any orders are unpaid */}
              {selectedOrders.some((o) => o.paymentStatus === 'UNPAID') && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <strong className="font-bold">Lưu ý thu tiền:</strong> Có{' '}
                    <strong className="underline text-amber-950 font-black">
                      {selectedOrders.filter((o) => o.paymentStatus === 'UNPAID').length} đơn hàng CHƯA THU TIỀN
                    </strong>{' '}
                    (Tổng{' '}
                    {formatVND(
                      selectedOrders
                        .filter((o) => o.paymentStatus === 'UNPAID')
                        .reduce((sum, o) => sum + o.totalAmount, 0)
                    )}
                    ). Vui lòng đảm bảo đã thu tiền mặt hoặc nhận chuyển khoản khi trao hàng.
                  </div>
                </div>
              )}

              {/* Order list preview */}
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Danh sách đơn sẽ đánh dấu đã giao ({selectedOrders.length}):
                </span>
                <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50">
                  {selectedOrders.map((ord) => (
                    <div key={ord.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-white transition">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900">
                            {ord.location.formattedAddress}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">({ord.id})</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{ord.customerName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-800 font-mono block">
                          {formatVND(ord.totalAmount)}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                            ord.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ord.paymentStatus === 'PAID' ? '✓ Đã thu' : '⚠️ Chưa thu'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirmer notice */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span>Người xác nhận giao:</span>
                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {currentUser}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkDelivery}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-blue-600/30 flex items-center gap-2 active:scale-95 transition"
              >
                <CheckCircle2 className="w-4 h-4 text-blue-200" />
                <span>Xác nhận giao ngay ({selectedOrders.length} đơn)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Route Manifest PDF / Print Modal */}
      <ExportOrderReportModal
        isOpen={isPrintManifestOpen}
        onClose={() => setIsPrintManifestOpen(false)}
        orders={currentVisibleOrders.length > 0 ? currentVisibleOrders : pendingOrders}
        title={`Bảng Lộ trình Giao hàng - ${activeCondo.name}`}
        periodLabel={`Lộ trình ${activeCondo.name} - Tòa ${selectedBlock}`}
        defaultDocType="DELIVERY_MANIFEST"
        currentUser={currentUser}
      />

      {/* Order Detail Modal */}
      {selectedOrderForDetail && (
        <OrderDetailModal
          isOpen={Boolean(selectedOrderForDetail)}
          onClose={() => setSelectedOrderForDetail(null)}
          order={selectedOrderForDetail}
        />
      )}

      {/* Proof-of-Delivery Camera Modal */}
      <ProofOfDeliveryCameraModal
        isOpen={Boolean(podModalOrder)}
        onClose={() => setPodModalOrder(null)}
        order={podModalOrder}
      />
    </div>
  );
};
