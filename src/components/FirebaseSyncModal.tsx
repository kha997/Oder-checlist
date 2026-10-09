import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Cloud,
  CloudCheck,
  CloudOff,
  RefreshCw,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Database,
  Users,
  Package,
  Layers,
  X,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface FirebaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseSyncModal: React.FC<FirebaseSyncModalProps> = ({ isOpen, onClose }) => {
  const {
    firebaseUser,
    cloudSyncStatus,
    lastCloudSyncTime,
    isCloudSyncActive,
    orders,
    customers,
    products,
    condos,
    stockLogs,
    signInWithGoogle,
    signOutGoogle,
    syncLocalToCloud,
  } = useApp();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      await signInWithGoogle();
      setSuccessMessage('Đăng nhập Google và kết nối Cloud thành công!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      await signOutGoogle();
      setSuccessMessage('Đã đăng xuất Cloud. Dữ liệu tiếp tục lưu an toàn trên máy này.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Đăng xuất thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceSync = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      await syncLocalToCloud();
      setSuccessMessage('Đã đồng bộ toàn bộ dữ liệu lên Firebase Cloud Firestore thành công!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Lỗi khi đồng bộ lên Cloud: ' + (err?.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const isAdminUser = firebaseUser?.email === 'khafibo@gmail.com';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Cloud className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Đồng bộ Cloud (Firebase)</h3>
              <p className="text-xs text-emerald-200">
                Lưu trữ vĩnh viễn & Chia sẻ đơn hàng giữa các thiết bị
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Status Banner */}
          {firebaseUser ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-emerald-900">Đã kết nối Firebase Cloud</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                    LIVE SYNC
                  </span>
                </div>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Tài khoản: <strong className="font-medium text-emerald-900">{firebaseUser.email}</strong>
                  {isAdminUser && (
                    <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-300">
                      ADMIN
                    </span>
                  )}
                </p>
                {lastCloudSyncTime && (
                  <p className="text-[11px] text-emerald-600 mt-1">
                    Đồng bộ gần nhất: {new Date(lastCloudSyncTime).toLocaleTimeString('vi-VN')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <CloudOff className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm text-amber-900">Chưa kích hoạt Cloud Sync</span>
                <p className="text-xs text-amber-700 mt-0.5">
                  Hiện tại dữ liệu chỉ lưu trên máy này (Offline Local Storage). Đăng nhập Google để đồng bộ vĩnh viễn và chia sẻ tức thì với các shipper/máy tính khác!
                </p>
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Database Metrics Grid */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              Dữ liệu được bảo vệ & đồng bộ:
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 block">Đơn hàng</span>
                <span className="text-lg font-bold text-slate-800">{orders.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 block">Khách hàng</span>
                <span className="text-lg font-bold text-slate-800">{customers.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 block">Món hàng / Menu</span>
                <span className="text-lg font-bold text-slate-800">{products.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 block">Lịch sử kho</span>
                <span className="text-lg font-bold text-slate-800">{stockLogs.length}</span>
              </div>
            </div>
          </div>

          {/* Cloud Features Info */}
          <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Lợi ích khi bật Cloud Sync Firebase:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-600">
              <li><strong>Thời gian thực (Real-time):</strong> Bếp tạo đơn, Shipper mở máy thấy ngay lập tức mà không cần bấm F5 / tải lại.</li>
              <li><strong>Lưu trữ vĩnh viễn:</strong> Đổi điện thoại, xóa dữ liệu trình duyệt không bao giờ bị mất đơn.</li>
              <li><strong>An toàn & Bảo mật:</strong> Xác thực Google Auth và hệ thống phân quyền Firebase Security Rules.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            {!firebaseUser ? (
              <button
                onClick={handleSignIn}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Đăng nhập Google để kích hoạt Cloud Sync</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleForceSync}
                  disabled={isLoading}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 text-xs shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Đẩy toàn bộ lên Cloud</span>
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-semibold rounded-xl transition flex items-center justify-center gap-1.5 text-xs border border-slate-300"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-500" />
                  <span>Đăng xuất Cloud</span>
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-800 transition"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
