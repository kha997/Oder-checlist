import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { type UserRole, ROLE_CONFIGS, type StaffUser } from '../types';
import {
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Phone,
  Mail,
  Bike,
  UtensilsCrossed,
  Wallet,
  Crown,
  KeyRound,
  Eye,
  EyeOff,
  CloudCheck,
  Check,
} from 'lucide-react';

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({ isOpen, onClose }) => {
  const {
    staffUsers,
    activeStaff,
    setActiveStaffId,
    addStaffUser,
    updateStaffUser,
    deleteStaffUser,
    currentRole,
    roleConfig,
    firebaseUser,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'switch' | 'manage' | 'matrix'>('switch');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Add / Edit form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('SHIPPER');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setFormName('');
    setFormRole('SHIPPER');
    setFormPhone('');
    setFormEmail('');
    setFormPin('');
    setFormError(null);
    setEditingStaffId(null);
    setShowAddForm(true);
    setActiveTab('manage');
  };

  const handleStartEdit = (staff: StaffUser) => {
    setFormName(staff.name);
    setFormRole(staff.role);
    setFormPhone(staff.phone || '');
    setFormEmail(staff.email || '');
    setFormPin(staff.pin || '');
    setFormError(null);
    setEditingStaffId(staff.id);
    setShowAddForm(true);
    setActiveTab('manage');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên nhân viên');
      return;
    }

    if (editingStaffId) {
      updateStaffUser(editingStaffId, {
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        pin: formPin.trim() || undefined,
      });
      setSuccessNotice(`Đã cập nhật thông tin cho ${formName.trim()}`);
    } else {
      addStaffUser({
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        pin: formPin.trim() || undefined,
        active: true,
      });
      setSuccessNotice(`Đã thêm nhân viên mới: ${formName.trim()}`);
    }

    setShowAddForm(false);
    setEditingStaffId(null);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleDeleteStaff = (staff: StaffUser) => {
    if (staff.id === activeStaff.id) {
      alert('Không thể xóa tài khoản đang đăng nhập trực ca!');
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn xóa nhân viên "${staff.name}" khỏi danh sách?`)) {
      deleteStaffUser(staff.id);
      setSuccessNotice(`Đã xóa nhân viên ${staff.name}`);
      setTimeout(() => setSuccessNotice(null), 3000);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return <Crown className="w-4 h-4 text-purple-600" />;
      case 'KITCHEN':
        return <UtensilsCrossed className="w-4 h-4 text-amber-600" />;
      case 'SHIPPER':
        return <Bike className="w-4 h-4 text-blue-600" />;
      case 'CASHIER':
        return <Wallet className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Phân quyền & Tài khoản (RBAC)</h2>
              <p className="text-xs text-emerald-200/90">
                Vai trò hiện tại:{' '}
                <span className="font-semibold text-white">
                  {roleConfig.label}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Persona Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-bold text-sm">
                {activeStaff.name.slice(0, 2).toUpperCase()}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${roleConfig.dotColor}`}></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{activeStaff.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleConfig.badgeClass}`}>
                  {roleConfig.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>{activeStaff.phone || 'Chưa có SĐT'}</span>
                {activeStaff.email && (
                  <span className="text-[11px] text-slate-400">({activeStaff.email})</span>
                )}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-1 rounded-md">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Đang trực ca
            </span>
          </div>
        </div>

        {/* Success Notice */}
        {successNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-3 pt-2 gap-1 shrink-0">
          <button
            onClick={() => {
              setActiveTab('switch');
              setShowAddForm(false);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 ${
              activeTab === 'switch' && !showAddForm
                ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Đổi người trực ca</span>
            <span className="ml-1 text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
              {staffUsers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('manage')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 ${
              activeTab === 'manage'
                ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Danh sách & Thêm mới</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('matrix');
              setShowAddForm(false);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Bảng ma trận quyền hạn</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: QUICK SWITCH */}
          {activeTab === 'switch' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Chọn nhân sự đang sử dụng thiết bị để hệ thống tự động lưu lịch sử giao hàng và thu tiền:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {staffUsers.map((staff) => {
                  const cfg = ROLE_CONFIGS[staff.role];
                  const isCurrent = staff.id === activeStaff.id;

                  return (
                    <button
                      key={staff.id}
                      onClick={() => {
                        setActiveStaffId(staff.id);
                        setSuccessNotice(`Đã chuyển sang: ${staff.name} (${cfg.label})`);
                        setTimeout(() => setSuccessNotice(null), 2500);
                      }}
                      className={`text-left p-3 rounded-xl border transition flex items-start gap-3 relative ${
                        isCurrent
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        {getRoleIcon(staff.role)}
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {staff.name}
                          </span>
                        </div>
                        <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded-md border mt-1 ${cfg.badgeClass}`}>
                          {cfg.shortLabel}
                        </span>
                        {staff.phone && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{staff.phone}</p>
                        )}
                      </div>

                      {isCurrent && (
                        <div className="absolute top-2 right-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5 mt-2">
                <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Đồng bộ Cloud đa thiết bị:</span> Khi đổi người trực ca hoặc thêm nhân viên mới, danh sách sẽ được đồng bộ tức thì lên Firestore và lưu lại tên shipper/thu ngân trên mọi đơn hàng.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE & ADD FORM */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              {!showAddForm ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Danh sách nhân viên ({staffUsers.length})
                      </h4>
                      <p className="text-xs text-slate-500">Quản lý chức vụ và quyền hạn của từng thành viên</p>
                    </div>

                    <button
                      onClick={handleStartAdd}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm nhân viên</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {staffUsers.map((staff) => {
                      const cfg = ROLE_CONFIGS[staff.role];
                      const isCurrent = staff.id === activeStaff.id;

                      return (
                        <div
                          key={staff.id}
                          className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                              {getRoleIcon(staff.role)}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900 truncate">
                                  {staff.name}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                                    Đang trực ca
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${cfg.badgeClass}`}>
                                  {cfg.label}
                                </span>
                                {staff.phone && (
                                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                    <Phone className="w-2.5 h-2.5 text-slate-400" />
                                    {staff.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEdit(staff)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Sửa thông tin"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {staffUsers.length > 1 && !isCurrent && (
                              <button
                                onClick={() => handleDeleteStaff(staff)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Xóa nhân viên"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* ADD / EDIT FORM */
                <form onSubmit={handleSaveForm} className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h4 className="text-xs font-bold text-slate-800">
                      {editingStaffId ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Hủy
                    </button>
                  </div>

                  {formError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên nhân viên *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Tuấn (Bếp), Hùng (Shipper), Lan (Thu ngân)"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Vai trò & Phân quyền *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(ROLE_CONFIGS) as UserRole[]).map((r) => {
                        const cfg = ROLE_CONFIGS[r];
                        const isSelected = formRole === r;
                        return (
                          <button
                            type="button"
                            key={r}
                            onClick={() => setFormRole(r)}
                            className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                              isSelected
                                ? 'border-emerald-600 bg-white ring-2 ring-emerald-500 shadow-xs'
                                : 'border-slate-200 bg-white/70 hover:bg-white'
                            }`}
                          >
                            <div className="shrink-0">{getRoleIcon(r)}</div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 leading-tight">
                                {cfg.label}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                {cfg.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Số điện thoại
                      </label>
                      <input
                        type="tel"
                        placeholder="09xx xxx xxx"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Google (để đồng bộ)
                      </label>
                      <input
                        type="email"
                        placeholder="nhanvien@gmail.com"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition"
                    >
                      {editingStaffId ? 'Lưu thay đổi' : 'Thêm nhân viên'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: PERMISSION MATRIX */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 mb-1">
                  Ma trận phân quyền chi tiết (Role Permissions Matrix)
                </h4>
                <p className="text-xs text-slate-500">
                  Hệ thống kiểm soát quyền hạn theo từng vai trò để bảo mật số liệu doanh thu và tối ưu quy trình làm việc.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-2.5">Chức năng / Quyền hạn</th>
                      <th className="p-2.5 text-center text-purple-800 bg-purple-50/60">Admin</th>
                      <th className="p-2.5 text-center text-amber-800 bg-amber-50/60">Bếp</th>
                      <th className="p-2.5 text-center text-blue-800 bg-blue-50/60">Shipper</th>
                      <th className="p-2.5 text-center text-emerald-800 bg-emerald-50/60">Thu ngân</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="p-2.5 font-medium">Tạo & chỉnh sửa đơn hàng</td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Xem món cần nấu (Bếp KDS) & Báo nấu xong</td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Chế độ Giao hàng & Chụp ảnh POD</td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Xác nhận thu tiền / COD</td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                    </tr>
                    <tr className="bg-amber-50/30">
                      <td className="p-2.5 font-bold text-amber-950">Xem Giá vốn & Lợi nhuận gộp (Bảo mật)</td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                    </tr>
                    <tr className="bg-amber-50/30">
                      <td className="p-2.5 font-bold text-amber-950">Báo cáo Doanh thu & Lịch sử tài chính</td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Nhập hàng vào kho & Chỉnh giá bán</td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><span className="text-[10px] text-slate-400">Chỉ xem tồn</span></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                      <td className="p-2.5 text-center"><span className="text-[10px] text-slate-400">Chỉ xem tồn</span></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Xóa đơn hàng & Hủy dữ liệu</td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Quản trị Nhân sự & Phân quyền</td>
                      <td className="p-2.5 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                      <td className="p-2.5 text-center"><XCircle className="w-4 h-4 text-rose-400 mx-auto" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full ${roleConfig.dotColor}`}></span>
            <span>Đang trực: <strong className="text-slate-800">{activeStaff.name}</strong> ({roleConfig.shortLabel})</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
