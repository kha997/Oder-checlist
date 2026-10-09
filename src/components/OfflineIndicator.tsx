import React from 'react';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 left-4 right-4 max-w-sm mx-auto z-50 flex items-center justify-center gap-2 rounded-xl bg-amber-500/95 backdrop-blur-sm px-3.5 py-2 text-xs font-semibold text-white shadow-xl animate-bounce">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Đang ngoại tuyến — Dữ liệu lưu cục bộ an toàn (Offline mode)</span>
    </div>
  );
};
