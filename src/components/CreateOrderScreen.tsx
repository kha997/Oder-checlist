import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  LocationType,
  PaymentMethod,
  OrderItem,
  OrderLocation,
  Customer,
  PREDEFINED_ORDER_TAGS,
  getOrderTagColor,
  OrderPriority,
  ORDER_PRIORITY_OPTIONS,
  DeliveryStatus,
  RecurringFrequency,
  RECURRING_FREQUENCY_OPTIONS,
  calculateNextRecurringDate,
} from '../types';
import { formatVND } from '../utils/storage';
import { removeVietnameseTones } from '../utils/searchHelper';
import { GooglePlacesAddressLookup } from './GooglePlacesAddressLookup';
import { GooglePlaceSuggestion } from '../utils/googlePlacesService';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Plus,
  Minus,
  Check,
  User,
  Phone,
  FileText,
  PlusCircle,
  Sparkles,
  Lock,
  Users,
  Search,
  X,
  Tag,
  AlertTriangle,
  Truck,
  Clock,
  CheckCircle2,
  Repeat,
  Calendar,
} from 'lucide-react';

export const CreateOrderScreen: React.FC = () => {
  const {
    products,
    condos,
    customers,
    createOrder,
    saveCustomer,
    addBlockToCondo,
    addCondo,
    selectedCustomerForOrder,
    setSelectedCustomerForOrder,
    setCurrentScreen,
  } = useApp();

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('condo');

  // Condo fields
  const [selectedCondoId, setSelectedCondoId] = useState(condos[0]?.id || '');
  const [selectedBlock, setSelectedBlock] = useState('B');
  const [floor, setFloor] = useState('');
  const [unit, setUnit] = useState('');
  const [newBlockInput, setNewBlockInput] = useState('');
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [showNewCondoModal, setShowNewCondoModal] = useState(false);
  const [newCondoName, setNewCondoName] = useState('');

  // External fields
  const [externalAddress, setExternalAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [internalNote, setInternalNote] = useState('');

  // Tagging State (Urgent, Gift, Subscription, custom tags...)
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');

  // Priority Tagging State (LOW, MEDIUM, HIGH)
  const [priority, setPriority] = useState<OrderPriority>('MEDIUM');

  // Delivery Status Tracking State (PENDING, OUT_FOR_DELIVERY, DELIVERED)
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('PENDING');

  // Recurring Order State (Daily, Weekly, Bi-weekly, Monthly)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('WEEKLY');
  const [nextRecurringDate, setNextRecurringDate] = useState<string>(() =>
    calculateNextRecurringDate(new Date().toISOString(), 'WEEKLY')
  );

  // Items State (mapping productId -> quantity)
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

  // Payment State
  const [isPaid, setIsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  // Feedback State
  const [errorMessage, setErrorMessage] = useState('');
  const [successOrder, setSuccessOrder] = useState<string | null>(null);

  // Quick Customer Selector Modal State
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Standardized Place Details from Google Places Lookup
  const [placeDetails, setPlaceDetails] = useState<{
    placeId?: string;
    standardizedAddress?: string;
    district?: string;
    ward?: string;
    city?: string;
    lat?: number;
    lng?: number;
  }>({});

  const activeCondo = condos.find((c) => c.id === selectedCondoId) || condos[0];

  const handleSelectGooglePlace = (res: {
    place: GooglePlaceSuggestion;
    locationType: 'condo' | 'external';
    condoName?: string;
    block?: string;
    floor?: string;
    unit?: string;
    formattedAddress: string;
    externalAddress?: string;
    ward?: string;
    district?: string;
    city?: string;
    lat?: number;
    lng?: number;
  }) => {
    setLocationType(res.locationType);
    setPlaceDetails({
      placeId: res.place.placeId,
      standardizedAddress: res.formattedAddress,
      ward: res.ward,
      district: res.district,
      city: res.city,
      lat: res.lat,
      lng: res.lng,
    });

    if (res.locationType === 'condo') {
      const targetName = res.condoName || res.place.name;
      const cleanTarget = removeVietnameseTones(targetName.toLowerCase());
      const matchedCondo = condos.find(
        (c) =>
          c.name.toLowerCase().includes(targetName.toLowerCase()) ||
          cleanTarget.includes(removeVietnameseTones(c.name.toLowerCase()))
      );

      if (!matchedCondo && targetName) {
        addCondo(targetName, res.place.suggestedBlocks || ['A', 'B', 'C', 'D']);
      } else if (matchedCondo) {
        setSelectedCondoId(matchedCondo.id);
      }

      if (res.block) setSelectedBlock(res.block);
      if (res.floor) setFloor(res.floor);
      if (res.unit) setUnit(res.unit);
    } else {
      if (res.externalAddress) {
        setExternalAddress(res.externalAddress);
      }
    }
  };

  const applyCustomer = (cust: Customer) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || '');
    setLocationType(cust.defaultLocationType);

    if (cust.defaultLocationType === 'condo') {
      const matchCondo = condos.find((c) => c.name === cust.condoName);
      if (matchCondo) setSelectedCondoId(matchCondo.id);
      if (cust.block) setSelectedBlock(cust.block);
      if (cust.floor) setFloor(cust.floor);
      if (cust.unit) setUnit(cust.unit);
    } else {
      if (cust.externalAddress) setExternalAddress(cust.externalAddress);
    }
    if (cust.deliveryNote) setDeliveryNote(cust.deliveryNote);
  };

  const handleSelectCustomer = (custId: string) => {
    const cust = customers.find((c) => c.id === custId);
    if (!cust) return;
    applyCustomer(cust);
  };

  // If customer pre-selected from CustomersScreen
  useEffect(() => {
    if (selectedCustomerForOrder) {
      applyCustomer(selectedCustomerForOrder);
      setSelectedCustomerForOrder(null);
    }
  }, [selectedCustomerForOrder]);

  const updateQuantity = (productId: string, delta: number) => {
    setItemQuantities((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  // Selected items calculation
  const orderItems: OrderItem[] = Object.entries(itemQuantities)
    .filter(([_, qty]) => qty > 0)
    .map(([prodId, qty]) => {
      const p = products.find((prod) => prod.id === prodId)!;
      return {
        productId: p.id,
        productName: p.name,
        quantity: qty,
        unitPrice: p.price,
        lineTotal: p.price * qty,
        unit: p.unit,
        cost: p.cost,
        price: p.price,
      };
    });

  const totalAmount = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalCost = orderItems.reduce((sum, item) => sum + (item.cost !== undefined ? item.cost : Math.round(item.unitPrice * 0.45)) * item.quantity, 0);

  // Formatted address preview
  const formattedAddress =
    locationType === 'condo'
      ? `${selectedBlock || '?'}-${floor ? floor.padStart(2, '0') : '?'}-${unit ? unit.padStart(2, '0') : '?'}`
      : externalAddress.trim();

  const handleAddBlock = () => {
    if (!newBlockInput.trim() || !activeCondo) return;
    addBlockToCondo(activeCondo.id, newBlockInput.trim());
    setSelectedBlock(newBlockInput.trim().toUpperCase());
    setNewBlockInput('');
    setShowAddBlock(false);
  };

  const handleAddNewCondo = () => {
    if (!newCondoName.trim()) return;
    addCondo(newCondoName.trim(), ['A', 'B', 'C']);
    setNewCondoName('');
    setShowNewCondoModal(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customerName.trim()) {
      setErrorMessage('Vui lòng nhập tên khách hàng (Customer Name required)');
      return;
    }

    if (orderItems.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 sản phẩm (Select at least 1 product)');
      return;
    }

    if (locationType === 'condo') {
      if (!selectedBlock.trim() || !floor.trim() || !unit.trim()) {
        setErrorMessage('Vui lòng nhập đầy đủ Block, Tầng và Số phòng (e.g. B-20-10)');
        return;
      }
    } else {
      if (!externalAddress.trim()) {
        setErrorMessage('Vui lòng nhập địa chỉ giao hàng cho khách ngoài');
        return;
      }
    }

    const loc: OrderLocation = {
      type: locationType,
      condoName: locationType === 'condo' ? activeCondo?.name : undefined,
      block: locationType === 'condo' ? selectedBlock.toUpperCase() : undefined,
      floor: locationType === 'condo' ? floor.trim() : undefined,
      unit: locationType === 'condo' ? unit.trim() : undefined,
      formattedAddress,
      externalAddress: locationType === 'external' ? externalAddress.trim() : undefined,
      deliveryNote: deliveryNote.trim() || undefined,
      placeId: placeDetails.placeId,
      standardizedAddress:
        placeDetails.standardizedAddress ||
        (locationType === 'condo' ? `${formattedAddress} (${activeCondo?.name})` : externalAddress.trim()),
      ward: placeDetails.ward,
      district: placeDetails.district,
      city: placeDetails.city,
      lat: placeDetails.lat,
      lng: placeDetails.lng,
    };

    // Save customer for fast future suggestions
    saveCustomer({
      name: customerName.trim(),
      phone: customerPhone.trim(),
      defaultLocationType: locationType,
      condoName: loc.condoName,
      block: loc.block,
      floor: loc.floor,
      unit: loc.unit,
      externalAddress: loc.externalAddress,
      deliveryNote: loc.deliveryNote,
    });

    const newOrder = createOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      items: orderItems,
      cost: totalCost,
      price: totalAmount,
      location: loc,
      deliveryNote: deliveryNote.trim() || undefined,
      note: deliveryNote.trim() || undefined,
      internalNote: internalNote.trim() || undefined,
      paymentStatus: isPaid ? 'PAID' : 'UNPAID',
      paymentMethod: isPaid ? paymentMethod : undefined,
      tags: selectedTags,
      priority: priority,
      deliveryStatus: deliveryStatus,
      isRecurring: isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      nextRecurringDate: isRecurring ? nextRecurringDate : undefined,
      recurringActive: isRecurring ? true : undefined,
    });

    setSuccessOrder(newOrder.id);
  };

  // Tag selection helpers
  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
      setCustomTagInput('');
    }
  };

  // Quick preset loader helper
  const handleQuickPreset = (preset: 'B2010' | 'B1501' | 'B1205' | 'EXTERNAL') => {
    if (preset === 'B2010') {
      setCustomerName('Anh Tuấn');
      setCustomerPhone('0901234567');
      setLocationType('condo');
      setSelectedBlock('B');
      setFloor('20');
      setUnit('10');
      setDeliveryNote('Bấm chuông để cửa');
      setSelectedTags(['Urgent', 'VIP']);
      setPriority('HIGH');
      if (products.length >= 2) {
        setItemQuantities({
          [products[0].id]: 2,
          [products[2] ? products[2].id : products[1].id]: 1,
        });
      }
    } else if (preset === 'B1501') {
      setCustomerName('Chị Mai');
      setCustomerPhone('0912345678');
      setLocationType('condo');
      setSelectedBlock('B');
      setFloor('15');
      setUnit('01');
      setDeliveryNote('Treo trước cửa giúp em');
      setSelectedTags(['Subscription']);
      setPriority('MEDIUM');
      if (products.length >= 2) {
        setItemQuantities({ [products[1].id]: 2 });
      }
      setIsPaid(false);
    } else if (preset === 'B1205') {
      setCustomerName('Anh Dũng');
      setCustomerPhone('0987654321');
      setLocationType('condo');
      setSelectedBlock('B');
      setFloor('12');
      setUnit('05');
      setDeliveryNote('Nhà có em bé ngủ');
      setSelectedTags(['Gift']);
      setPriority('HIGH');
      if (products.length >= 4) {
        setItemQuantities({ [products[3].id]: 2, [products[0].id]: 1 });
      }
      setIsPaid(true);
      setPaymentMethod('BANK_TRANSFER');
    } else if (preset === 'EXTERNAL') {
      setCustomerName('Chị Lan (Khách ngoài)');
      setCustomerPhone('0933445566');
      setLocationType('external');
      setExternalAddress('72 Lê Lợi, P. Bến Nghé, Quận 1 (Tòa nhà AB)');
      setDeliveryNote('Giao sảnh bảo vệ, gọi trước 5 phút');
      setSelectedTags(['Urgent']);
      setPriority('LOW');
      if (products.length >= 3) {
        setItemQuantities({ [products[2].id]: 2 });
      }
      setIsPaid(false);
    }
  };

  if (successOrder) {
    return (
      <div className="bg-white rounded-3xl p-6 shadow-md border border-emerald-100 text-center space-y-4 my-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-800">TẠO ĐƠN THÀNH CÔNG!</h3>
          <p className="text-sm font-bold text-emerald-700 mt-1">Mã đơn: {successOrder}</p>
          <p className="text-xs text-slate-500 mt-1">
            Đơn hàng đã được thêm vào danh sách giao và tự động cập nhật kho hàng.
          </p>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl text-left text-xs space-y-1.5 border border-slate-200">
          <div className="flex justify-between font-medium text-slate-600">
            <span>Khách hàng:</span>
            <span className="font-bold text-slate-800">{customerName}</span>
          </div>
          <div className="flex justify-between font-medium text-slate-600">
            <span>Địa chỉ:</span>
            <span className="font-bold text-slate-800">{formattedAddress}</span>
          </div>
          <div className="flex justify-between font-medium text-slate-600">
            <span>Tổng tiền:</span>
            <span className="font-bold text-emerald-700 text-sm">{formatVND(totalAmount)}</span>
          </div>
          <div className="flex justify-between font-medium text-slate-600">
            <span>Trạng thái thu tiền:</span>
            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {isPaid ? `Đã thanh toán (${paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'})` : 'Chưa thu tiền (Unpaid)'}
            </span>
          </div>
          {deliveryNote && (
            <div className="flex justify-between font-medium text-slate-600 pt-1 border-t border-slate-200">
              <span className="flex items-center gap-1 text-amber-700">
                <FileText className="w-3 h-3" /> Ghi chú giao hàng:
              </span>
              <span className="font-bold text-amber-900 max-w-[200px] text-right truncate">{deliveryNote}</span>
            </div>
          )}
          {internalNote && (
            <div className="flex justify-between font-medium text-slate-600 pt-1 border-t border-slate-200">
              <span className="flex items-center gap-1 text-purple-700">
                <Lock className="w-3 h-3" /> Ghi chú nội bộ:
              </span>
              <span className="font-bold text-purple-900 max-w-[200px] text-right truncate">{internalNote}</span>
            </div>
          )}
          {selectedTags.length > 0 && (
            <div className="flex justify-between items-center font-medium text-slate-600 pt-1 border-t border-slate-200">
              <span className="flex items-center gap-1 text-rose-700">
                <Tag className="w-3 h-3" /> Nhãn phân loại:
              </span>
              <div className="flex flex-wrap gap-1 justify-end">
                {selectedTags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-between items-center font-medium text-slate-600 pt-1 border-t border-slate-200">
            <span className="flex items-center gap-1 text-slate-700">
              <AlertTriangle className="w-3 h-3 text-amber-600" /> Mức ưu tiên:
            </span>
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                priority === 'HIGH'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : priority === 'LOW'
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {priority === 'HIGH' ? '🔥 Cao (High)' : priority === 'LOW' ? '💤 Thấp (Low)' : '⚡ Trung bình (Medium)'}
            </span>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              setSuccessOrder(null);
              setCustomerName('');
              setCustomerPhone('');
              setFloor('');
              setUnit('');
              setExternalAddress('');
              setDeliveryNote('');
              setInternalNote('');
              setItemQuantities({});
              setIsPaid(false);
              setSelectedTags([]);
              setCustomTagInput('');
              setPriority('MEDIUM');
            }}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
          >
            + Tạo đơn tiếp
          </button>
          <button
            onClick={() => setCurrentScreen('DELIVERY')}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs"
          >
            Xem giao hàng →
          </button>
        </div>
      </div>
    );
  }

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
        <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">
          TẠO ĐƠN HÀNG MỚI
        </h2>
        <div className="w-16"></div>
      </div>

      {/* Quick Preset Buttons for rapid testing */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Điền nhanh kiểm thử (Test Scenario Presets):
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => handleQuickPreset('B2010')}
            className="px-1.5 py-1 text-[10px] font-bold bg-white text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition"
          >
            B-20-10
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('B1501')}
            className="px-1.5 py-1 text-[10px] font-bold bg-white text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition"
          >
            B-15-01 (Nợ)
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('B1205')}
            className="px-1.5 py-1 text-[10px] font-bold bg-white text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition"
          >
            B-12-05 (CK)
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('EXTERNAL')}
            className="px-1.5 py-1 text-[10px] font-bold bg-white text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition"
          >
            Khách ngoài
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs font-bold animate-shake">
          ⚠️ {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SECTION 1: CUSTOMER INFO */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              1. Khách hàng (Customer)
            </h3>

            <div className="flex items-center gap-1.5 flex-wrap">
              {customers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-200/80 flex items-center gap-1 active:scale-95 transition"
                  title="Tìm và chọn khách quen"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Chọn từ danh bạ ({customers.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setCurrentScreen('CUSTOMERS')}
                className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[11px] font-semibold hover:bg-slate-100 rounded-lg transition"
                title="Quản lý danh sách khách quen"
              >
                Quản lý khách →
              </button>
            </div>
          </div>

          {/* Quick Selection Dropdown if available */}
          {customers.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                Gợi ý nhanh:
              </span>
              {customers.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCustomer(c.id)}
                  className="shrink-0 px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 transition active:scale-95"
                >
                  {c.name} ({c.defaultLocationType === 'condo' ? `${c.block}-${c.floor}-${c.unit}` : 'Ngoài'})
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Tên khách hàng *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Anh Tuấn, Chị Mai..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Số điện thoại
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="0901234567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: DELIVERY LOCATION (APARTMENT VS EXTERNAL) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              2. Địa điểm giao hàng (Delivery Location)
            </h3>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Google Places Enabled
            </span>
          </div>

          {/* GOOGLE PLACES-LIKE ADDRESS LOOKUP & STANDARDIZATION */}
          <GooglePlacesAddressLookup onSelectPlace={handleSelectGooglePlace} />

          {/* Manual Location Type Overrides / Fine-tuning */}
          <div className="pt-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Hoặc chuyển đổi phương thức giao:</span>
              <span className="text-[10px] text-slate-400 font-normal">Tùy chỉnh thủ công</span>
            </div>

            {/* Toggle Type */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setLocationType('condo')}
                className={`py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  locationType === 'condo'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Chung cư / Căn hộ</span>
              </button>
              <button
                type="button"
                onClick={() => setLocationType('external')}
                className={`py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  locationType === 'external'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Khách ngoài / Gặp mặt</span>
              </button>
            </div>
          </div>

          {/* If CONDO */}
          {locationType === 'condo' ? (
            <div className="space-y-3 pt-1">
              {/* Condo selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-600">Chọn Chung cư / Dự án</label>
                  <button
                    type="button"
                    onClick={() => setShowNewCondoModal(true)}
                    className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Thêm chung cư
                  </button>
                </div>
                <select
                  value={selectedCondoId}
                  onChange={(e) => {
                    setSelectedCondoId(e.target.value);
                    const found = condos.find((c) => c.id === e.target.value);
                    if (found && found.blocks.length > 0) {
                      setSelectedBlock(found.blocks[0]);
                    }
                  }}
                  className="w-full py-2 px-3 text-sm font-semibold rounded-xl bg-slate-50 border border-slate-200"
                >
                  {condos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Block Selection (DO NOT HARDCODE) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600">
                    Chọn Block / Tòa nhà *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddBlock(!showAddBlock)}
                    className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Thêm Block mới
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {activeCondo?.blocks.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSelectedBlock(b)}
                      className={`min-w-[42px] px-3 py-1.5 rounded-xl text-xs font-black transition active:scale-95 ${
                        selectedBlock === b
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600 ring-offset-1'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>

                {showAddBlock && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="e.g. S7, Park 2..."
                      value={newBlockInput}
                      onChange={(e) => setNewBlockInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={handleAddBlock}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg"
                    >
                      Lưu Block
                    </button>
                  </div>
                )}
              </div>

              {/* Floor & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Tầng (Floor) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    placeholder="e.g. 20, 15, 12"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full px-3 py-2 text-base font-black text-center rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Căn hộ (Unit) *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 10, 01, 05"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 text-base font-black text-center rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Live Preview of formatted apartment address */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-[11px] text-emerald-800 font-semibold">Địa chỉ hiển thị:</span>
                <span className="text-base font-black text-emerald-900 tracking-wider">
                  {formattedAddress}
                </span>
              </div>
            </div>
          ) : (
            /* If EXTERNAL */
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Địa chỉ tự do / Điểm hẹn (Free-form address) *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 72 Lê Lợi, Bến Nghé, Quận 1 (Tòa nhà AB - sảnh lễ tân)"
                  value={externalAddress}
                  onChange={(e) => setExternalAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500"
                  required
                />
              </div>
            </div>
          )}

          {/* Notes / Special Delivery Instructions TextArea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ghi chú đơn hàng & Hướng dẫn giao hàng (Notes / Delivery Instructions)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-semibold">(Tùy chọn / Optional)</span>
            </div>
            <div className="relative">
              <textarea
                rows={3}
                placeholder="Nhập hướng dẫn giao hàng đặc biệt (ví dụ: Gate code 1234, Leave at front desk, Treo trước cửa, gọi trước 5 phút, gửi sảnh lễ tân...)"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-medium rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder:text-slate-400 transition"
              />
            </div>

            {/* Quick chips for rapid one-touch entry */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-slate-400">Gợi ý nhanh:</span>
              {[
                'Gate code 1234',
                'Leave at front desk',
                'Treo trước cửa',
                'Gọi trước 5 phút',
                'Bấm chuông để cửa',
                'Gửi sảnh lễ tân',
                'Giao sảnh bảo vệ',
                'Nhà có em bé ngủ',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setDeliveryNote((prev) => (prev ? `${prev}, ${chip}` : chip))}
                  className="text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200 transition active:scale-95 font-semibold"
                >
                  +{chip}
                </button>
              ))}
              {deliveryNote && (
                <button
                  type="button"
                  onClick={() => setDeliveryNote('')}
                  className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-1"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: PRODUCTS & QUANTITY (ONE OR MULTIPLE) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-600 tracking-wider">
              3. Chọn món (Products & Quantity)
            </h3>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {orderItems.length} món đã chọn
            </span>
          </div>

          <div className="space-y-2">
            {products.map((p) => {
              const qty = itemQuantities[p.id] || 0;
              const isSelected = qty > 0;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/40 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex-1 pr-2">
                    <p className="text-sm font-bold text-slate-800 leading-tight">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-extrabold text-emerald-700">
                        {formatVND(p.price)}
                      </span>
                      <span className="text-[10px] text-slate-500">/{p.unit}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        Kho: {p.currentStock}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(p.id, -1)}
                      disabled={qty === 0}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold transition active:scale-95 ${
                        qty > 0
                          ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                          : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <span className="w-7 text-center font-black text-base text-slate-800">
                      {qty}
                    </span>

                    <button
                      type="button"
                      onClick={() => updateQuantity(p.id, 1)}
                      className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center font-bold transition"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Total Line */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Tổng tiền đơn hàng:</span>
            <span className="text-lg font-black text-emerald-800">{formatVND(totalAmount)}</span>
          </div>
        </div>

        {/* SECTION 4: PAYMENT STATUS & METHOD (INDEPENDENT FROM DELIVERY) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-600 tracking-wider">
              4. Thanh toán (Payment)
            </h3>
            <span className="text-[11px] text-slate-500">Độc lập với giao hàng</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsPaid(false)}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                !isPaid
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>CHƯA THU TIỀN (UNPAID)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPaid(true)}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                isPaid
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>ĐÃ THU TIỀN (PAID)</span>
            </button>
          </div>

          {/* Payment Method Selector if PAID */}
          {isPaid && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-[11px] font-bold text-slate-600">
                Hình thức thanh toán (Method):
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 rounded-xl text-xs font-bold transition ${
                    paymentMethod === 'CASH'
                      ? 'bg-emerald-100 text-emerald-900 border-2 border-emerald-600'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  💵 Tiền mặt (Cash)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK_TRANSFER')}
                  className={`py-2 rounded-xl text-xs font-bold transition ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'bg-blue-100 text-blue-900 border-2 border-blue-600'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  🏦 Chuyển khoản (Bank)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: INTERNAL NOTE (GHI CHÚ NỘI BỘ DÀNH CHO NGƯỜI BÁN) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-600" />
              5. Ghi chú nội bộ (Internal Note)
            </h3>
            <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full border border-purple-200/60">
              Chỉ người bán thấy (Seller context)
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Ghi chú riêng của quán / Thông tin bổ sung
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Khách quen hay đổi món, hẹn giao đúng 11h45, ít ngọt, xuất hóa đơn công ty..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-slate-800 placeholder:text-slate-400 transition"
            />

            {/* Quick chips for rapid one-touch entry */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-slate-400">Gợi ý nhanh:</span>
              {['Khách quen', 'Giao gấp', 'Ít ngọt', 'Không cay', 'Báo bếp làm nóng', 'Cần hóa đơn'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setInternalNote((prev) => (prev ? `${prev}, ${chip}` : chip))}
                  className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/70 font-semibold px-2 py-0.5 rounded-lg active:scale-95 transition"
                >
                  +{chip}
                </button>
              ))}
              {internalNote && (
                <button
                  type="button"
                  onClick={() => setInternalNote('')}
                  className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-1"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 6: GẮN NHÃN PHÂN LOẠI (ORDER TAGS) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-rose-600" />
              6. Gắn nhãn phân loại (Order Tags)
            </h3>
            <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full border border-rose-200/60">
              {selectedTags.length > 0 ? `${selectedTags.length} nhãn đã chọn` : 'Tùy chọn'}
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Chọn một hoặc nhiều nhãn để phân loại đơn hàng (Gấp, Quà tặng, Định kỳ, Khách VIP...)
          </p>

          {/* Multi-select tag picker */}
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_ORDER_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 border ${
                    isSelected
                      ? `${tag.color} ring-2 ring-rose-500/40 font-extrabold shadow-sm`
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Tag className={`w-3 h-3 ${isSelected ? 'fill-current' : 'text-slate-400'}`} />
                  <span>{tag.label}</span>
                  {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </div>

          {/* Custom tags entered by user */}
          {selectedTags.filter((t) => !PREDEFINED_ORDER_TAGS.some((p) => p.id === t)).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-400">Nhãn tùy chỉnh:</span>
              {selectedTags
                .filter((t) => !PREDEFINED_ORDER_TAGS.some((p) => p.id === t))
                .map((customTag) => (
                  <span
                    key={customTag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 shadow-sm"
                  >
                    <Tag className="w-3 h-3" />
                    <span>{customTag}</span>
                    <button
                      type="button"
                      onClick={() => toggleTag(customTag)}
                      className="hover:bg-teal-200/60 rounded-full p-0.5 text-teal-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}

          {/* Custom tag input */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Thêm nhãn tự tạo (e.g. Ăn trưa, Công ty, Khách ruột...)"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                className="w-full pl-7 pr-3 py-1.5 text-xs font-medium rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
              <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>
            <button
              type="button"
              onClick={handleAddCustomTag}
              disabled={!customTagInput.trim()}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                customTagInput.trim()
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>Thêm nhãn</span>
            </button>
          </div>
        </div>

        {/* SECTION 7: MỨC ĐỘ ƯU TIÊN (PRIORITY TAGGING SYSTEM: LOW, MEDIUM, HIGH) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              7. Mức độ ưu tiên (Priority Tagging)
            </h3>
            <span
              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                priority === 'HIGH'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : priority === 'LOW'
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {priority === 'HIGH' ? '🔥 Ưu tiên Cao' : priority === 'LOW' ? '💤 Ưu tiên Thấp' : '⚡ Ưu tiên Trung bình'}
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Gắn nhãn mức độ ưu tiên (Low, Medium, High) để shipper và người bán xếp thứ tự chuẩn bị và giao hàng.
          </p>

          <div className="grid grid-cols-3 gap-2.5">
            {ORDER_PRIORITY_OPTIONS.map((opt) => {
              const isSelected = priority === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPriority(opt.id)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between active:scale-95 ${
                    isSelected
                      ? `${opt.bgLight} ${opt.borderColor} ring-2 ring-purple-600 shadow-sm`
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`w-3 h-3 rounded-full ${opt.dotColor} shadow-2xs`} />
                    {isSelected && <Check className={`w-4 h-4 ${opt.textColor} stroke-[3]`} />}
                  </div>
                  <div className="mt-2.5">
                    <p className={`text-xs font-black ${isSelected ? opt.textColor : 'text-slate-800'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 8: TRẠNG THÁI GIAO HÀNG (DELIVERY STATUS TRACKING) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span>8. Trạng thái giao nhận (Status Tracking)</span>
            </h3>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                deliveryStatus === 'OUT_FOR_DELIVERY' || deliveryStatus === 'READY_FOR_DELIVERY'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : deliveryStatus === 'DELIVERED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {deliveryStatus === 'OUT_FOR_DELIVERY' || deliveryStatus === 'READY_FOR_DELIVERY'
                ? '🚚 Đang giao (Out for Delivery)'
                : deliveryStatus === 'DELIVERED'
                ? '✓ Đã giao xong (Delivered)'
                : '⏳ Chờ xử lý (Pending)'}
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            Chọn trạng thái ban đầu của đơn hàng (Pending, Out for Delivery, hoặc Delivered nếu đã giao tại chỗ).
          </p>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setDeliveryStatus('PENDING')}
              className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 active:scale-95 ${
                deliveryStatus === 'PENDING'
                  ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/30 font-black shadow-xs'
                  : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-5 h-5 text-amber-600" />
              <span className="text-xs font-bold mt-1">Chờ xử lý</span>
              <span className="text-[10px] text-slate-400">Pending</span>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryStatus('OUT_FOR_DELIVERY')}
              className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 active:scale-95 ${
                deliveryStatus === 'OUT_FOR_DELIVERY' || deliveryStatus === 'READY_FOR_DELIVERY'
                  ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/30 font-black shadow-xs'
                  : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Truck className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-bold mt-1">Đang giao</span>
              <span className="text-[10px] text-slate-400">Out for Delivery</span>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryStatus('DELIVERED')}
              className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 active:scale-95 ${
                deliveryStatus === 'DELIVERED'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/30 font-black shadow-xs'
                  : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold mt-1">Đã giao</span>
              <span className="text-[10px] text-slate-400">Delivered</span>
            </button>
          </div>
        </div>

        {/* SECTION 9: ĐƠN HÀNG ĐỊNH KỲ (RECURRING ORDERS) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Repeat className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  9. Đơn hàng định kỳ (Recurring Orders)
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  Thiết lập chu kỳ giao lặp lại định kỳ (Hàng ngày, hàng tuần, hàng tháng)
                </p>
              </div>
            </div>

            {/* Enable switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => {
                  const val = e.target.checked;
                  setIsRecurring(val);
                  if (val && !nextRecurringDate) {
                    setNextRecurringDate(calculateNextRecurringDate(new Date().toISOString(), recurringFrequency));
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {isRecurring && (
            <div className="pt-2 space-y-3 border-t border-slate-100 animate-fadeIn">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Tần suất lặp lại (Frequency):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {RECURRING_FREQUENCY_OPTIONS.map((opt) => {
                    const isSelected = recurringFrequency === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setRecurringFrequency(opt.id);
                          setNextRecurringDate(calculateNextRecurringDate(new Date().toISOString(), opt.id));
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between active:scale-95 ${
                          isSelected
                            ? 'bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/30 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black">{opt.shortLabel}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 stroke-[3]" />}
                        </div>
                        <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                          {opt.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Next delivery date */}
              <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-purple-900 block">Kỳ giao hàng tiếp theo:</span>
                    <span className="text-[10px] text-purple-700">Hệ thống sẽ tự nhắc và tạo đơn vào ngày này</span>
                  </div>
                </div>
                <input
                  type="date"
                  value={nextRecurringDate}
                  onChange={(e) => setNextRecurringDate(e.target.value)}
                  className="bg-white border border-purple-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* SUBMIT BUTTON - GIANT TACTILE ACTION */}
        <button
          type="submit"
          disabled={orderItems.length === 0}
          className={`w-full py-4 rounded-2xl text-white font-black text-base uppercase tracking-wider shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 ${
            orderItems.length > 0
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
              : 'bg-slate-300 cursor-not-allowed shadow-none'
          }`}
        >
          <Check className="w-5 h-5" />
          <span>LƯU ĐƠN HÀNG ({formatVND(totalAmount)})</span>
        </button>
      </form>

      {/* New Condo Modal */}
      {showNewCondoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-3">
            <h3 className="font-bold text-slate-800 text-base">Thêm Chung Cư / Dự Án Mới</h3>
            <input
              type="text"
              placeholder="e.g. Masteri Centre Point"
              value={newCondoName}
              onChange={(e) => setNewCondoName(e.target.value)}
              className="w-full px-3 py-2 text-sm font-semibold rounded-xl bg-slate-50 border border-slate-200"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewCondoModal(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddNewCondo}
                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CUSTOMER SELECTOR MODAL */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-white" />
                <h3 className="font-black text-base uppercase tracking-wide">
                  Chọn khách quen đã lưu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm theo tên khách, số ĐT, căn hộ (e.g. Tuấn, B-20-10)..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 focus:ring-1 focus:ring-emerald-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                {customerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearchQuery('')}
                    className="absolute right-2 top-2 p-0.5 rounded-full bg-slate-200 text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 overflow-y-auto space-y-2 max-h-[55vh]">
              {customers
                .filter((c) => {
                  if (!customerSearchQuery.trim()) return true;
                  const q = customerSearchQuery.toLowerCase().trim();
                  const nameMatch = c.name.toLowerCase().includes(q);
                  const phoneMatch = (c.phone || '').includes(q);
                  const unitMatch = `${c.block || ''}-${c.floor || ''}-${c.unit || ''}`.toLowerCase().includes(q);
                  const addrMatch = (c.externalAddress || '').toLowerCase().includes(q);
                  return nameMatch || phoneMatch || unitMatch || addrMatch;
                })
                .map((c) => {
                  const isCondo = c.defaultLocationType === 'condo';
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        applyCustomer(c);
                        setShowCustomerModal(false);
                      }}
                      className="w-full text-left p-3 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition flex items-center justify-between group active:scale-[0.99]"
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">{c.name}</span>
                          {c.phone && (
                            <span className="text-slate-400 text-xs font-mono">({c.phone})</span>
                          )}
                        </div>
                        {isCondo ? (
                          <div className="flex items-center gap-1.5 text-xs text-blue-800">
                            <span className="font-black bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                              {c.block}-{c.floor ? c.floor.padStart(2, '0') : '??'}-{c.unit ? c.unit.padStart(2, '0') : '??'}
                            </span>
                            <span className="text-slate-500 font-medium truncate">
                              {c.condoName || 'Sunrise City'}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-600 truncate">{c.externalAddress}</p>
                        )}
                        {c.deliveryNote && (
                          <p className="text-[11px] text-amber-700 italic truncate">
                            📝 {c.deliveryNote}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition">
                        Chọn
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowCustomerModal(false);
                  setCurrentScreen('CUSTOMERS');
                }}
                className="text-xs text-emerald-700 hover:underline font-bold flex items-center gap-1"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Quản lý danh sách khách quen →</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
