import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Cài App / Install</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Cài trên iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Cài đặt ứng dụng trên iPhone</h3>
                <button onClick={() => setShowIOSGuide(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>1. Nhấn nút <strong>Chia sẻ (Share <span className="text-blue-500">⎋</span>)</strong> trên thanh công cụ Safari.</p>
                <p>2. Cuộn xuống chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.</p>
                <p>3. Nhấn <strong>Thêm (Add)</strong> để mở ứng dụng toàn màn hình.</p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Đã hiểu (Done)
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
