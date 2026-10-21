import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Check,
  X,
  AlertCircle,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import {
  isSpeechRecognitionSupported,
  createSpeechRecognition,
  getSpeechErrorMessage,
  type ISpeechRecognition,
} from '../utils/speechRecognition';

interface VoiceNoteDictationButtonProps {
  currentValue: string;
  onValueChange: (newValue: string) => void;
  placeholderPrompt?: string;
  className?: string;
  buttonLabel?: string;
}

export const VoiceNoteDictationButton: React.FC<VoiceNoteDictationButtonProps> = ({
  currentValue,
  onValueChange,
  placeholderPrompt = 'Nói hướng dẫn giao hàng hoặc dặn dò của khách...',
  className = '',
  buttonLabel = 'Đọc giọng nói',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appendMode, setAppendMode] = useState<boolean>(true);
  const [showHelperModal, setShowHelperModal] = useState(false);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const initialValueRef = useRef<string>(currentValue);

  const supported = isSpeechRecognitionSupported();

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore abort error on unmount
        }
      }
    };
  }, []);

  const startListening = () => {
    setErrorMessage(null);
    setInterimTranscript('');
    initialValueRef.current = currentValue;

    if (!supported) {
      setErrorMessage(
        'Trình duyệt này chưa hỗ trợ Web Speech API. Vui lòng mở trên Google Chrome, Edge hoặc Safari để dùng tính năng đọc giọng nói.'
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

        setInterimTranscript(interimChunk.trim());

        if (finalChunk.trim()) {
          const cleanChunk = finalChunk.trim();
          if (appendMode) {
            const separator = currentValue.trim() ? ', ' : '';
            const updated = `${currentValue}${separator}${cleanChunk}`;
            onValueChange(updated);
          } else {
            onValueChange(cleanChunk);
          }
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
        setInterimTranscript('');
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setErrorMessage('Không thể bật Microphone. Vui lòng cấp quyền micro.');
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
    setInterimTranscript('');
  };

  const handleSimulateQuickPhrase = (phrase: string) => {
    if (appendMode && currentValue.trim()) {
      onValueChange(`${currentValue}, ${phrase}`);
    } else {
      onValueChange(phrase);
    }
  };

  return (
    <div className={`relative inline-flex flex-col items-start ${className}`}>
      {/* Trigger Button */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition active:scale-95 shadow-xs ${
            isListening
              ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-2 ring-rose-400/50'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
          }`}
          title={isListening ? 'Nhấn để dừng thu âm' : 'Bấm để đọc ghi chú / hướng dẫn giao hàng bằng giọng nói'}
        >
          {isListening ? (
            <>
              <span className="w-2 h-2 rounded-full bg-white animate-ping mr-0.5" />
              <MicOff className="w-3.5 h-3.5 text-white" />
              <span>Dừng đọc</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-emerald-700" />
              <span>{buttonLabel}</span>
            </>
          )}
        </button>

        {/* Append vs Replace Toggle */}
        <button
          type="button"
          onClick={() => setAppendMode(!appendMode)}
          className={`text-[10px] px-2 py-0.5 rounded-lg border transition font-medium ${
            appendMode
              ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              : 'bg-amber-100 border-amber-300 text-amber-800'
          }`}
          title={appendMode ? 'Đang ở chế độ Nối tiếp vào ghi chú hiện có' : 'Đang ở chế độ Ghi đè toàn bộ'}
        >
          {appendMode ? '+ Nối tiếp' : '↺ Ghi đè'}
        </button>

        {/* Quick Helper info */}
        <button
          type="button"
          onClick={() => setShowHelperModal(!showHelperModal)}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
          title="Xem hướng dẫn đọc giọng nói & câu mẫu"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Live Voice Activity Banner when Listening */}
      {isListening && (
        <div className="mt-2 w-full p-2.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 rounded-xl shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1">
                <Volume2 className="w-3 h-3 text-emerald-700 animate-bounce" />
                Đang lắng nghe...
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[10px] bg-white text-emerald-800 px-1.5 py-0.5 rounded-md border border-emerald-200 font-semibold">
                Tiếng Việt (vi-VN)
              </span>
              <button
                type="button"
                onClick={stopListening}
                className="text-[10px] bg-rose-100 hover:bg-rose-200 text-rose-800 px-2 py-0.5 rounded-md font-bold transition"
              >
                Xong
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-700 italic mt-1.5 bg-white/80 p-1.5 rounded-lg border border-emerald-100 min-h-[24px]">
            {interimTranscript ? (
              <span className="text-emerald-900 font-semibold">
                &ldquo;{interimTranscript}&rdquo;
              </span>
            ) : (
              <span className="text-slate-400">
                {placeholderPrompt} (ví dụ: &ldquo;Ít ngọt, giao sảnh bảo vệ gọi trước 5 phút&rdquo;)
              </span>
            )}
          </p>

          {/* Sound wave bars */}
          <div className="flex items-center justify-center gap-1 mt-1.5">
            {[40, 70, 90, 60, 80, 45, 95, 65, 85, 50, 75, 40].map((h, i) => (
              <span
                key={i}
                className="w-1 bg-emerald-500 rounded-full animate-pulse"
                style={{
                  height: `${h * 0.16}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '0.8s',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="mt-1.5 w-full p-2 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{errorMessage}</span>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-[10px] font-bold text-rose-700 hover:underline"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Helper / Demo dropdown */}
      {showHelperModal && (
        <div className="mt-2 w-full p-3 bg-white border border-slate-200 rounded-xl shadow-lg space-y-2 z-10 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Mẫu dặn dò phổ biến (Bấm để điền nhanh):
            </span>
            <button
              type="button"
              onClick={() => setShowHelperModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              'Ít ngọt, không ớt',
              'Giao sảnh bảo vệ, gọi trước 5 phút',
              'Treo trước cửa, bấm chuông',
              'Nhà có em bé ngủ, đừng bấm chuông',
              'Gửi lễ tân toà nhà',
              'Giao trước 12h trưa',
              'Đóng gói cẩn thận làm quà',
            ].map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => handleSimulateQuickPhrase(phrase)}
                className="text-[10px] bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 transition font-medium"
              >
                +{phrase}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
            💡 Mẹo: Bạn có thể nhấn giữ hoặc bấm &ldquo;Đọc giọng nói&rdquo; rồi nói tự nhiên bằng tiếng Việt, hệ thống sẽ tự động chuyển giọng nói thành văn bản.
          </p>
        </div>
      )}
    </div>
  );
};
