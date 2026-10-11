import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Customer, LocationType, Order } from '../types';
import { formatVND } from '../utils/storage';
import { CustomerDebtLedgerModal } from './CustomerDebtLedgerModal';
import { ZaloDebtStatementModal } from './ZaloDebtStatementModal';
import { CustomerDebtReminderModal } from './CustomerDebtReminderModal';
import {
  ArrowLeft,
  Users,
  Search,
  Plus,
  Building2,
  MapPin,
  Phone,
  FileText,
  Edit2,
  Trash2,
  ShoppingBag,
  Sparkles,
  X,
  Check,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Wallet,
  Crown,
  MessageCircle,
  AlertCircle,
  Clock,
  BellRing,
} from 'lucide-react';

export const CustomersScreen: React.FC = () => {
  const {
    customers,
    condos,
    orders,
    saveCustomer,
    updateCustomer,
    deleteCustomer,
    setSelectedCustomerForOrder,
    setCurrentScreen,
    calculateCustomerDebt,
  } = useApp();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'condo' | 'external'>('ALL');
  const [debtFilter, setDebtFilter] = useState<'ALL' | 'HAS_DEBT' | 'OVERDUE' | 'OVER_LIMIT'>('ALL');

  // Debt & Ledger Modals State
  const [selectedCustomerForLedger, setSelectedCustomerForLedger] = useState<Customer | null>(null);
  const [selectedCustomerForZalo, setSelectedCustomerForZalo] = useState<Customer | null>(null);
  const [selectedCustomerForReminder, setSelectedCustomerForReminder] = useState<Customer | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('condo');
  const [condoId, setCondoId] = useState(condos[0]?.id || '');
  const [block, setBlock] = useState('B');
  const [floor, setFloor] = useState('');
  const [unit, setUnit] = useState('');
  const [externalAddress, setExternalAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [debtLimitInput, setDebtLimitInput] = useState('');
  const [isVipInput, setIsVipInput] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [formError, setFormError] = useState('');

  // Delete Confirm State
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const selectedCondo = condos.find((c) => c.id === condoId) || condos[0];

  // Precompute debt for all customers
  const customerDebtMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateCustomerDebt>>();
    for (const c of customers) {
      map.set(c.id, calculateCustomerDebt(c));
    }
    return map;
  }, [customers, orders, calculateCustomerDebt]);

  // Aggregate debt metrics
  const totalAllDebt = useMemo(() => {
    let sum = 0;
    for (const debt of customerDebtMap.values()) {
      sum += debt.totalDebt;
    }
    return sum;
  }, [customerDebtMap]);

  const debtorCount = useMemo(() => {
    let cnt = 0;
    for (const debt of customerDebtMap.values()) {
      if (debt.totalDebt > 0) cnt++;
    }
    return cnt;
  }, [customerDebtMap]);

  const overdueDebtorCount = useMemo(() => {
    let cnt = 0;
    for (const debt of customerDebtMap.values()) {
      if (debt.isOverdue) cnt++;
    }
    return cnt;
  }, [customerDebtMap]);

  const overLimitCount = useMemo(() => {
    let cnt = 0;
    for (const debt of customerDebtMap.values()) {
      if (debt.isOverLimit) cnt++;
    }
    return cnt;
  }, [customerDebtMap]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setLocationType('condo');
    setCondoId(condos[0]?.id || '');
    setBlock('B');
    setFloor('');
    setUnit('');
    setExternalAddress('');
    setDeliveryNote('');
    setDebtLimitInput('');
    setIsVipInput(false);
    setNotesInput('');
    setFormError('');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone || '');
    setLocationType(c.defaultLocationType);
    if (c.defaultLocationType === 'condo') {
      const foundCondo = condos.find((item) => item.name === c.condoName);
      if (foundCondo) {
        setCondoId(foundCondo.id);
      }
      setBlock(c.block || 'B');
      setFloor(c.floor || '');
      setUnit(c.unit || '');
    } else {
      setExternalAddress(c.externalAddress || '');
    }
    setDeliveryNote(c.deliveryNote || '');
    setDebtLimitInput(c.debtLimit ? String(c.debtLimit) : '');
    setIsVipInput(c.isVip || false);
    setNotesInput(c.notes || '');
    setFormError('');
    setShowModal(true);
  };

  // Submit Add / Edit
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Vui lòng nhập họ tên khách hàng');
      return;
    }

    if (locationType === 'condo') {
      if (!block.trim() || !floor.trim() || !unit.trim()) {
        setFormError('Vui lòng nhập đầy đủ Block, Tầng và Số căn (e.g. B-20-10)');
        return;
      }
    } else {
      if (!externalAddress.trim()) {
        setFormError('Vui lòng nhập địa chỉ giao hàng cho khách ngoài');
        return;
      }
    }

    const parsedLimit = debtLimitInput.trim()
      ? parseInt(debtLimitInput.replace(/\D/g, ''), 10)
      : undefined;

    if (editingCustomer) {
      // Update
      const updated: Customer = {
        ...editingCustomer,
        name: name.trim(),
        phone: phone.trim(),
        defaultLocationType: locationType,
        condoName: locationType === 'condo' ? selectedCondo?.name : undefined,
        block: locationType === 'condo' ? block.trim().toUpperCase() : undefined,
        floor: locationType === 'condo' ? floor.trim() : undefined,
        unit: locationType === 'condo' ? unit.trim() : undefined,
        externalAddress: locationType === 'external' ? externalAddress.trim() : undefined,
        deliveryNote: deliveryNote.trim() || undefined,
        debtLimit: parsedLimit,
        isVip: isVipInput,
        notes: notesInput.trim() || undefined,
      };
      updateCustomer(updated);
      showToast(`Đã cập nhật thông tin khách "${updated.name}"`);
    } else {
      // Create new
      saveCustomer({
        name: name.trim(),
        phone: phone.trim(),
        defaultLocationType: locationType,
        condoName: locationType === 'condo' ? selectedCondo?.name : undefined,
        block: locationType === 'condo' ? block.trim().toUpperCase() : undefined,
        floor: locationType === 'condo' ? floor.trim() : undefined,
        unit: locationType === 'condo' ? unit.trim() : undefined,
        externalAddress: locationType === 'external' ? externalAddress.trim() : undefined,
        deliveryNote: deliveryNote.trim() || undefined,
        debtLimit: parsedLimit,
        isVip: isVipInput,
        notes: notesInput.trim() || undefined,
      });
      showToast(`Đã lưu khách quen mới "${name.trim()}"`);
    }

    setShowModal(false);
  };

  // Delete customer
  const handleConfirmDelete = () => {
    if (!customerToDelete) return;
    deleteCustomer(customerToDelete.id);
    showToast(`Đã xóa khách hàng "${customerToDelete.name}"`);
    setCustomerToDelete(null);
  };

  // Instant Order Creation Shortcut
  const handleCreateOrderForCustomer = (cust: Customer) => {
    setSelectedCustomerForOrder(cust);
    setCurrentScreen('CREATE_ORDER');
  };

  // Filtered Customers List
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filterType !== 'ALL' && c.defaultLocationType !== filterType) {
        return false;
      }

      const debt = customerDebtMap.get(c.id);
      if (debtFilter === 'HAS_DEBT' && (!debt || debt.totalDebt <= 0)) {
        return false;
      }
      if (debtFilter === 'OVERDUE' && (!debt || !debt.isOverdue)) {
        return false;
      }
      if (debtFilter === 'OVER_LIMIT' && (!debt || !debt.isOverLimit)) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch = (c.phone || '').includes(q);
      const blockMatch = (c.block || '').toLowerCase().includes(q);
      const floorMatch = (c.floor || '').includes(q);
      const unitMatch = (c.unit || '').includes(q);
      const addressMatch = (c.externalAddress || '').toLowerCase().includes(q);
      const condoMatch = (c.condoName || '').toLowerCase().includes(q);
      const noteMatch = (c.deliveryNote || '').toLowerCase().includes(q);
      const combinedUnit = `${c.block || ''}-${c.floor || ''}-${c.unit || ''}`.toLowerCase();

      return (
        nameMatch ||
        phoneMatch ||
        blockMatch ||
        floorMatch ||
        unitMatch ||
        addressMatch ||
        condoMatch ||
        noteMatch ||
        combinedUnit.includes(q)
      );
    });
  }, [customers, filterType, debtFilter, searchQuery, customerDebtMap]);

  // Order stats per customer
  const getCustomerOrderStats = (cust: Customer) => {
    const custOrders = orders.filter(
      (o) =>
        (cust.phone && o.customerPhone === cust.phone) ||
        o.customerName.toLowerCase() === cust.name.toLowerCase()
    );
    const orderCount = custOrders.length;
    const totalSpent = custOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    return { orderCount, totalSpent };
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentScreen('HOME')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>

        <div className="text-center">
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide flex items-center justify-center gap-1.5">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>SỔ CÔNG NỢ & KHÁCH QUEN</span>
          </h2>
          <p className="text-[10px] text-slate-500 font-medium">
            Quản lý công nợ, đối soát Zalo & lưu địa chỉ giao 1 chạm
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md shadow-emerald-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Thêm khách</span>
        </button>
      </div>

      {/* Debt & Customer Overview Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 block">
                Tổng Hợp Công Nợ Khách Hàng
              </span>
              <p className="text-xl sm:text-2xl font-black font-mono text-white">
                {formatVND(totalAllDebt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setDebtFilter(debtFilter === 'HAS_DEBT' ? 'ALL' : 'HAS_DEBT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                debtFilter === 'HAS_DEBT'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-rose-200 border border-rose-400/30'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{debtorCount} khách đang nợ</span>
            </button>

            {overdueDebtorCount > 0 && (
              <button
                onClick={() => setDebtFilter(debtFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  debtFilter === 'OVERDUE'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{overdueDebtorCount} nợ quá hạn</span>
              </button>
            )}

            {overLimitCount > 0 && (
              <button
                onClick={() => setDebtFilter(debtFilter === 'OVER_LIMIT' ? 'ALL' : 'OVER_LIMIT')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  debtFilter === 'OVER_LIMIT'
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-400/40 hover:bg-purple-500/30'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{overLimitCount} vượt hạn mức</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Mini Stat Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs pt-1 border-t border-slate-800">
          <div className="bg-white/5 rounded-2xl p-2 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">Tổng khách lưu</span>
            <p className="text-base font-black font-mono text-white mt-0.5">{customers.length}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-2 border border-white/5">
            <span className="text-[10px] text-blue-300 block font-medium">Khách chung cư</span>
            <p className="text-base font-black font-mono text-blue-200 mt-0.5">
              {customers.filter((c) => c.defaultLocationType === 'condo').length}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-2 border border-white/5">
            <span className="text-[10px] text-emerald-300 block font-medium">Khách VIP</span>
            <p className="text-base font-black font-mono text-emerald-200 mt-0.5">
              {customers.filter((c) => c.isVip).length}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-2 border border-white/5">
            <span className="text-[10px] text-indigo-300 block font-medium">Khách ngoài</span>
            <p className="text-base font-black font-mono text-indigo-200 mt-0.5">
              {customers.filter((c) => c.defaultLocationType === 'external').length}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 space-y-2.5">
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm theo tên khách, số ĐT, căn hộ (e.g. B-20-10, Tuấn, Mai)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder:text-slate-400 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 p-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Row 1: Debt Filters */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
            Công nợ:
          </span>
          <button
            onClick={() => setDebtFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              debtFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setDebtFilter('HAS_DEBT')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
              debtFilter === 'HAS_DEBT'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <Wallet className="w-3 h-3" />
            <span>Có công nợ ({debtorCount})</span>
          </button>
          <button
            onClick={() => setDebtFilter('OVERDUE')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
              debtFilter === 'OVERDUE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Nợ quá hạn &gt;7 ngày ({overdueDebtorCount})</span>
          </button>
          {overLimitCount > 0 && (
            <button
              onClick={() => setDebtFilter('OVER_LIMIT')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                debtFilter === 'OVER_LIMIT'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Vượt hạn mức ({overLimitCount})</span>
            </button>
          )}
        </div>

        {/* Filter Row 2: Location Type & Clear */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Vị trí:
            </span>
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition ${
                filterType === 'ALL'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả vị trí
            </button>
            <button
              onClick={() => setFilterType('condo')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                filterType === 'condo'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <Building2 className="w-3 h-3" />
              <span>Chung cư ({customers.filter((c) => c.defaultLocationType === 'condo').length})</span>
            </button>
            <button
              onClick={() => setFilterType('external')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                filterType === 'external'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              <MapPin className="w-3 h-3" />
              <span>Khách ngoài ({customers.filter((c) => c.defaultLocationType === 'external').length})</span>
            </button>
          </div>

          {(searchQuery || filterType !== 'ALL' || debtFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('ALL');
                setDebtFilter('ALL');
              }}
              className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-0.5"
            >
              <X className="w-3 h-3" />
              <span>Xóa lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-3 shadow-xs">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">
              {searchQuery || filterType !== 'ALL'
                ? 'Không tìm thấy khách hàng phù hợp!'
                : 'Chưa có khách quen nào được lưu!'}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {searchQuery || filterType !== 'ALL'
                ? `Không có khách hàng nào khớp với từ khóa "${searchQuery}".`
                : 'Lưu khách quen thường đặt hàng cùng địa chỉ căn hộ để tạo đơn cực nhanh chỉ trong 1 chạm.'}
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95"
            >
              + Thêm khách hàng đầu tiên
            </button>
          </div>
        ) : (
          filteredCustomers.map((cust) => {
            const isCondo = cust.defaultLocationType === 'condo';
            const { orderCount, totalSpent } = getCustomerOrderStats(cust);

              const debt = customerDebtMap.get(cust.id) || calculateCustomerDebt(cust);
              const hasDebt = debt.totalDebt > 0;

              return (
                <div
                  key={cust.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border transition-all space-y-3 ${
                    debt.isOverdue
                      ? 'border-amber-300 ring-1 ring-amber-200'
                      : debt.isOverLimit
                      ? 'border-rose-300 ring-1 ring-rose-200'
                      : hasDebt
                      ? 'border-rose-200'
                      : 'border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  {/* Top Row: Address Badge, VIP, Type, Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isCondo ? (
                        <div className="flex items-center gap-1.5">
                          <span className="bg-blue-600 text-white font-black text-lg px-2.5 py-0.5 rounded-xl tracking-wider shadow-xs">
                            {cust.block}-{cust.floor ? cust.floor.padStart(2, '0') : '??'}-{cust.unit ? cust.unit.padStart(2, '0') : '??'}
                          </span>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            {cust.condoName || 'Chung cư'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                          📍 Khách ngoài
                        </span>
                      )}

                      {cust.isVip && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-700 border border-amber-300 flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5 text-amber-600" />
                          <span>VIP</span>
                        </span>
                      )}

                      {orderCount > 0 && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {orderCount} đơn • {formatVND(totalSpent)}
                        </span>
                      )}
                    </div>

                    {/* Edit / Delete Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditModal(cust)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition"
                        title="Chỉnh sửa thông tin khách"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCustomerToDelete(cust)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition"
                        title="Xóa khách này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Customer Details */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <h3 className="font-black text-slate-900 text-base flex items-center gap-1.5">
                        <span>{cust.name}</span>
                      </h3>
                      {cust.phone ? (
                        <a
                          href={`tel:${cust.phone}`}
                          className="text-blue-600 font-semibold flex items-center gap-1 hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{cust.phone}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Chưa có số ĐT</span>
                      )}
                    </div>

                    {/* Detailed Address */}
                    {isCondo ? (
                      <p className="text-xs text-slate-600 font-medium">
                        Block <strong>{cust.block}</strong>, Tầng <strong>{cust.floor}</strong>, Căn hộ <strong>{cust.unit}</strong> ({cust.condoName || 'Sunrise City'})
                      </p>
                    ) : (
                      <p className="text-xs text-slate-700 font-medium">
                        {cust.externalAddress}
                      </p>
                    )}
                  </div>

                  {/* DEBT SUMMARY STATUS CARD */}
                  <div
                    className={`rounded-xl p-2.5 text-xs flex flex-wrap items-center justify-between gap-2 border ${
                      hasDebt
                        ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                        : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                          {hasDebt ? 'Công nợ hiện tại:' : 'Tình trạng công nợ:'}
                        </span>
                        <span className="font-mono font-black text-sm">
                          {hasDebt ? formatVND(debt.totalDebt) : '0đ (Hết nợ)'}
                        </span>
                        {hasDebt && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-200/80 text-rose-800">
                            {debt.unpaidCount} đơn chưa trả
                          </span>
                        )}
                      </div>

                      {/* Warnings / Limit Status */}
                      <div className="flex items-center gap-2 flex-wrap text-[10px]">
                        {debt.isOverdue && (
                          <span className="font-bold text-amber-800 bg-amber-200/90 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Nợ {debt.daysSinceOldestDebt} ngày (&gt;7 ngày)</span>
                          </span>
                        )}
                        {debt.isOverLimit && (
                          <span className="font-bold text-purple-800 bg-purple-200/90 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Vượt hạn mức ({formatVND(cust.debtLimit!)})</span>
                          </span>
                        )}
                        {cust.debtLimit && !debt.isOverLimit && (
                          <span className="text-slate-500 font-medium">
                            Hạn mức nợ: {formatVND(cust.debtLimit)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Button inside banner */}
                    {hasDebt && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForReminder(cust)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs transition active:scale-95 ${
                            debt.isOverdue
                              ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                          }`}
                          title="Tạo tin nhắc nợ Zalo hoặc SMS tự động"
                        >
                          <BellRing className="w-3 h-3 text-amber-100" />
                          <span>Nhắc nợ Zalo/SMS</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForZalo(cust)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs transition active:scale-95"
                          title="Tạo bảng sao kê đối soát gửi Zalo cho khách"
                        >
                          <MessageCircle className="w-3 h-3 text-blue-200" />
                          <span>Đối soát Zalo</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delivery Note or Customer Note if present */}
                  {(cust.deliveryNote || cust.notes) && (
                    <div className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-0.5">
                      {cust.deliveryNote && (
                        <p className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Ghi chú giao: <strong>{cust.deliveryNote}</strong></span>
                        </p>
                      )}
                      {cust.notes && (
                        <p className="text-slate-500 italic">
                          📝 {cust.notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ACTION BAR: SỔ CÔNG NỢ & LÊN ĐƠN */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerForLedger(cust)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 ${
                        hasDebt
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                      }`}
                      title="Mở Sổ Quản lý Công nợ chi tiết của khách"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>SỔ CÔNG NỢ</span>
                      {hasDebt && (
                        <span className="text-[10px] bg-indigo-900 text-indigo-200 px-1 rounded-sm">
                          {debt.unpaidCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCreateOrderForCustomer(cust)}
                      className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95"
                      title="Tạo đơn hàng mới 1 chạm cho khách này"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-200" />
                      <span>LÊN ĐƠN MỚI</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      {/* ADD / EDIT CUSTOMER MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <h3 className="font-black text-base uppercase tracking-wide">
                  {editingCustomer ? 'Chỉnh sửa khách quen' : 'Thêm khách quen mới'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveForm} className="p-4 space-y-3.5 overflow-y-auto max-h-[75vh]">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs font-bold">
                  ⚠️ {formError}
                </div>
              )}

              {/* Name & Phone */}
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Tên khách hàng *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Anh Tuấn, Chị Mai..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 0901234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Location Type Tab */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Loại địa chỉ giao hàng
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLocationType('condo')}
                    className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition ${
                      locationType === 'condo'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Giao chung cư</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationType('external')}
                    className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition ${
                      locationType === 'external'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Khách ngoài</span>
                  </button>
                </div>
              </div>

              {/* Condo fields */}
              {locationType === 'condo' ? (
                <div className="space-y-2.5 bg-blue-50/60 p-3 rounded-2xl border border-blue-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Chung cư / Tòa nhà
                    </label>
                    <select
                      value={condoId}
                      onChange={(e) => {
                        setCondoId(e.target.value);
                        const c = condos.find((item) => item.id === e.target.value);
                        if (c && c.blocks.length > 0) setBlock(c.blocks[0]);
                      }}
                      className="w-full px-3 py-1.5 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-800"
                    >
                      {condos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Chọn Block *
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCondo?.blocks.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setBlock(b)}
                          className={`min-w-[40px] py-1 px-2.5 rounded-lg font-black text-xs transition ${
                            block.toUpperCase() === b.toUpperCase()
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Tầng (Floor) *
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 20"
                        value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Số căn (Unit) *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 10"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Formatted address live preview */}
                  <div className="flex items-center gap-1.5 text-xs text-blue-900 bg-white p-2 rounded-xl border border-blue-200">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      Định dạng chuẩn: <strong>{block}-{floor ? floor.padStart(2, '0') : '??'}-{unit ? unit.padStart(2, '0') : '??'}</strong> ({selectedCondo?.name})
                    </span>
                  </div>
                </div>
              ) : (
                /* External Address */
                <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-100 space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600">
                    Địa chỉ giao hàng (Số nhà, Tên đường, Quận) *
                  </label>
                  <textarea
                    placeholder="e.g. 128 Nguyễn Trãi, P. Bến Thành, Quận 1 (Tòa nhà AB, Lầu 3)"
                    rows={2}
                    value={externalAddress}
                    onChange={(e) => setExternalAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
              )}

              {/* Delivery Note */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Ghi chú giao hàng mặc định (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bấm chuông để cửa, Treo trước cửa..."
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500"
                />
              </div>

              {/* Debt Limit & VIP toggle */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="text-[11px] font-black uppercase text-indigo-900 tracking-wider block">
                  ⚙️ Cài đặt công nợ & VIP
                </span>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Hạn mức nợ tối đa (VND) - Để trống nếu không giới hạn
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 500000, 1000000"
                    value={debtLimitInput}
                    onChange={(e) => setDebtLimitInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Hệ thống sẽ cảnh báo khi tổng nợ của khách vượt quá số tiền này.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="vipCheckbox"
                    checked={isVipInput}
                    onChange={(e) => setIsVipInput(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                  />
                  <label
                    htmlFor="vipCheckbox"
                    className="text-xs font-bold text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>Đánh dấu là Khách hàng VIP</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Ghi chú nội bộ về khách (Chỉ quán xem)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Khách thanh toán định kỳ cuối tuần, hay đặt cà phê sáng..."
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-medium rounded-xl bg-white border border-slate-200 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition"
                >
                  {editingCustomer ? 'Cập nhật' : 'Lưu khách hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-black text-slate-800 text-base">Xóa khách quen?</h3>
              <p className="text-xs text-slate-500">
                Bạn có chắc muốn xóa khách hàng <strong>"{customerToDelete.name}"</strong> khỏi danh sách khách quen?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setCustomerToDelete(null)}
                className="py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmDelete}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-rose-600/25 active:scale-95 transition"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER DEBT LEDGER MODAL */}
      {selectedCustomerForLedger && (
        <CustomerDebtLedgerModal
          customer={selectedCustomerForLedger}
          isOpen={Boolean(selectedCustomerForLedger)}
          onClose={() => setSelectedCustomerForLedger(null)}
          onOpenCreateOrder={(c) => handleCreateOrderForCustomer(c)}
        />
      )}

      {/* ZALO DEBT STATEMENT MODAL */}
      {selectedCustomerForZalo && (
        <ZaloDebtStatementModal
          customer={selectedCustomerForZalo}
          unpaidOrders={
            (
              customerDebtMap.get(selectedCustomerForZalo.id) ||
              calculateCustomerDebt(selectedCustomerForZalo)
            ).unpaidOrders
          }
          isOpen={Boolean(selectedCustomerForZalo)}
          onClose={() => setSelectedCustomerForZalo(null)}
        />
      )}

      {/* AUTOMATED OVERDUE DEBT REMINDER MODAL (ZALO / SMS) */}
      {selectedCustomerForReminder && (
        <CustomerDebtReminderModal
          customer={selectedCustomerForReminder}
          unpaidOrders={
            (
              customerDebtMap.get(selectedCustomerForReminder.id) ||
              calculateCustomerDebt(selectedCustomerForReminder)
            ).unpaidOrders
          }
          isOpen={Boolean(selectedCustomerForReminder)}
          onClose={() => setSelectedCustomerForReminder(null)}
          daysOverdue={
            (
              customerDebtMap.get(selectedCustomerForReminder.id) ||
              calculateCustomerDebt(selectedCustomerForReminder)
            ).daysSinceOldestDebt
          }
        />
      )}
    </div>
  );
};
