import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  MapPin,
  Building2,
  CheckCircle2,
  X,
  Compass,
  Sparkles,
  History,
  Check,
  ChevronRight,
  Landmark,
  Store,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import {
  GooglePlaceSuggestion,
  PlaceType,
  searchStandardizedPlaces,
  formatStandardizedDeliveryLocation,
  STANDARDIZED_PLACES_DATABASE,
} from '../utils/googlePlacesService';
import { loadFromStorage, saveToStorage } from '../utils/storage';

const RECENT_PLACES_STORAGE_KEY = 'oder_checklist_recent_places_v1';

interface GooglePlacesAddressLookupProps {
  onSelectPlace: (result: {
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
  }) => void;
  initialQuery?: string;
  className?: string;
}

export const GooglePlacesAddressLookup: React.FC<GooglePlacesAddressLookupProps> = ({
  onSelectPlace,
  initialQuery = '',
  className = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [isOpen, setIsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<PlaceType | 'all'>('all');
  const [selectedPlace, setSelectedPlace] = useState<GooglePlaceSuggestion | null>(null);

  // Condo specific details if condo selected
  const [condoBlock, setCondoBlock] = useState('B');
  const [condoFloor, setCondoFloor] = useState('');
  const [condoUnit, setCondoUnit] = useState('');

  // Office / external specific details (e.g. Tầng 8, Phòng 802)
  const [roomOrFloorDetail, setRoomOrFloorDetail] = useState('');

  // Recent places history
  const [recentPlaces, setRecentPlaces] = useState<GooglePlaceSuggestion[]>(() =>
    loadFromStorage<GooglePlaceSuggestion[]>(RECENT_PLACES_STORAGE_KEY, [
      STANDARDIZED_PLACES_DATABASE[0], // Sunrise City
      STANDARDIZED_PLACES_DATABASE[1], // Vinhomes Grand Park
      STANDARDIZED_PLACES_DATABASE[10], // Bitexco
    ])
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Suggestions search
  const suggestions = useMemo(() => {
    return searchStandardizedPlaces(query, categoryFilter);
  }, [query, categoryFilter]);

  // Handle item selection from Google Places
  const handleSelect = (place: GooglePlaceSuggestion) => {
    setSelectedPlace(place);
    setQuery(place.name);
    setIsOpen(false);

    // Default block
    if (place.suggestedBlocks && place.suggestedBlocks.length > 0) {
      setCondoBlock(place.suggestedBlocks[0]);
    }

    // Save to recents
    setRecentPlaces((prev) => {
      const filtered = prev.filter((p) => p.placeId !== place.placeId);
      const updated = [place, ...filtered].slice(0, 5);
      saveToStorage(RECENT_PLACES_STORAGE_KEY, updated);
      return updated;
    });

    propagateSelection(place, condoBlock, condoFloor, condoUnit, roomOrFloorDetail);
  };

  const propagateSelection = (
    place: GooglePlaceSuggestion,
    blockVal: string,
    floorVal: string,
    unitVal: string,
    roomDetailVal: string
  ) => {
    const isCondo = place.type === 'condo';
    const formattedAddress = formatStandardizedDeliveryLocation({
      place,
      block: blockVal,
      floor: floorVal,
      unit: unitVal,
      roomOrFloorNote: roomDetailVal,
    });

    onSelectPlace({
      place,
      locationType: isCondo ? 'condo' : 'external',
      condoName: isCondo ? place.condoName || place.name : undefined,
      block: isCondo ? blockVal.trim().toUpperCase() : undefined,
      floor: isCondo ? floorVal.trim() : undefined,
      unit: isCondo ? unitVal.trim() : undefined,
      formattedAddress,
      externalAddress: isCondo ? undefined : formattedAddress,
      ward: place.ward,
      district: place.district,
      city: place.city,
      lat: place.lat,
      lng: place.lng,
    });
  };

  // Re-emit formatted address when floor/unit/room details change
  const handleDetailsChange = (newBlock: string, newFloor: string, newUnit: string, newRoom: string) => {
    setCondoBlock(newBlock);
    setCondoFloor(newFloor);
    setCondoUnit(newUnit);
    setRoomOrFloorDetail(newRoom);

    if (selectedPlace) {
      propagateSelection(selectedPlace, newBlock, newFloor, newUnit, newRoom);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSelectedPlace(null);
    setCondoFloor('');
    setCondoUnit('');
    setRoomOrFloorDetail('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const getPlaceTypeIcon = (type: PlaceType) => {
    switch (type) {
      case 'condo':
        return <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'office':
        return <Landmark className="w-4 h-4 text-indigo-600 shrink-0" />;
      case 'commercial':
        return <Store className="w-4 h-4 text-amber-600 shrink-0" />;
      case 'landmark':
        return <Compass className="w-4 h-4 text-purple-600 shrink-0" />;
      case 'street':
      default:
        return <MapPin className="w-4 h-4 text-rose-600 shrink-0" />;
    }
  };

  const getPlaceTypeBadge = (type: PlaceType) => {
    switch (type) {
      case 'condo':
        return <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">Chung cư</span>;
      case 'office':
        return <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">Tòa nhà VP</span>;
      case 'commercial':
        return <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">TTTM / Mua sắm</span>;
      case 'landmark':
        return <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">Địa danh</span>;
      case 'street':
      default:
        return <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">Đường phố</span>;
    }
  };

  return (
    <div ref={containerRef} className={`space-y-2.5 ${className}`}>
      {/* Header Label & Google Places Branding Badge */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-600 via-rose-500 to-amber-500 flex items-center justify-center p-0.5 shadow-2xs">
            <MapPin className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="uppercase tracking-wide">Tra cứu địa chỉ chuẩn hóa (Google Places Lookup)</span>
        </label>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Chuẩn hóa địa chỉ</span>
        </span>
      </div>

      {/* Main Search Bar with Autocomplete Dropdown */}
      <div className="relative">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Nhập tên chung cư, tòa nhà hoặc đường phố (e.g. Sunrise City, Bitexco, 72 Lê Lợi...)"
            className="w-full pl-9 pr-9 py-2.5 text-xs sm:text-sm font-semibold rounded-2xl bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-xs placeholder:text-slate-400 text-slate-800 transition"
          />
          <Search className="w-4 h-4 text-blue-600 absolute left-3 pointer-events-none" />

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="w-6 h-6 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center absolute right-2.5 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown Card */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fadeIn">
            {/* Filter Pills Header */}
            <div className="p-2 bg-slate-50/90 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 shrink-0">
                Lọc loại:
              </span>
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'condo', label: 'Chung cư' },
                  { id: 'office', label: 'Tòa nhà VP' },
                  { id: 'street', label: 'Đường phố' },
                  { id: 'commercial', label: 'TTTM' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition shrink-0 ${
                    categoryFilter === cat.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Suggestions list */}
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {suggestions.length > 0 ? (
                suggestions.map((place) => (
                  <button
                    key={place.placeId}
                    type="button"
                    onClick={() => handleSelect(place)}
                    className="w-full p-2.5 text-left hover:bg-blue-50/70 transition flex items-start gap-2.5 group cursor-pointer"
                  >
                    <div className="p-1.5 rounded-xl bg-slate-100 group-hover:bg-blue-100/80 transition mt-0.5">
                      {getPlaceTypeIcon(place.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 group-hover:text-blue-900">
                          {place.name}
                        </span>
                        {getPlaceTypeBadge(place.type)}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5 font-sans">
                        {place.secondaryText}
                      </p>
                      {place.district && (
                        <p className="text-[10px] text-blue-700/80 font-semibold mt-0.5">
                          📍 {place.ward ? `${place.ward}, ` : ''}{place.district}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 shrink-0 mt-1" />
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">Không tìm thấy địa điểm định sẵn chính xác</p>
                  <p className="text-[11px] text-slate-400">
                    Bạn có thể tự nhập địa chỉ tự do bên dưới, hệ thống sẽ lưu và chuẩn hóa tự động.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Recent Addresses Footer */}
            {recentPlaces.length > 0 && (
              <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto text-[10px]">
                <History className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
                <span className="text-slate-400 font-bold uppercase shrink-0">Gần đây:</span>
                {recentPlaces.map((rp) => (
                  <button
                    key={rp.placeId}
                    type="button"
                    onClick={() => handleSelect(rp)}
                    className="shrink-0 px-2 py-0.5 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-[10px] font-semibold transition"
                  >
                    {rp.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Selection Tags / Common Hubs Pills */}
      {!selectedPlace && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
            Gợi ý nhanh:
          </span>
          {STANDARDIZED_PLACES_DATABASE.slice(0, 4).map((item) => (
            <button
              key={item.placeId}
              type="button"
              onClick={() => handleSelect(item)}
              className="shrink-0 px-2 py-1 rounded-xl bg-slate-100 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800 border border-slate-200 text-[10px] font-bold text-slate-700 flex items-center gap-1 transition active:scale-95"
            >
              {getPlaceTypeIcon(item.type)}
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* SELECTED STANDARDIZED PLACE CONFIRMATION & DETAIL SPECIFIER */}
      {selectedPlace && (
        <div className="bg-gradient-to-br from-blue-50/80 via-emerald-50/50 to-slate-50 rounded-2xl p-3.5 border border-blue-200/90 shadow-2xs space-y-3 animate-fadeIn">
          {/* Header row with place name and clear action */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 mt-0.5 shadow-xs">
                {getPlaceTypeIcon(selectedPlace.type)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                    {selectedPlace.name}
                  </h4>
                  {getPlaceTypeBadge(selectedPlace.type)}
                  <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Chuẩn Google Places</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 font-sans leading-tight">
                  {selectedPlace.secondaryText}
                </p>
                {selectedPlace.lat && selectedPlace.lng && (
                  <p className="text-[10px] text-blue-700 font-mono mt-0.5">
                    📍 Tọa độ GPS: {selectedPlace.lat.toFixed(4)}, {selectedPlace.lng.toFixed(4)} • {selectedPlace.district}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition shrink-0"
            >
              Đổi địa chỉ
            </button>
          </div>

          {/* Conditional Specification Fields based on Place Type */}
          {selectedPlace.type === 'condo' ? (
            /* Condo Specifics: Block, Floor, Unit */
            <div className="pt-2 border-t border-blue-200/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Xác nhận Block, Tầng và Căn hộ cho đơn hàng:</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">* Bắt buộc cho căn hộ</span>
              </div>

              {/* Block Selection Chips */}
              {selectedPlace.suggestedBlocks && selectedPlace.suggestedBlocks.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Chọn Block / Tháp:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPlace.suggestedBlocks.map((blk) => (
                      <button
                        key={blk}
                        type="button"
                        onClick={() => handleDetailsChange(blk, condoFloor, condoUnit, roomOrFloorDetail)}
                        className={`min-w-[36px] px-2.5 py-1 rounded-xl text-xs font-black transition active:scale-95 ${
                          condoBlock === blk
                            ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/40'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {blk}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Floor and Unit Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Tầng (Floor) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    placeholder="e.g. 15, 20"
                    value={condoFloor}
                    onChange={(e) => handleDetailsChange(condoBlock, e.target.value, condoUnit, roomOrFloorDetail)}
                    className="w-full px-3 py-1.5 text-sm font-black text-center rounded-xl bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Căn hộ (Unit / Room) *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 01, 10"
                    value={condoUnit}
                    onChange={(e) => handleDetailsChange(condoBlock, condoFloor, e.target.value, roomOrFloorDetail)}
                    className="w-full px-3 py-1.5 text-sm font-black text-center rounded-xl bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Office / Street Address Specifics: Optional Floor / Room details */
            <div className="pt-2 border-t border-blue-200/60 space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700">
                Chi tiết tầng / phòng / sảnh làm việc (Tùy chọn):
              </label>
              <input
                type="text"
                placeholder="e.g. Tầng 8 - Phòng 802, Sảnh bảo vệ, Quầy lễ tân..."
                value={roomOrFloorDetail}
                onChange={(e) => handleDetailsChange(condoBlock, condoFloor, condoUnit, e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Standardized Output Preview Strip */}
          <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-xs flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-emerald-200 font-extrabold uppercase tracking-wide block">
                Địa chỉ chuẩn hóa cho Shipper:
              </span>
              <p className="font-black text-xs sm:text-sm font-mono truncate">
                {formatStandardizedDeliveryLocation({
                  place: selectedPlace,
                  block: condoBlock,
                  floor: condoFloor,
                  unit: condoUnit,
                  roomOrFloorNote: roomOrFloorDetail,
                })}
              </p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          </div>
        </div>
      )}
    </div>
  );
};
