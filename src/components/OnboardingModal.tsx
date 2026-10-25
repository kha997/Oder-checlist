import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Store, X, Loader2, UserPlus } from 'lucide-react';

/**
 * P3 onboarding (docs/MULTI-TENANT-SPEC.md §8): the entry point for the
 * self-serve SaaS flow — anyone with the link can CREATE their own shop, or
 * JOIN an existing one with an invite code (the only approval-gated path).
 *
 * Deliberately dismissable: closing it keeps the app fully usable on local
 * data (local-first preserved), with a persistent banner offering to reopen.
 */
export const OnboardingModal: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
  const { createShopAction, joinShopAction, dismissOnboarding, shopStatus } = useApp();

  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [shopName, setShopName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `?join=CODE` deep link (shared invite): land directly on the join tab
  // with the code pre-filled — the recipient types nothing.
  useEffect(() => {
    if (!isOpen) return;
    try {
      const param = new URLSearchParams(window.location.search).get('join');
      if (param) {
        setInviteCode(param.trim().toUpperCase());
        setTab('join');
      }
    } catch {
      /* no-op — URL parsing is best effort */
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await createShopAction(shopName);
      // Context closes the modal and re-runs the auth flow, which activates
      // the new shop (scope + namespace + first seed).
    } catch (err) {
      console.error('createShop failed:', err);
      setError(err instanceof Error ? err.message : 'Không thể tạo cửa hàng. Thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await joinShopAction(inviteCode);
      // Context closes the modal; the flow switches to the 'pending' state
      // (banner) until a shop admin approves.
    } catch (err) {
      console.error('joinShop failed:', err);
      setError(err instanceof Error ? err.message : 'Không thể gửi yêu cầu. Thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Store className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Cửa hàng của bạn</h2>
              <p className="text-xs text-emerald-200/90">
                Tạo cửa hàng mới hoặc tham gia bằng mã mời
              </p>
            </div>
          </div>
          <button
            onClick={dismissOnboarding}
            title="Đóng — tiếp tục dùng cục bộ"
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setTab('create');
              setError(null);
            }}
            disabled={busy}
            className={`flex-1 py-2.5 text-sm font-semibold transition ${
              tab === 'create'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/60'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Tạo cửa hàng mới
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('join');
              setError(null);
            }}
            disabled={busy}
            className={`flex-1 py-2.5 text-sm font-semibold transition ${
              tab === 'join'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/60'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Tham gia bằng mã mời
          </button>
        </div>

        <div className="p-4">
          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tên cửa hàng
                </label>
                <input
                  className={inputClass}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="VD: Cơ sở Hai Bà Trưng"
                  maxLength={128}
                  autoFocus
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Mỗi tài khoản tạo được <strong>1 cửa hàng</strong>. Mọi dữ liệu đơn hàng,
                khách hàng, món ăn… sẽ thuộc về cửa hàng của bạn và chỉ thành viên được duyệt
                mới thấy.
              </p>
              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold transition flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo cửa hàng…
                  </>
                ) : (
                  <>
                    <Store className="w-4 h-4" /> Tạo cửa hàng
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mã mời
                </label>
                <input
                  className={`${inputClass} uppercase tracking-widest font-semibold`}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="VD: 7KQM3XW9"
                  maxLength={32}
                  autoFocus
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Nhập mã do chủ cửa hàng chia sẻ. Bạn sẽ ở trạng thái{' '}
                <strong>chờ duyệt</strong> cho đến khi quản trị viên chấp nhận — chưa có dữ
                liệu nào được hiển thị trước khi được duyệt.
              </p>
              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={busy || inviteCode.trim().length < 6}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold transition flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang gửi…
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> Gửi yêu cầu tham gia
                  </>
                )}
              </button>
            </form>
          )}

          {shopStatus === 'pending' && (
            <p className="mt-3 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
              Bạn đang chờ duyệt cho một cửa hàng khác — vẫn có thể tạo cửa hàng riêng của
              mình.
            </p>
          )}
        </div>

        {/* Dismiss — local-first escape hatch */}
        <div className="px-4 pb-4">
          <button
            onClick={dismissOnboarding}
            className="w-full text-xs text-slate-400 hover:text-slate-600 py-2 transition"
          >
            Để sau — tiếp tục dùng thử trên máy này
          </button>
        </div>
      </div>
    </div>
  );
};
