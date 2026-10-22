import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { Mic, MicOff, Volume2, Check, X, Sparkles, ShoppingBag, Building2, User, Phone, FileText, AlertCircle, Play, RotateCcw } from 'lucide-react';
import {
  isSpeechRecognitionSupported,
  createSpeechRecognition,
  getSpeechErrorMessage,
  parseVoiceOrder,
  VOICE_ORDER_SAMPLE_PHRASES,
  type ParsedVoiceOrder,
  type ISpeechRecognition,
} from '../utils/speechRecognition';

interface VoiceOrderDictationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyOrder: (data: {
    itemQuantities: Record<string, number>;
    locationType?: 'condo' | 'external';
    condoId?: string;
    block?: string;
    floor?: string;
    unit?: string;
    externalAddress?: string;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
  }) => void;
}

export const VoiceOrderDictationModal: React.FC<VoiceOrderDictationModalProps> = ({
  isOpen,
  onClose,
  onApplyOrder,
}) => {
  const { products, condos } = useApp();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsed result
  const [parsed, setParsed] = useState<ParsedVoiceOrder | null>(null);

  // User selectable application toggles
  const [applyItems, setApplyItems] = useState(true);
  const [applyLocation, setApplyLocation] = useState(true);
  const [applyCustomer, setApplyCustomer] = useState(true);
  const [applyNotes, setApplyNotes] = useState(true);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const supported = isSpeechRecognitionSupported();

  // Parse whenever transcript changes
  useEffect(() => {
    if (transcript.trim()) {
      const result = parseVoiceOrder(transcript, products, condos);
      setParsed(result);
    } else {
      setParsed(null);
    }
  }, [transcript, products, condos]);

  // Clean up on unmount or close
  useEffect(() => {
    if (!isOpen && isListening) {
      stopListening();
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const startListening = () => {
    setErrorMessage(null);
    setInterimText('');

    if (!supported) {
      setErrorMessage(
        'Trình duyệt này chưa hỗ trợ Web Speech API. Bạn có thể sử dụng các "Câu nói mẫu" bên dưới để thử nghiệm hoặc gõ chỉnh sửa văn bản.'
      );
      return;
    }

    try {
      const recognition = createSpeechRecognition({
        lang: 'vi-VN',
        continuous: true,
        interimResults: true,
      });

      if (!recognition) {
        setErrorMessage('Không thể khởi tạo bộ nhận diện giọng nói.');
        return;
      }

      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalChunk += res[0].transcript + ' ';
          } else {
            interimChunk += res[0].transcript;
          }
        }

        setInterimText(interimChunk.trim());

        if (finalChunk.trim()) {
          setTranscript((prev) => {
            const separator = prev.trim() ? ' ' : '';
            return `${prev}${separator}${finalChunk.trim()}`;
          });
        }
      };

      recognition.onerror = (ev) => {
        console.warn('SpeechRecognition error:', ev.error);
        const msg = getSpeechErrorMessage(ev.error);
        if (ev.error !== 'no-speech') {
          setErrorMessage(msg);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setErrorMessage('Không thể truy cập Microphone. Vui lòng cấp quyền micro.');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
    setIsListening(false);
    setInterimText('');
  };

  const handleSelectSample = (sampleText: string) => {
    stopListening();
    setTranscript(sampleText);
  };

  const handleClear = () => {
    stopListening();
    setTranscript('');
    setInterimText('');
    setParsed(null);
    setErrorMessage(null);
  };

  const handleApplyToOrder = () => {
    if (!parsed) return;

    const result: {
      itemQuantities: Record<string, number>;
      locationType?: 'condo' | 'external';
      condoId?: string;
      block?: string;
      floor?: string;
      unit?: string;
      externalAddress?: string;
      customerName?: string;
      customerPhone?: string;
      notes?: string;
    } = {
      itemQuantities: {},
    };

    if (applyItems && parsed.matchedItems.length > 0) {
      parsed.matchedItems.forEach((item) => {
        result.itemQuantities[item.productId] = item.quantity;
      });
    }

    if (applyLocation && parsed.detectedLocation) {
      result.locationType = parsed.detectedLocation.type;
      result.condoId = parsed.detectedLocation.condoId;
      result.block = parsed.detectedLocation.block;
      result.floor = parsed.detectedLocation.floor;
      result.unit = parsed.detectedLocation.unit;
      result.externalAddress = parsed.detectedLocation.externalAddress;
    }

    if (applyCustomer && parsed.detectedCustomer) {
      result.customerName = parsed.detectedCustomer.name;
      result.customerPhone = parsed.detectedCustomer.phone;
    }

    if (applyNotes && parsed.detectedNotes) {
      result.notes = parsed.detectedNotes;
    }

    onApplyOrder(result);
    onClose();
  };

  const hasAnyDetectedData =
    parsed &&
    (parsed.matchedItems.length > 0 ||
      parsed.detectedLocation ||
      parsed.detectedCustomer ||
      parsed.detectedNotes);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Đọc Đơn Bằng Giọng Nói</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  AI Voice-to-Text
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Nói tự nhiên tên món, số lượng, phòng/toà, tên khách và dặn dò đặc biệt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Main Microphone Action Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-emerald-50/40 border border-emerald-100 text-center flex flex-col items-center justify-center relative overflow-hidden">
            {/* Animated Pulsing Rings when listening */}
            {isListening && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-32 h-32 rounded-full bg-rose-400/20 animate-ping" />
                <span className="w-48 h-48 rounded-full bg-emerald-400/10 animate-pulse" />
              </div>
            )}

            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all transform active:scale-95 shadow-lg ${
                isListening
                  ? 'bg-gradient-to-tr from-rose-500 to-red-600 text-white shadow-rose-500/40 scale-105 ring-4 ring-rose-200'
                  : 'bg-gradient-to-tr from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/30'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-8 h-8" />
                  <span className="text-[10px] font-black uppercase mt-1">Dừng</span>
                </>
              ) : (
                <>
                  <Mic className="w-8 h-8" />
                  <span className="text-[10px] font-black uppercase mt-1">Bấm & Nói</span>
                </>
              )}
            </button>

            <div className="mt-3 relative z-10">
              <span
                className={`text-xs font-extrabold uppercase tracking-wide inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
                  isListening
                    ? 'bg-rose-100 text-rose-800 animate-pulse'
                    : 'bg-white text-emerald-800 border border-emerald-200'
                }`}
              >
                {isListening ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-rose-600 animate-bounce" />
                    <span>Đang lắng nghe giọng nói...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Bấm vào micro để bắt đầu đọc</span>
                  </>
                )}
              </span>

              <p className="text-[11px] text-slate-500 mt-1.5">
                Ví dụ: &ldquo;Cho 2 cà phê muối, 1 bánh mì chảo, phòng 1205 toà B, ít ngọt không ớt&rdquo;
              </p>
            </div>

            {/* Sound Wave Bars */}
            {isListening && (
              <div className="flex items-center justify-center gap-1 mt-3">
                {[30, 60, 90, 75, 100, 80, 50, 95, 65, 85, 45, 70, 30].map((h, i) => (
                  <span
                    key={i}
                    className="w-1 bg-rose-500 rounded-full animate-pulse"
                    style={{
                      height: `${h * 0.22}px`,
                      animationDelay: `${i * 0.08}s`,
                      animationDuration: '0.6s',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Transcribed Text Field (Editable) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nội dung nhận diện (Transcript)</span>
              </label>
              {transcript && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Xóa làm lại</span>
                </button>
              )}
            </div>

            <div className="relative">
              <textarea
                rows={3}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Lời nói của bạn sẽ xuất hiện tại đây theo thời gian thực (bạn cũng có thể tự gõ chỉnh sửa)..."
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder:text-slate-400 leading-relaxed transition"
              />
              {interimText && (
                <div className="absolute bottom-2 left-3 right-3 text-[11px] italic text-emerald-700 bg-emerald-50/90 px-2 py-1 rounded-lg border border-emerald-200 truncate">
                  Đang nói: &ldquo;{interimText}&rdquo;
                </div>
              )}
            </div>
          </div>

          {/* Quick Preset Phrases for Instant Testing */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Câu nói mẫu kiểm thử nhanh (Click to Test):
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {VOICE_ORDER_SAMPLE_PHRASES.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSample(sample.text)}
                  className="p-2 text-left bg-white hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-xl transition group shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-800 flex items-center gap-1">
                      <Play className="w-2.5 h-2.5 text-emerald-600 fill-emerald-600" />
                      {sample.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    {sample.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Smart Parsed Breakdown Cards */}
          {parsed && hasAnyDetectedData && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Kết quả phân tích thông minh</span>
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full">
                  Độ chính xác: {Math.round(parsed.confidenceScore * 100)}%
                </span>
              </div>

              {/* 1. Detected Products & Quantities */}
              <div
                className={`p-2.5 rounded-xl border transition ${
                  applyItems ? 'bg-white border-emerald-300 shadow-2xs' : 'bg-slate-100/70 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyItems}
                      onChange={(e) => setApplyItems(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                      Món ăn & Số lượng ({parsed.matchedItems.length} món)
                    </span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">
                    {parsed.matchedItems.length > 0 ? 'Nhận diện thành công' : 'Chưa nhận diện món'}
                  </span>
                </div>

                {parsed.matchedItems.length > 0 ? (
                  <div className="space-y-1 pl-6">
                    {parsed.matchedItems.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-emerald-50/60 border border-emerald-100 font-semibold"
                      >
                        <span className="text-emerald-950">
                          {item.quantity}x {item.productName}
                        </span>
                        <span className="font-extrabold text-emerald-700">
                          {formatVND(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic pl-6">
                    Không tìm thấy tên món trong thực đơn. Bạn có thể tự chọn món bên dưới sau khi đóng cửa sổ.
                  </p>
                )}
              </div>

              {/* 2. Detected Location */}
              {parsed.detectedLocation && (
                <div
                  className={`p-2.5 rounded-xl border transition ${
                    applyLocation
                      ? 'bg-white border-emerald-300 shadow-2xs'
                      : 'bg-slate-100/70 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyLocation}
                        onChange={(e) => setApplyLocation(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        Địa chỉ & Phòng giao hàng
                      </span>
                    </label>
                  </div>

                  <div className="pl-6 text-xs text-slate-700 font-semibold flex items-center gap-2 flex-wrap">
                    <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-lg border border-blue-200">
                      Tòa: {parsed.detectedLocation.block || 'B'}
                    </span>
                    {parsed.detectedLocation.floor && (
                      <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-lg border border-blue-200">
                        Tầng: {parsed.detectedLocation.floor}
                      </span>
                    )}
                    {parsed.detectedLocation.unit && (
                      <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-lg border border-blue-200">
                        Phòng: {parsed.detectedLocation.unit}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Detected Customer */}
              {parsed.detectedCustomer && (
                <div
                  className={`p-2.5 rounded-xl border transition ${
                    applyCustomer
                      ? 'bg-white border-emerald-300 shadow-2xs'
                      : 'bg-slate-100/70 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyCustomer}
                        onChange={(e) => setApplyCustomer(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-purple-600" />
                        Khách hàng
                      </span>
                    </label>
                  </div>

                  <div className="pl-6 text-xs text-slate-700 font-semibold flex items-center gap-2">
                    {parsed.detectedCustomer.name && (
                      <span className="bg-purple-50 text-purple-800 px-2 py-0.5 rounded-lg border border-purple-200">
                        Tên: {parsed.detectedCustomer.name}
                      </span>
                    )}
                    {parsed.detectedCustomer.phone && (
                      <span className="bg-purple-50 text-purple-800 px-2 py-0.5 rounded-lg border border-purple-200 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {parsed.detectedCustomer.phone}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Detected Special Instructions & Notes */}
              {parsed.detectedNotes && (
                <div
                  className={`p-2.5 rounded-xl border transition ${
                    applyNotes
                      ? 'bg-white border-emerald-300 shadow-2xs'
                      : 'bg-slate-100/70 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyNotes}
                        onChange={(e) => setApplyNotes(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        Ghi chú & Dặn dò giao hàng (Instructions)
                      </span>
                    </label>
                  </div>

                  <div className="pl-6">
                    <p className="text-xs text-amber-900 bg-amber-50/80 p-2 rounded-lg border border-amber-200 font-semibold leading-relaxed">
                      &ldquo;{parsed.detectedNotes}&rdquo;
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Đóng
          </button>

          <button
            type="button"
            disabled={!hasAnyDetectedData}
            onClick={handleApplyToOrder}
            className="flex-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Áp dụng vào đơn hàng</span>
          </button>
        </div>
      </div>
    </div>
  );
};
