import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Order, OrderPriority, getOrderTagColor } from '../types';
import { formatVND } from '../utils/storage';
import {
  extractFloorNumber,
  extractBlockName,
  calculateRouteMetrics,
  optimizeByElevatorTopDown,
  optimizeByBlockCluster,
  optimizeByPriorityAndDue,
} from '../utils/routeOptimizer';
import { getOrderDeliveryDueStatus } from '../utils/notificationScheduler';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Zap,
  Building2,
  MapPin,
  Clock,
  Truck,
  CheckCircle2,
  Phone,
  FileText,
  AlertTriangle,
  RotateCcw,
  Check,
  Printer,
  ChevronDown,
  ChevronUp,
  Layers,
  Compass,
  ArrowUpDown,
  Navigation,
  Save,
  Route as RouteIcon,
  HelpCircle,
  Eye,
} from 'lucide-react';

interface RouteMapViewProps {
  onOpenDetailModal?: (order: Order) => void;
  onOpenPrintManifest?: () => void;
}

export const RouteMapView: React.FC<RouteMapViewProps> = ({
  onOpenDetailModal,
  onOpenPrintManifest,
}) => {
  const {
    orders,
    reorderDeliverySequence,
    markOutForDelivery,
    markDelivered,
    markPaid,
    currentUser,
    schedulerConfig,
  } = useApp();

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filter all active orders for the current day
  // (orders created today OR active pending deliveries)
  const todayActiveOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status !== 'ACTIVE') return false;
      const isCreatedToday = o.createdAt?.startsWith(todayStr);
      const isPendingDelivery = o.deliveryStatus !== 'DELIVERED';
      return isCreatedToday || isPendingDelivery;
    });
  }, [orders, todayStr]);

  // Working sequence list for route optimization
  const [routeSequence, setRouteSequence] = useState<Order[]>([]);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Sub-view toggle: 'SEQUENTIAL_BOARD' (Drag & Drop Grid) vs 'ELEVATION_MATRIX' (Floor x Block 2D Grid)
  const [displayMode, setDisplayMode] = useState<'SEQUENTIAL_BOARD' | 'ELEVATION_MATRIX'>('SEQUENTIAL_BOARD');

  // Filter by status within Route Map
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'OUT_FOR_DELIVERY' | 'DELIVERED'>('ALL');

  // Drag and Drop State
  const [draggedOrderIndex, setDraggedOrderIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Initialize or synchronize routeSequence with today's orders
  useEffect(() => {
    // Sort according to existing deliverySequenceIndex if available, otherwise by floor top-down
    const sorted = [...todayActiveOrders].sort((a, b) => {
      if (a.deliverySequenceIndex !== undefined && b.deliverySequenceIndex !== undefined) {
        return a.deliverySequenceIndex - b.deliverySequenceIndex;
      }
      if (a.deliverySequenceIndex !== undefined) return -1;
      if (b.deliverySequenceIndex !== undefined) return 1;

      // Default to highest floor to lowest floor
      const floorA = extractFloorNumber(a);
      const floorB = extractFloorNumber(b);
      return floorB - floorA;
    });

    setRouteSequence(sorted);
  }, [todayActiveOrders]);

  // Filtered view according to selected status filter
  const visibleSequence = useMemo(() => {
    if (statusFilter === 'ALL') return routeSequence;
    if (statusFilter === 'PENDING') return routeSequence.filter((o) => o.deliveryStatus === 'PENDING');
    if (statusFilter === 'OUT_FOR_DELIVERY') return routeSequence.filter((o) => o.deliveryStatus === 'OUT_FOR_DELIVERY');
    if (statusFilter === 'DELIVERED') return routeSequence.filter((o) => o.deliveryStatus === 'DELIVERED');
    return routeSequence;
  }, [routeSequence, statusFilter]);

  // Route metrics calculation
  const metrics = useMemo(() => {
    return calculateRouteMetrics(routeSequence);
  }, [routeSequence]);

  // Drag & Drop Handlers (HTML5 DnD)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedOrderIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${index}`);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedOrderIndex === null || draggedOrderIndex === targetIndex) {
      setDraggedOrderIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...routeSequence];
    const [movedItem] = updated.splice(draggedOrderIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setRouteSequence(updated);
    setDraggedOrderIndex(null);
    setDragOverIndex(null);

    // Auto save updated sequence
    reorderDeliverySequence(updated.map((o) => o.id));
    showToastNotice('Đã cập nhật vị trí điểm dừng thành công!');
  };

  const handleDragEnd = () => {
    setDraggedOrderIndex(null);
    setDragOverIndex(null);
  };

  // Button move handlers for mobile or keyboard accessibility
  const moveOrder = (fromIndex: number, direction: 'UP' | 'DOWN' | 'TOP' | 'BOTTOM') => {
    const updated = [...routeSequence];
    let toIndex = fromIndex;

    if (direction === 'UP' && fromIndex > 0) toIndex = fromIndex - 1;
    else if (direction === 'DOWN' && fromIndex < updated.length - 1) toIndex = fromIndex + 1;
    else if (direction === 'TOP') toIndex = 0;
    else if (direction === 'BOTTOM') toIndex = updated.length - 1;
    else return;

    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    setRouteSequence(updated);
    reorderDeliverySequence(updated.map((o) => o.id));
    showToastNotice(`Đã chuyển điểm dừng tới vị trí #${toIndex + 1}!`);
  };

  // Optimization Presets
  const applyOptimizer = (type: 'ELEVATOR' | 'BLOCK' | 'PRIORITY' | 'REVERSE' | 'RESET') => {
    let optimized: Order[] = [];
    if (type === 'ELEVATOR') {
      optimized = optimizeByElevatorTopDown(routeSequence);
      showToastNotice('Đã tối ưu thang máy từ tầng cao xuống thấp!');
    } else if (type === 'BLOCK') {
      optimized = optimizeByBlockCluster(routeSequence);
      showToastNotice('Đã gom thứ tự theo từng Block & toà nhà!');
    } else if (type === 'PRIORITY') {
      optimized = optimizeByPriorityAndDue(routeSequence);
      showToastNotice('Đã ưu tiên đơn gấp & sắp đến hạn lên đầu!');
    } else if (type === 'REVERSE') {
      optimized = [...routeSequence].reverse();
      showToastNotice('Đã đảo ngược toàn bộ lộ trình!');
    } else if (type === 'RESET') {
      optimized = [...todayActiveOrders].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      showToastNotice('Đã đặt lại thứ tự theo thời gian tạo đơn ban đầu!');
    }

    setRouteSequence(optimized);
    reorderDeliverySequence(optimized.map((o) => o.id));
  };

  const handleSaveSequence = () => {
    reorderDeliverySequence(routeSequence.map((o) => o.id));
    showToastNotice('Đã lưu lộ trình tối ưu vào hệ thống thành công!');
  };

  const showToastNotice = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3500);
  };

  // Building Elevation Matrix Data
  // Group unique blocks and unique floors for the 2D grid
  const matrixData = useMemo(() => {
    const blocksSet = new Set<string>();
    const floorsSet = new Set<number>();

    routeSequence.forEach((o) => {
      const b = extractBlockName(o);
      const f = extractFloorNumber(o);
      blocksSet.add(b);
      floorsSet.add(f);
    });

    const blocks = Array.from(blocksSet).sort((a, b) => {
      if (a === 'EXTERNAL') return 1;
      if (b === 'EXTERNAL') return -1;
      return a.localeCompare(b);
    });

    const floors = Array.from(floorsSet).sort((a, b) => b - a); // Top floor down

    // Map: `${block}-${floor}` -> Order[] with sequence index
    const cellMap = new Map<string, { order: Order; sequenceIndex: number }[]>();

    routeSequence.forEach((ord, idx) => {
      const b = extractBlockName(ord);
      const f = extractFloorNumber(ord);
      const key = `${b}-${f}`;
      const existing = cellMap.get(key) || [];
      existing.push({ order: ord, sequenceIndex: idx + 1 });
      cellMap.set(key, existing);
    });

    return { blocks, floors, cellMap };
  }, [routeSequence]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Toast Notification */}
      {savedNotice && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl flex items-center gap-2 animate-slideDown">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Main Header & Overview Card */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-blue-800/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-blue-500/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
                <RouteIcon className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-2">
                  Bản đồ Lộ trình & Tối ưu Giao hàng
                  <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full font-bold">
                    Hôm nay: {routeSequence.length} đơn
                  </span>
                </h3>
                <p className="text-xs text-blue-200/80 mt-0.5">
                  Kéo thả để sắp xếp thứ tự điểm dừng tối ưu theo chiều thang máy và toà nhà
                </p>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleSaveSequence}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black shadow-sm transition flex items-center gap-1.5"
              title="Lưu thứ tự lộ trình hiện tại"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu lộ trình</span>
            </button>

            {onOpenPrintManifest && (
              <button
                type="button"
                onClick={onOpenPrintManifest}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 border border-white/20"
                title="In bảng kê lộ trình ra PDF"
              >
                <Printer className="w-3.5 h-3.5 text-blue-200" />
                <span>In lộ trình</span>
              </button>
            )}
          </div>
        </div>

        {/* Route Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-4 mt-3 border-t border-white/10 text-xs">
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
            <span className="text-[10px] text-blue-200 block uppercase font-bold">Điểm dừng</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-white">{metrics.totalStops}</span>
              <span className="text-[11px] text-emerald-400 font-semibold">({metrics.completedStops} đã giao)</span>
            </div>
          </div>

          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
            <span className="text-[10px] text-blue-200 block uppercase font-bold">Ước tính thời gian</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-amber-300">~{metrics.estimatedMinutes} phút</span>
            </div>
          </div>

          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
            <span className="text-[10px] text-blue-200 block uppercase font-bold">Độ cao di chuyển</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-white">{metrics.totalFloorsTraversed} tầng</span>
              {metrics.upwardElevatorBacktracks > 0 ? (
                <span className="text-[10px] text-rose-300 font-bold">({metrics.upwardElevatorBacktracks} lần ngược tầng)</span>
              ) : (
                <span className="text-[10px] text-emerald-300 font-bold">(Tối ưu 100%)</span>
              )}
            </div>
          </div>

          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
            <span className="text-[10px] text-blue-200 block uppercase font-bold">Chỉ số tối ưu</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-base font-black ${
                  metrics.efficiencyScore >= 85
                    ? 'text-emerald-400'
                    : metrics.efficiencyScore >= 70
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {metrics.efficiencyScore}%
              </span>
              <span className="text-[10px] text-slate-300">
                {metrics.efficiencyScore >= 85 ? 'Rất tốt' : 'Cần tối ưu'}
              </span>
            </div>
          </div>

          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-blue-200 block uppercase font-bold">Tiền thu COD</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-black text-emerald-300">{formatVND(metrics.unpaidAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Smart Optimization Toolbar */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Tối ưu hóa nhanh (Smart Optimizers):</span>
          </div>

          {/* View mode switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setDisplayMode('SEQUENTIAL_BOARD')}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                displayMode === 'SEQUENTIAL_BOARD'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RouteIcon className="w-3.5 h-3.5" />
              <span>Bảng Kéo-Thả</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('ELEVATION_MATRIX')}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                displayMode === 'ELEVATION_MATRIX'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Ma trận Tầng (Grid 2D)</span>
            </button>
          </div>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <button
            type="button"
            onClick={() => applyOptimizer('ELEVATOR')}
            className="p-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-800 font-bold transition flex items-center gap-2 active:scale-95"
            title="Sắp xếp tự động từ tầng cao nhất xuống tầng thấp nhất để tiết kiệm thời gian đợi thang máy"
          >
            <ArrowDown className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="text-left">
              <span className="block font-black text-xs leading-none">Thang máy từ trên xuống</span>
              <span className="text-[10px] text-blue-600 font-normal">Tầng cao ➔ Tầng thấp</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => applyOptimizer('BLOCK')}
            className="p-2 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-800 font-bold transition flex items-center gap-2 active:scale-95"
            title="Gom tất cả đơn trong cùng một toà/Block trước khi chuyển sang toà khác"
          >
            <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
            <div className="text-left">
              <span className="block font-black text-xs leading-none">Gom theo Block toà</span>
              <span className="text-[10px] text-purple-600 font-normal">Xong toà này mới qua toà khác</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => applyOptimizer('PRIORITY')}
            className="p-2 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-900 font-bold transition flex items-center gap-2 active:scale-95"
            title="Đẩy các đơn ưu tiên cao hoặc hẹn giờ lên đầu danh sách"
          >
            <Zap className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="text-left">
              <span className="block font-black text-xs leading-none">Ưu tiên đơn khẩn trước</span>
              <span className="text-[10px] text-amber-700 font-normal">Đơn VIP & đơn hẹn giờ</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => applyOptimizer('REVERSE')}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold transition flex items-center gap-2 active:scale-95"
            title="Đảo ngược toàn bộ thứ tự lộ trình"
          >
            <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="text-left">
              <span className="block font-black text-xs leading-none">Đảo ngược lộ trình</span>
              <span className="text-[10px] text-slate-500 font-normal">Từ cuối lên đầu</span>
            </div>
          </button>
        </div>
      </div>

      {/* FILTER TABS ROW */}
      <div className="flex items-center justify-between text-xs overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500">Lọc trạng thái:</span>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tất cả ({routeSequence.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Chờ giao ({routeSequence.filter((o) => o.deliveryStatus === 'PENDING').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('OUT_FOR_DELIVERY')}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              statusFilter === 'OUT_FOR_DELIVERY'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Đang đi giao ({routeSequence.filter((o) => o.deliveryStatus === 'OUT_FOR_DELIVERY').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DELIVERED')}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              statusFilter === 'DELIVERED'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Đã xong ({routeSequence.filter((o) => o.deliveryStatus === 'DELIVERED').length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => applyOptimizer('RESET')}
          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold underline"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Khôi phục ban đầu</span>
        </button>
      </div>

      {/* VIEW 1: SEQUENTIAL DRAG & DROP GRID */}
      {displayMode === 'SEQUENTIAL_BOARD' && (
        <div className="space-y-2">
          {visibleSequence.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-2">
              <RouteIcon className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Không có đơn hàng nào khớp bộ lọc</p>
              <p className="text-xs text-slate-400">Chọn trạng thái khác hoặc tạo đơn hàng mới cho ngày hôm nay.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleSequence.map((order, index) => {
                const stopNumber = index + 1;
                const isPaid = order.paymentStatus === 'PAID';
                const isDelivered = order.deliveryStatus === 'DELIVERED';
                const isOutForDelivery = order.deliveryStatus === 'OUT_FOR_DELIVERY';
                const isReady = order.deliveryStatus === 'READY_FOR_DELIVERY';

                const dueStatus = getOrderDeliveryDueStatus(order, schedulerConfig.outForDeliveryReminderMinutes);
                const floorNum = extractFloorNumber(order);
                const blockName = extractBlockName(order);

                // Note text priority
                const noteText = order.deliveryNote || order.note || order.location?.deliveryNote;

                // Elevator floor change difference compared to previous order
                let floorChangeLabel = '';
                if (index > 0) {
                  const prevOrder = visibleSequence[index - 1];
                  const prevFloor = extractFloorNumber(prevOrder);
                  const prevBlock = extractBlockName(prevOrder);

                  if (prevBlock !== blockName) {
                    floorChangeLabel = `Chuyển toà: ${prevBlock} ➔ ${blockName}`;
                  } else if (floorNum < prevFloor) {
                    floorChangeLabel = `⬇️ Thang máy xuống ${prevFloor - floorNum} tầng`;
                  } else if (floorNum > prevFloor) {
                    floorChangeLabel = `⚠️ Thang máy lên ${floorNum - prevFloor} tầng (ngược chiều)`;
                  } else {
                    floorChangeLabel = `Cùng tầng ${floorNum}`;
                  }
                }

                const isBeingDragged = draggedOrderIndex === index;
                const isHoverTarget = dragOverIndex === index;

                return (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white rounded-2xl p-3.5 border transition-all duration-150 select-none cursor-grab active:cursor-grabbing relative flex flex-col justify-between ${
                      isBeingDragged
                        ? 'opacity-40 scale-95 border-blue-400 dashed bg-blue-50/50 shadow-inner'
                        : isHoverTarget
                        ? 'border-blue-500 ring-2 ring-blue-500/30 scale-[1.01] bg-blue-50/30 shadow-md'
                        : isDelivered
                        ? 'border-slate-200 bg-slate-50/60 opacity-80'
                        : isOutForDelivery
                        ? 'border-blue-400 ring-1 ring-blue-400/30 shadow-sm'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    {/* Top Row: Stop Number, Drag Handle, Address, and Movement info */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {/* Drag Handle Icon */}
                          <div
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-md cursor-grab"
                            title="Bấm giữ và kéo thả để đổi thứ tự giao"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>

                          {/* Stop Number Badge */}
                          <div
                            className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                              isDelivered
                                ? 'bg-emerald-100 text-emerald-800'
                                : isOutForDelivery
                                ? 'bg-blue-600 text-white animate-pulse'
                                : 'bg-slate-900 text-white'
                            }`}
                          >
                            #{stopNumber}
                          </div>

                          {/* Address Badge */}
                          <div className="font-mono">
                            <span
                              className={`text-sm font-black px-2.5 py-0.5 rounded-lg shadow-2xs inline-block ${
                                order.location.type === 'condo'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-emerald-700 text-white'
                              }`}
                            >
                              {order.location.formattedAddress}
                            </span>
                          </div>
                        </div>

                        {/* Status Pills */}
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {isDelivered && (
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>ĐÃ GIAO</span>
                            </span>
                          )}

                          {isOutForDelivery && (
                            <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-0.5 animate-pulse">
                              <Truck className="w-3 h-3 text-blue-600" />
                              <span>ĐANG GIAO</span>
                            </span>
                          )}

                          {order.deliveryStatus === 'PENDING' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Chờ giao
                            </span>
                          )}

                          {/* Payment badge */}
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                              isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPaid ? '✓ Đã thu' : '⚠️ COD'}
                          </span>
                        </div>
                      </div>

                      {/* Direction / Elevator step callout */}
                      {floorChangeLabel && (
                        <div className="text-[10px] text-slate-500 font-medium px-2 py-0.5 bg-slate-100 rounded-md inline-block">
                          {floorChangeLabel}
                        </div>
                      )}

                      {/* Customer Name, Phone & Due indicator */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900">{order.customerName}</span>
                          {order.customerPhone && (
                            <a
                              href={`tel:${order.customerPhone}`}
                              className="text-[11px] text-blue-600 font-semibold flex items-center gap-0.5 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{order.customerPhone}</span>
                            </a>
                          )}
                        </div>

                        <span className="font-black text-slate-900 font-mono text-xs">
                          {formatVND(order.totalAmount)}
                        </span>
                      </div>

                      {/* Items preview */}
                      <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl">
                        <span className="text-slate-400 font-medium">Món: </span>
                        <span className="font-semibold text-slate-700">
                          {order.items.map((i) => `${i.productName} x${i.quantity}`).join(', ')}
                        </span>
                      </div>

                      {/* Notes / Special delivery instruction callout (Gate code 1234, Leave at front desk) */}
                      {noteText && (
                        <div className="flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200/90 rounded-xl text-xs text-amber-950 shadow-2xs">
                          <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black uppercase text-amber-800 block">
                              Ghi chú giao hàng (Delivery Note):
                            </span>
                            <span className="font-bold text-amber-950">{noteText}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Card Footer: Reorder Position Buttons & Delivery Actions */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                      {/* Step Reorder Controls (for Mobile & Precision) */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-bold mr-0.5">Thứ tự:</span>
                        <button
                          type="button"
                          onClick={() => moveOrder(index, 'UP')}
                          disabled={index === 0}
                          className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition"
                          title="Chuyển lên trước 1 điểm dừng"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveOrder(index, 'DOWN')}
                          disabled={index === visibleSequence.length - 1}
                          className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition"
                          title="Chuyển xuống sau 1 điểm dừng"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Delivery Status Actions */}
                      <div className="flex items-center gap-1.5">
                        {onOpenDetailModal && (
                          <button
                            type="button"
                            onClick={() => onOpenDetailModal(order)}
                            className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
                          >
                            Xem đơn
                          </button>
                        )}

                        {order.deliveryStatus === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => markOutForDelivery(order.id)}
                            className="px-2.5 py-1 text-[11px] font-black uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1"
                          >
                            <Truck className="w-3 h-3" />
                            <span>Đi giao</span>
                          </button>
                        )}

                        {(order.deliveryStatus === 'OUT_FOR_DELIVERY' ||
                          order.deliveryStatus === 'READY_FOR_DELIVERY') && (
                          <button
                            type="button"
                            onClick={() => markDelivered(order.id)}
                            className="px-2.5 py-1 text-[11px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã giao xong</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: BUILDING ELEVATION MATRIX (2D Floor x Block Grid) */}
      {displayMode === 'ELEVATION_MATRIX' && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Ma trận Mặt đứng Toà nhà & Điểm dừng (Building Elevation Matrix)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Xem vị trí các tầng theo toà nhà và đường đi của shipper từ tầng cao xuống tầng thấp
                </p>
              </div>
            </div>
          </div>

          {/* Matrix Grid Container */}
          <div className="overflow-x-auto pb-3">
            <table className="w-full border-collapse min-w-[600px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-2.5 px-3 text-left font-black text-slate-600 w-24 border-r border-slate-200">
                    Tầng (Floor)
                  </th>
                  {matrixData.blocks.map((block) => (
                    <th key={block} className="py-2.5 px-3 text-center font-black text-slate-800">
                      {block === 'EXTERNAL' ? 'Khách ngoài (External)' : `Block ${block}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixData.floors.map((floor) => (
                  <tr key={floor} className="hover:bg-slate-50/50 transition">
                    {/* Floor Label Header */}
                    <td className="py-3 px-3 font-mono font-black text-slate-700 bg-slate-50/80 border-r border-slate-200">
                      {floor === 0 ? 'Mặt đất / Ngoài' : `Tầng ${floor}`}
                    </td>

                    {/* Block Columns for this floor */}
                    {matrixData.blocks.map((block) => {
                      const key = `${block}-${floor}`;
                      const itemsInCell = matrixData.cellMap.get(key) || [];

                      return (
                        <td key={block} className="py-2 px-2 text-center align-top border border-slate-100">
                          {itemsInCell.length === 0 ? (
                            <span className="text-[10px] text-slate-300 select-none">·</span>
                          ) : (
                            <div className="space-y-1.5">
                              {itemsInCell.map(({ order, sequenceIndex }) => {
                                const isDelivered = order.deliveryStatus === 'DELIVERED';
                                const isOut = order.deliveryStatus === 'OUT_FOR_DELIVERY';

                                return (
                                  <div
                                    key={order.id}
                                    onClick={() => onOpenDetailModal?.(order)}
                                    className={`p-2 rounded-xl text-left border shadow-2xs cursor-pointer hover:shadow-md transition active:scale-95 ${
                                      isDelivered
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                        : isOut
                                        ? 'bg-blue-50 border-blue-300 text-blue-950 ring-1 ring-blue-400'
                                        : 'bg-white border-slate-200 text-slate-900 hover:border-blue-400'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span
                                        className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${
                                          isDelivered
                                            ? 'bg-emerald-600 text-white'
                                            : isOut
                                            ? 'bg-blue-600 text-white animate-pulse'
                                            : 'bg-slate-900 text-white'
                                        }`}
                                      >
                                        #{sequenceIndex}
                                      </span>
                                      <span className="font-mono font-black text-[11px] text-blue-700 truncate">
                                        {order.location.formattedAddress}
                                      </span>
                                    </div>

                                    <div className="text-[11px] font-bold text-slate-800 truncate">
                                      {order.customerName}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      {formatVND(order.totalAmount)}
                                    </div>

                                    {(order.deliveryNote || order.note) && (
                                      <div className="text-[9px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded mt-1 truncate font-semibold">
                                        📝 {order.deliveryNote || order.note}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
