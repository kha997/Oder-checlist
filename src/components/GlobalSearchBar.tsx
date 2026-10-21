import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  searchOrders,
  type OrderSearchMatch,
  getHighlightedTextSegments,
} from '../utils/searchHelper';
import { formatVND } from '../utils/storage';
import { type Order } from '../types';
import {
  Search,
  X,
  Building2,
  MapPin,
  CheckCircle2,
  Clock,
  Rocket,
  ArrowRight,
  Phone,
  Copy,
  Check,
  Eye,
  SlidersHorizontal,
  Sparkles,
  Command,
  Truck,
  RotateCcw,
  Mic,
  MicOff,
} from 'lucide-react';
import {
  isSpeechRecognitionSupported,
  createSpeechRecognition,
} from '../utils/speechRecognition';

interface GlobalSearchBarProps {
  onSelectOrder: (order: Order) => void;
}

type FilterCategory = 'ALL' | 'CUSTOMER' | 'ADDRESS' | 'ID' | 'PENDING' | 'UNPAID';

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ onSelectOrder }) => {
  const {
    orders,
    globalSearchQuery,
    setGlobalSearchQuery,
    setCurrentScreen,
  } = useApp();

  const [searchInput, setSearchInput] = useState(globalSearchQuery || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('ALL');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Voice Search State
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Detect OS for shortcut hint (Cmd vs Ctrl)
  const isMac = useMemo(() => {
    return typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  }, []);

  // Check speech recognition support
  useEffect(() => {
    setVoiceSupported(isSpeechRecognitionSupported());
  }, []);

  // Sync internal state when external globalSearchQuery changes
  useEffect(() => {
    if (globalSearchQuery !== searchInput) {
      setSearchInput(globalSearchQuery || '');
    }
  }, [globalSearchQuery]);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K or "/" to focus
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsDropdownOpen(true);
        return;
      }

      // "/" key when not focused in an input/textarea
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsDropdownOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search results calculation
  const allMatches: OrderSearchMatch[] = useMemo(() => {
    if (!searchInput.trim()) return [];
    return searchOrders(orders, searchInput);
  }, [orders, searchInput]);

  // Filtered by Category
  const filteredMatches = useMemo(() => {
    if (selectedFilter === 'ALL') return allMatches;
    if (selectedFilter === 'CUSTOMER') {
      return allMatches.filter((m) => m.matchType === 'CUSTOMER_NAME' || m.matchType === 'PHONE');
    }
    if (selectedFilter === 'ADDRESS') {
      return allMatches.filter((m) => m.matchType === 'ADDRESS');
    }
    if (selectedFilter === 'ID') {
      return allMatches.filter((m) => m.matchType === 'ID');
    }
    if (selectedFilter === 'PENDING') {
      return allMatches.filter((m) => m.order.deliveryStatus !== 'DELIVERED');
    }
    if (selectedFilter === 'UNPAID') {
      return allMatches.filter((m) => m.order.paymentStatus === 'UNPAID');
    }
    return allMatches;
  }, [allMatches, selectedFilter]);

  // Recent 4 active orders for quick empty state
  const recentOrders = useMemo(() => {
    return [...orders]
      .filter((o) => o.status === 'ACTIVE')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);
  }, [orders]);

  // Reset selectedIndex whenever filtered matches change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [filteredMatches.length, searchInput, selectedFilter]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-search-item]');
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    setGlobalSearchQuery(val);
    setIsDropdownOpen(true);
  };

  const handleClear = () => {
    setSearchInput('');
    setGlobalSearchQuery('');
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleSelect = (order: Order) => {
    setIsDropdownOpen(false);
    onSelectOrder(order);
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleApplyPreset = (term: string) => {
    setSearchInput(term);
    setGlobalSearchQuery(term);
    setIsDropdownOpen(true);
    inputRef.current?.focus();
  };

  const handleNavigateScreen = (screen: 'ORDER_HISTORY' | 'HOME' | 'DELIVERY' | 'UNPAID') => {
    setIsDropdownOpen(false);
    setGlobalSearchQuery(searchInput);
    setCurrentScreen(screen);
  };

  // Voice Search Recognition Handler
  const toggleVoiceSearch = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!voiceSupported) {
      alert('Trình duyệt không hỗ trợ nhận diện giọng nói (Web Speech API).');
      return;
    }

    try {
      const recognition = createSpeechRecognition({
        lang: 'vi-VN',
        continuous: false,
        interimResults: true,
      });

      if (recognition) {
        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0]?.transcript || '';
          }
          const cleanText = transcript.trim();
          if (cleanText) {
            setSearchInput(cleanText);
            setGlobalSearchQuery(cleanText);
            setIsDropdownOpen(true);
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        setIsDropdownOpen(true);
      }
    } catch {
      setIsListening(false);
    }
  };

  // Keyboard navigation within input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsDropdownOpen(true);
      setSelectedIndex((prev) => {
        const next = prev + 1;
        return next >= filteredMatches.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsDropdownOpen(true);
      setSelectedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? filteredMatches.length - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && filteredMatches[selectedIndex]) {
        handleSelect(filteredMatches[selectedIndex].order);
      } else if (filteredMatches.length > 0) {
        // If no specific item selected, open the top match
        handleSelect(filteredMatches[0].order);
      } else if (searchInput.trim()) {
        handleNavigateScreen('ORDER_HISTORY');
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

  // Render Highlighted Text
  const renderHighlighted = (text: string) => {
    if (!searchInput.trim()) return text;
    const segments = getHighlightedTextSegments(text, searchInput);
    return (
      <>
        {segments.map((seg, idx) =>
          seg.isMatch ? (
            <mark
              key={idx}
              className="bg-amber-200 text-slate-950 font-black px-0.5 rounded shadow-2xs"
            >
              {seg.text}
            </mark>
          ) : (
            <span key={idx}>{seg.text}</span>
          )
        )}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Bar */}
      <div
        className={`relative flex items-center bg-emerald-800/90 hover:bg-emerald-900/90 focus-within:bg-emerald-950 focus-within:ring-2 focus-within:ring-emerald-300 border border-emerald-600/70 rounded-xl transition duration-150 ${
          isDropdownOpen ? 'ring-2 ring-emerald-300 bg-emerald-950' : ''
        }`}
      >
        <Search className="w-4 h-4 text-emerald-300 ml-3 shrink-0" />

        <input
          ref={inputRef}
          type="text"
          value={searchInput}
          onChange={handleInputChange}
          onFocus={() => setIsDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Tìm kiếm: Tên khách (Hương, Tuấn), Địa chỉ (B-20, Sunrise...), Mã đơn (1001)..."
          className="w-full py-1.5 pl-2.5 pr-2 bg-transparent text-xs text-white placeholder-emerald-200/70 focus:outline-none font-medium"
          aria-label="Tìm kiếm toàn hệ thống"
        />

        {/* Right Input Badges & Actions */}
        <div className="flex items-center gap-1.5 mr-2 shrink-0">
          {/* Voice Search Button */}
          {voiceSupported && (
            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`p-1 rounded-lg transition ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-emerald-300 hover:text-white hover:bg-emerald-800/80'
              }`}
              title={isListening ? 'Đang nghe... bấm để dừng' : 'Tìm kiếm bằng giọng nói'}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Result Count Badge */}
          {searchInput.trim() ? (
            <>
              <span className="text-[10px] font-black bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-500/50">
                {allMatches.length} đơn
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-full hover:bg-emerald-800 text-emerald-200 hover:text-white transition"
                title="Xóa tìm kiếm (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            /* Keyboard Shortcut Hint */
            <div className="hidden sm:flex items-center gap-0.5 text-[10px] text-emerald-200/80 bg-emerald-900/80 border border-emerald-700/80 px-1.5 py-0.5 rounded font-mono select-none pointer-events-none">
              <span className="text-[9px]">{isMac ? '⌘' : 'Ctrl+'}</span>
              <span>K</span>
            </div>
          )}
        </div>
      </div>

      {/* DROPDOWN FLYOUT */}
      {isDropdownOpen && (
        <>
          {/* Backdrop Scrim */}
          <div
            className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-2xs"
            onClick={() => setIsDropdownOpen(false)}
          />

          {/* Dropdown Container */}
          <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden max-h-[78vh] flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Listening Banner if active */}
            {isListening && (
              <div className="px-3 py-2 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs text-rose-800 font-bold shrink-0 animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                  <span>Đang lắng nghe giọng nói... Bạn hãy đọc tên khách, địa chỉ hoặc mã đơn</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceSearch}
                  className="px-2 py-0.5 bg-rose-600 text-white rounded-md text-[10px] hover:bg-rose-700"
                >
                  Dừng
                </button>
              </div>
            )}

            {/* Dropdown Header & Quick Filter Pills */}
            <div className="px-3.5 pt-2.5 pb-2 bg-slate-50 border-b border-slate-200/80 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-emerald-700" />
                  {searchInput.trim() ? (
                    <span>
                      Kết quả tìm kiếm: &ldquo;
                      <strong className="text-emerald-900">{searchInput}</strong>
                      &rdquo;
                    </span>
                  ) : (
                    <span className="text-slate-600">Gợi ý & Tìm kiếm nhanh</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                    {filteredMatches.length} kết quả
                  </span>
                  <button
                    onClick={() => setIsDropdownOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition"
                    title="Đóng"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Filter Category Chips (when there is a query) */}
              {searchInput.trim() && (
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedFilter('ALL')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                      selectedFilter === 'ALL'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Tất cả ({allMatches.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFilter('CUSTOMER')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                      selectedFilter === 'CUSTOMER'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    👤 Tên khách ({allMatches.filter((m) => m.matchType === 'CUSTOMER_NAME' || m.matchType === 'PHONE').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFilter('ADDRESS')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                      selectedFilter === 'ADDRESS'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🏢 Địa chỉ ({allMatches.filter((m) => m.matchType === 'ADDRESS').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFilter('ID')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                      selectedFilter === 'ID'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🏷️ Mã đơn ({allMatches.filter((m) => m.matchType === 'ID').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFilter('PENDING')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                      selectedFilter === 'PENDING'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ⏳ Chờ giao ({allMatches.filter((m) => m.order.deliveryStatus !== 'DELIVERED').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedFilter('UNPAID')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                      selectedFilter === 'UNPAID'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    💰 Chưa thu ({allMatches.filter((m) => m.order.paymentStatus === 'UNPAID').length})
                  </button>
                </div>
              )}
            </div>

            {/* RESULTS BODY */}
            <div ref={listRef} className="overflow-y-auto flex-1 p-2 space-y-1.5 divide-y divide-slate-100">
              {/* Case 1: Search Input Empty -> Show Quick Suggestions and Recent Orders */}
              {!searchInput.trim() ? (
                <div className="py-2 px-1 space-y-4">
                  {/* Quick Preset Queries */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2 px-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Gợi ý tìm kiếm nhanh</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-2">
                      {[
                        { label: '🏢 Toà B (Sunrise City)', query: 'Toà B' },
                        { label: '🏢 Toà A', query: 'Toà A' },
                        { label: '📍 Sunrise City', query: 'Sunrise' },
                        { label: '📍 Vinhomes Grand Park', query: 'Vinhomes' },
                        { label: '💰 Chưa thu tiền', query: 'Chưa thu' },
                        { label: '☕ Cà phê muối', query: 'Cà phê' },
                        { label: '🥪 Bánh mì', query: 'Bánh mì' },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleApplyPreset(item.query)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 transition"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recent Orders Shortcut */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Đơn hàng mới tạo gần đây</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">Bấm để xem chi tiết</span>
                    </div>

                    <div className="space-y-1">
                      {recentOrders.map((order) => (
                        <div
                          key={order.id}
                          onClick={() => handleSelect(order)}
                          className="p-2.5 rounded-xl hover:bg-emerald-50/70 border border-slate-100 hover:border-emerald-200 cursor-pointer transition flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                              {order.id}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{order.customerName}</p>
                              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                {order.location.type === 'condo' ? (
                                  <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                ) : (
                                  <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                                )}
                                <span>{order.location.formattedAddress}</span>
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-xs text-slate-800 block">
                              {formatVND(order.totalAmount)}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                order.deliveryStatus === 'DELIVERED'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {order.deliveryStatus === 'DELIVERED' ? 'Đã giao' : 'Chờ giao'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : filteredMatches.length === 0 ? (
                /* Case 2: Query has NO matches */
                <div className="py-8 px-4 text-center space-y-2">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-xs">
                    Không tìm thấy đơn hàng nào!
                  </h4>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Không tìm thấy đơn khớp với &ldquo;<strong>{searchInput}</strong>&rdquo;
                    {selectedFilter !== 'ALL' && ' theo bộ lọc hiện tại'}.
                  </p>
                  <p className="text-[10px] text-slate-400 italic pt-1">
                    Gợi ý: Tìm theo tên khách (&ldquo;Hương&rdquo;, &ldquo;Tuấn&rdquo;), mã đơn (&ldquo;1001&rdquo;), hoặc phòng (&ldquo;B-20-10&rdquo;, &ldquo;1501&rdquo;).
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    {selectedFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setSelectedFilter('ALL')}
                        className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition"
                      >
                        Bỏ lọc danh mục
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                    >
                      Xóa tìm kiếm
                    </button>
                  </div>
                </div>
              ) : (
                /* Case 3: List of Matched Orders */
                filteredMatches.map(({ order, matchType, highlightField }, idx) => {
                  const isDelivered = order.deliveryStatus === 'DELIVERED';
                  const isReady = order.deliveryStatus === 'READY_FOR_DELIVERY';
                  const isPaid = order.paymentStatus === 'PAID';
                  const isHighlighted = idx === selectedIndex;

                  return (
                    <div
                      key={order.id}
                      data-search-item
                      onClick={() => handleSelect(order)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`pt-1.5 first:pt-0 p-2.5 rounded-xl border transition cursor-pointer group active:scale-[0.99] ${
                        isHighlighted
                          ? 'bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-300'
                          : 'hover:bg-slate-50/90 border-transparent hover:border-slate-200'
                      }`}
                    >
                      {/* Row 1: ID, Match Reason & Status Badges */}
                      <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                            {highlightField === 'id' ? renderHighlighted(order.id) : order.id}
                          </span>

                          {/* Quick copy ID button */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyId(e, order.id)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
                            title="Sao chép mã đơn"
                          >
                            {copiedId === order.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>

                          {/* Match Tag Badge */}
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                              matchType === 'CUSTOMER_NAME'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : matchType === 'ID'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : matchType === 'PHONE'
                                ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                : matchType === 'ADDRESS'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : matchType === 'ITEM'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-purple-100 text-purple-800 border border-purple-200'
                            }`}
                          >
                            {matchType === 'CUSTOMER_NAME'
                              ? 'Khớp tên khách'
                              : matchType === 'ID'
                              ? 'Khớp mã đơn'
                              : matchType === 'PHONE'
                              ? 'Khớp SĐT'
                              : matchType === 'ADDRESS'
                              ? 'Khớp địa chỉ / phòng'
                              : matchType === 'ITEM'
                              ? 'Khớp tên món'
                              : 'Khớp ghi chú'}
                          </span>

                          {order.priority && order.priority !== 'MEDIUM' && (
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${
                                order.priority === 'HIGH'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {order.priority === 'HIGH' ? 'Ưu tiên Cao' : 'Thấp'}
                            </span>
                          )}
                        </div>

                        {/* Status Tags */}
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
                              isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 font-bold'
                            }`}
                          >
                            {isPaid ? '✓ Đã thu' : 'Chưa thu'}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Customer, Address & Total Amount */}
                      <div className="flex items-start justify-between gap-2 text-xs">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-extrabold text-slate-900 group-hover:text-emerald-800 transition">
                              {highlightField === 'customerName'
                                ? renderHighlighted(order.customerName)
                                : order.customerName}
                            </p>
                            {order.customerPhone && (
                              <a
                                href={`tel:${order.customerPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 text-slate-500 hover:text-emerald-700 font-medium text-[11px] bg-slate-100 hover:bg-emerald-50 px-1.5 py-0.2 rounded transition"
                                title="Gọi điện cho khách"
                              >
                                <Phone className="w-2.5 h-2.5" />
                                <span>
                                  {highlightField === 'customerPhone'
                                    ? renderHighlighted(order.customerPhone)
                                    : order.customerPhone}
                                </span>
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-1">
                            {order.location.type === 'condo' ? (
                              <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            )}
                            <span className="font-semibold text-slate-700">
                              {highlightField === 'address'
                                ? renderHighlighted(order.location.formattedAddress)
                                : order.location.formattedAddress}
                            </span>
                            {order.location.condoName && (
                              <span className="text-[10px] text-slate-400">
                                ({order.location.condoName})
                              </span>
                            )}
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

                      {/* Row 3: Items preview and quick action buttons */}
                      <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-slate-100 text-[10px]">
                        <p className="text-slate-500 truncate flex-1">
                          {order.items
                            .map((i) => `${i.productName} x${i.quantity}`)
                            .join(', ')}
                        </p>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelect(order);
                            }}
                            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-bold transition flex items-center gap-1"
                          >
                            <Eye className="w-2.5 h-2.5" />
                            <span>Chi tiết</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dropdown Footer Navigation Links */}
            {searchInput.trim() && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Nhấn <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[9px] font-mono">Enter</kbd> để mở đơn đầu tiên
                </span>

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleNavigateScreen('HOME')}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-xs border border-slate-200 active:scale-95 transition"
                  >
                    Lọc Trang chủ
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavigateScreen('ORDER_HISTORY')}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1 active:scale-95 transition shadow-2xs"
                  >
                    <span>Lịch sử đơn ({allMatches.length})</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
