import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import {
  OrderItem,
  OrderLocation,
  OrderPriority,
  PaymentMethod,
  ORDER_PRIORITY_OPTIONS,
  RecurringFrequency,
  RECURRING_FREQUENCY_OPTIONS,
  calculateNextRecurringDate,
} from '../types';
import { GooglePlacesAddressLookup } from './GooglePlacesAddressLookup';
import { GooglePlaceSuggestion } from '../utils/googlePlacesService';
import { removeVietnameseTones } from '../utils/searchHelper';
import {
  Plus,
  Minus,
  X,
  CheckCircle2,
  Building2,
  MapPin,
  FileText,
  User,
  Phone,
  Banknote,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Truck,
  Repeat,
  Image as ImageIcon,
} from 'lucide-react';

interface QuickCreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReceiptImage?: string | null;
}

export const QuickCreateOrderModal: React.FC<QuickCreateOrderModalProps> = ({
  isOpen,
  onClose,
  initialReceiptImage,
}) => {
  const { products, condos, customers, createOrder, setCurrentScreen } = useApp();

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [locationType, setLocationType] = useState<'condo' | 'external'>('condo');

  // Condo specifics
  const [selectedCondoId, setSelectedCondoId] = useState(condos[0]?.id || '');
  const [block, setBlock] = useState('B');
  const [floor, setFloor] = useState('15');
  const [room, setRoom] = useState('01');

  // External specifics
  const [externalAddress, setExternalAddress] = useState('');

  // Items
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (products.length > 0) {
      init[products[0].id] = 1; // Default 1 of first product
    }
    return init;
  });

  // Notes & Details
  const [deliveryNote, setDeliveryNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('MEDIUM');
  const [paymentStatus, setPaymentStatus] = useState<'UNPAID' | 'PAID'>('UNPAID');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  // Recurring Order State
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('WEEKLY');
  const [nextRecurringDate, setNextRecurringDate] = useState<string>(() =>
    calculateNextRecurringDate(new Date().toISOString(), 'WEEKLY')
  );

  // Attached Receipt image if any
  const [receiptImage, setReceiptImage] = useState<string | null>(initialReceiptImage || null);

  // Success state
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // Active condo object
  const activeCondo = condos.find((c) => c.id === selectedCondoId) || condos[0];

  const [quickPlaceDetails, setQuickPlaceDetails] = useState<{
    placeId?: string;
    standardizedAddress?: string;
    ward?: string;
    district?: string;
    city?: string;
    lat?: number;
    lng?: number;
  }>({});

  const handleSelectQuickPlace = (res: {
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
    setQuickPlaceDetails({
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
      if (matchedCondo) {
        setSelectedCondoId(matchedCondo.id);
      }
      if (res.block) setBlock(res.block);
      if (res.floor) setFloor(res.floor);
      if (res.unit) setRoom(res.unit);
    } else {
      if (res.externalAddress) {
        setExternalAddress(res.externalAddress);
      }
    }
  };

  // Quick Customer Autofill
  const handleSelectCustomer = (c: typeof customers[0]) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    if (c.defaultLocationType === 'condo' && c.block && c.unit) {
      setLocationType('condo');
      if (c.block) setBlock(c.block);
      if (c.floor) setFloor(c.floor);
      if (c.unit) setRoom(c.unit);
    } else if (c.externalAddress) {
      setLocationType('external');
      setExternalAddress(c.externalAddress);
    }
    if (c.deliveryNote) {
      setDeliveryNote(c.deliveryNote);
    }
  };

  // Quantity helpers
  const handleQuantityChange = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  // Selected Items calculation
  const orderItems: OrderItem[] = useMemo(() => {
    const items: OrderItem[] = [];
    products.forEach((p) => {
      const qty = quantities[p.id] || 0;
      if (qty > 0) {
        items.push({
          productId: p.id,
          productName: p.name,
          quantity: qty,
          unitPrice: p.price,
          lineTotal: qty * p.price,
          unit: p.unit || 'Phần',
          cost: p.cost,
          price: p.price,
        });
      }
    });
    return items;
  }, [products, quantities]);

  const totalAmount = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [orderItems]);

  const totalCost = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + (item.cost !== undefined ? item.cost : Math.round(item.unitPrice * 0.45)) * item.quantity, 0);
  }, [orderItems]);

  const totalCount = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [orderItems]);

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      alert('Vui lòng nhập tên khách hàng');
      return;
    }

    if (orderItems.length === 0) {
      alert('Vui lòng chọn ít nhất 1 món ăn/sản phẩm');
      return;
    }

    let location: OrderLocation;
    if (locationType === 'condo') {
      const cleanBlock = block.trim().toUpperCase() || 'B';
      const cleanFloor = floor.trim() || '1';
      const cleanRoom = room.trim() || '01';
      const formattedAddress = `${cleanBlock}-${cleanFloor}-${cleanRoom}`;

      location = {
        type: 'condo',
        condoName: activeCondo?.name || 'Chung cư',
        block: cleanBlock,
        floor: cleanFloor,
        unit: cleanRoom,
        formattedAddress,
        deliveryNote: deliveryNote.trim() || undefined,
        placeId: quickPlaceDetails.placeId,
        standardizedAddress:
          quickPlaceDetails.standardizedAddress || `${formattedAddress} (${activeCondo?.name || 'Chung cư'})`,
        ward: quickPlaceDetails.ward,
        district: quickPlaceDetails.district,
        city: quickPlaceDetails.city,
        lat: quickPlaceDetails.lat,
        lng: quickPlaceDetails.lng,
      };
    } else {
      if (!externalAddress.trim()) {
        alert('Vui lòng nhập địa chỉ giao ngoài');
        return;
      }
      location = {
        type: 'external',
        formattedAddress: externalAddress.trim(),
        externalAddress: externalAddress.trim(),
        deliveryNote: deliveryNote.trim() || undefined,
        placeId: quickPlaceDetails.placeId,
        standardizedAddress: quickPlaceDetails.standardizedAddress || externalAddress.trim(),
        ward: quickPlaceDetails.ward,
        district: quickPlaceDetails.district,
        city: quickPlaceDetails.city,
        lat: quickPlaceDetails.lat,
        lng: quickPlaceDetails.lng,
      };
    }

    const newOrder = createOrder({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      items: orderItems,
      cost: totalCost,
      price: totalAmount,
      location,
      deliveryNote: deliveryNote.trim() || undefined,
      note: deliveryNote.trim() || undefined,
      notes: deliveryNote.trim() || undefined,
      internalNote: internalNote.trim() || undefined,
      paymentStatus,
      paymentMethod: paymentStatus === 'PAID' ? paymentMethod : undefined,
      priority,
      receiptImageUrl: receiptImage || undefined,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      nextRecurringDate: isRecurring ? nextRecurringDate : undefined,
      recurringActive: isRecurring ? true : undefined,
    });

    setCreatedOrderId(newOrder.id);
  };

  const handleResetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryNote('');
    setInternalNote('');
    setCreatedOrderId(null);
    setReceiptImage(null);
    const init: Record<string, number> = {};
    if (products.length > 0) {
      init[products[0].id] = 1;
    }
    setQuantities(init);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-1.5">
                <span>Tạo Đơn Hàng Nhanh</span>
                <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold uppercase">
                  Quick Order
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90">
                Lên đơn 30 giây & kích hoạt thông báo tức thì
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body or Success View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {createdOrderId ? (
            /* SUCCESS CONFIRMATION VIEW */
            <div className="text-center py-6 px-4 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                  Tạo đơn thành công
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-2">
                  Đơn Hàng #{createdOrderId}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Đã ghi nhận đơn cho <strong>{customerName}</strong>. Chuông và thông báo đã được gửi đến người bán!
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-1.5">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Địa chỉ giao:</span>
                  <span className="text-indigo-700 font-black">
                    {locationType === 'condo' ? `${block}-${floor}-${room}` : externalAddress}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Số lượng:</span>
                  <span>{totalCount} phần món</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Tổng tiền:</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">
                    {formatVND(totalAmount)}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setCurrentScreen('DELIVERY');
                  }}
                  className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
                >
                  <Truck className="w-4 h-4 text-blue-200" />
                  <span>Đi tới Giao hàng</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo thêm đơn khác</span>
                </button>
              </div>
            </div>
          ) : (
            /* ORDER CREATION FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Receipt preview if attached */}
              {receiptImage && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-indigo-300">
                    <img src={receiptImage} alt="Receipt" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-xs min-w-0 flex-1">
                    <p className="font-bold text-indigo-900 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Đã đính kèm ảnh biên nhận</span>
                    </p>
                    <p className="text-[11px] text-indigo-700/80 truncate">Ảnh chụp sẽ được lưu cùng đơn hàng</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptImage(null)}
                    className="text-slate-400 hover:text-rose-600 p-1 text-xs font-bold"
                  >
                    Xóa
                  </button>
                </div>
              )}

              {/* 1. CUSTOMER INFO & SUGGESTIONS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Khách hàng:</span>
                  </label>
                  {customers.length > 0 && (
                    <span className="text-[10px] text-slate-400">Chọn gợi ý bên dưới</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Tên khách hàng *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800"
                  />
                  <input
                    type="tel"
                    placeholder="Số điện thoại"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="p-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800"
                  />
                </div>

                {/* Quick customer chips */}
                {customers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {customers.slice(0, 4).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-[11px] font-semibold text-slate-700 transition"
                      >
                        +{c.name} {c.block ? `(${c.block}-${c.unit})` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. LOCATION (CONDO vs EXTERNAL) */}
              <div className="space-y-2.5 pt-1">
                {/* Google Places Lookup */}
                <GooglePlacesAddressLookup onSelectPlace={handleSelectQuickPlace} />

                <div className="flex items-center justify-between pt-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Phương thức giao hàng:</span>
                  </label>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setLocationType('condo')}
                      className={`px-2.5 py-0.5 rounded-md transition ${
                        locationType === 'condo' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Chung cư
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocationType('external')}
                      className={`px-2.5 py-0.5 rounded-md transition ${
                        locationType === 'external' ? 'bg-white text-indigo-800 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Ngoài
                    </button>
                  </div>
                </div>

                {locationType === 'condo' ? (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Block</span>
                      <select
                        value={block}
                        onChange={(e) => setBlock(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-300 text-xs font-black text-slate-800 bg-white"
                      >
                        {(activeCondo?.blocks || ['A', 'B', 'C']).map((b) => (
                          <option key={b} value={b}>
                            Block {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Tầng</span>
                      <input
                        type="text"
                        placeholder="15"
                        value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-300 text-xs font-black text-slate-800 text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Căn/Phòng</span>
                      <input
                        type="text"
                        placeholder="01"
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-300 text-xs font-black text-slate-800 text-center"
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="Số nhà, tên đường, phường, quận..."
                    value={externalAddress}
                    onChange={(e) => setExternalAddress(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800"
                  />
                )}
              </div>

              {/* 3. PRODUCT PICKER */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Chọn món ăn & Số lượng:</span>
                  </label>
                  <span className="text-[11px] font-black text-emerald-700">
                    {totalCount} phần • {formatVND(totalAmount)}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {products.map((p) => {
                    const qty = quantities[p.id] || 0;
                    return (
                      <div
                        key={p.id}
                        className={`p-2.5 rounded-xl border transition flex items-center justify-between ${
                          qty > 0 ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{formatVND(p.price)} / {p.unit || 'Phần'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(p.id, -1)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 active:scale-95 transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-black text-xs text-slate-900">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(p.id, 1)}
                            className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold active:scale-95 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. PRIORITY & PAYMENT STATUS */}
              <div className="space-y-2 pt-1">
                {/* Priority Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      <span>Mức độ ưu tiên (Priority Level):</span>
                    </label>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.2 rounded-full ${
                        priority === 'HIGH'
                          ? 'bg-rose-100 text-rose-800'
                          : priority === 'LOW'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {priority === 'HIGH' ? '🔥 Làm & Giao gấp' : priority === 'LOW' ? '💤 Giao sau' : '⚡ Tiêu chuẩn'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPriority('HIGH')}
                      className={`py-2 px-2 rounded-xl text-xs font-black border transition flex items-center justify-center gap-1.5 active:scale-95 ${
                        priority === 'HIGH'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/30 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span>Cao (High)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('MEDIUM')}
                      className={`py-2 px-2 rounded-xl text-xs font-black border transition flex items-center justify-center gap-1.5 active:scale-95 ${
                        priority === 'MEDIUM'
                          ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/30 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span>TB (Med)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('LOW')}
                      className={`py-2 px-2 rounded-xl text-xs font-black border transition flex items-center justify-center gap-1.5 active:scale-95 ${
                        priority === 'LOW'
                          ? 'bg-slate-200 border-slate-500 text-slate-800 ring-2 ring-slate-500/30 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                      <span>Thấp (Low)</span>
                    </button>
                  </div>
                </div>

                {/* Payment */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Thanh toán:</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as 'UNPAID' | 'PAID')}
                    className="w-full p-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                  >
                    <option value="UNPAID">Chưa thu tiền</option>
                    <option value="PAID">Đã thu (Tiền mặt)</option>
                  </select>
                </div>

                {/* Recurring Schedule */}
                <div className="bg-purple-50/70 p-2.5 rounded-xl border border-purple-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-purple-900 flex items-center gap-1 cursor-pointer">
                      <Repeat className="w-3.5 h-3.5 text-purple-700" />
                      <span>Đơn hàng lặp lại định kỳ:</span>
                    </label>
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
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                  </div>

                  {isRecurring && (
                    <div className="mt-2 pt-2 border-t border-purple-200/60 space-y-1.5 animate-fadeIn">
                      <div className="flex items-center gap-1 text-xs">
                        {RECURRING_FREQUENCY_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setRecurringFrequency(opt.id);
                              setNextRecurringDate(calculateNextRecurringDate(new Date().toISOString(), opt.id));
                            }}
                            className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold text-center transition ${
                              recurringFrequency === opt.id
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            {opt.shortLabel}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-purple-800">
                        <span>Kỳ giao tới:</span>
                        <input
                          type="date"
                          value={nextRecurringDate}
                          onChange={(e) => setNextRecurringDate(e.target.value)}
                          className="bg-white border border-purple-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. NOTES / SPECIAL DELIVERY INSTRUCTIONS */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-600">
                    Ghi chú & Hướng dẫn giao hàng (Notes / Delivery Instructions):
                  </label>
                  <span className="text-[9px] text-slate-400 font-semibold">(Tùy chọn)</span>
                </div>
                <textarea
                  rows={2}
                  placeholder="Ghi chú giao hàng (ví dụ: Gate code 1234, Leave at front desk, Treo trước cửa...)"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                />
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {['Gate code 1234', 'Leave at front desk', 'Treo trước cửa', 'Gọi trước 5p', 'Bấm chuông', 'Gửi sảnh lễ tân'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setDeliveryNote((prev) => (prev ? `${prev}, ${chip}` : chip))}
                      className="text-[9px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 px-1.5 py-0.5 rounded border border-slate-200 transition font-medium"
                    >
                      +{chip}
                    </button>
                  ))}
                  {deliveryNote && (
                    <button
                      type="button"
                      onClick={() => setDeliveryNote('')}
                      className="text-[9px] text-slate-400 hover:text-slate-600 underline ml-1"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={orderItems.length === 0 || !customerName.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <span>XÁC NHẬN TẠO ĐƠN ({formatVND(totalAmount)})</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
