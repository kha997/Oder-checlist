import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { type UserRole, ROLE_CONFIGS, type StaffUser } from '../types';
import { Users, Shield, ShieldCheck, UserCheck, Plus, Edit2, Trash2, CheckCircle2, XCircle, AlertCircle, X, Phone, Bike, UtensilsCrossed, Wallet, Crown, Check, KeyRound, UserPlus } from 'lucide-react';
import {
  deleteStaffRequest,
  listStaffRequests,
  listStaffRoles,
  setStaffRole,
  deleteStaffRole,
  listShopMembers,
  approveMember,
  removeMember,
  type StaffRequestDoc,
  type StaffRoleDoc,
} from '../firebase/firestoreService';

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({ isOpen, onClose }) => {
  const {
    staffUsers,
    activeStaff,
    currentRole,
    firebaseUser,
    assignedRole,
    setActiveStaffId,
    addStaffUser,
    updateStaffUser,
    deleteStaffUser,
    roleConfig,
    tenancyMode,
    shopStatus,
    currentShop,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'switch' | 'manage' | 'matrix' | 'roles'>('switch');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Add / Edit form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('SHIPPER');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [approvingRequestUid, setApprovingRequestUid] = useState<string | null>(null);
  const [approveRole, setApproveRole] = useState<UserRole>('CASHIER');
  const [accessRequests, setAccessRequests] = useState<StaffRequestDoc[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<StaffRoleDoc[]>([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [roleSort, setRoleSort] = useState<'name' | 'role' | 'email'>('name');
  const [loadingRoles, setLoadingRoles] = useState(false);

  const hasServerRole = assignedRole !== null;
  const isAdmin = currentRole === 'ADMIN' || firebaseUser?.email === 'khafibo@gmail.com';

  const filteredAssignments = React.useMemo(() => {
    const term = roleFilter.trim().toLowerCase();
    let list = roleAssignments.filter((a) => {
      if (!term) return true;
      return (
        (a.displayName || '').toLowerCase().includes(term) ||
        (a.email || '').toLowerCase().includes(term)
      );
    });
    list = [...list].sort((a, b) => {
      if (roleSort === 'role') {
        return a.role.localeCompare(b.role);
      }
      if (roleSort === 'email') {
        return (a.email || '').localeCompare(b.email || '');
      }
      return (a.displayName || '').localeCompare(b.displayName || '');
    });
    return list;
  }, [roleAssignments, roleFilter, roleSort]);

  const loadRoleData = async () => {
    if (!isAdmin) return;
    setLoadingRoles(true);
    try {
      if (tenancyMode === 'tenancy') {
        // Membership is the authority in tenancy mode: one read of the shop
        // roster yields BOTH the active assignments and the pending joins.
        if (!currentShop || shopStatus !== 'active') {
          setAccessRequests([]);
          setRoleAssignments([]);
          return;
        }
        const members = await listShopMembers(currentShop.shopId);
        setRoleAssignments(
          members
            .filter((m) => m.status === 'active')
            .map((m) => ({
              uid: m.uid,
              email: m.email,
              displayName: m.displayName,
              role: m.role,
              createdAt: m.createdAt,
            }))
        );
        setAccessRequests(
          members
            .filter((m) => m.status === 'pending')
            .map((m) => ({
              uid: m.uid,
              email: m.email,
              displayName: m.displayName,
              requestedAt: m.createdAt,
            }))
        );
        return;
      }
      const [requests, assignments] = await Promise.all([
        listStaffRequests(),
        listStaffRoles(),
      ]);
      setAccessRequests(requests);
      setRoleAssignments(assignments);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAdmin) {
      loadRoleData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isAdmin, tenancyMode, currentShop?.shopId, shopStatus]);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setFormName('');
    setFormRole('SHIPPER');
    setFormPhone('');
    setFormEmail('');
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
      });
      setSuccessNotice(`Đã cập nhật thông tin cho ${formName.trim()}`);
    } else {
      addStaffUser({
        name: formName.trim(),
        role: formRole,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
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

  const handleApproveRequest = async (req: StaffRequestDoc) => {
    try {
      if (tenancyMode === 'tenancy') {
        // Tenancy: flip the pending member doc to active with the chosen
        // role (the rules only let a shop admin do this).
        if (!currentShop) throw new Error('Không có cửa hàng hoạt động.');
        await approveMember(currentShop.shopId, req.uid, approveRole);
      } else {
        await setStaffRole({
          uid: req.uid,
          email: req.email,
          displayName: req.displayName,
          role: approveRole,
          createdAt: new Date().toISOString(),
        });
        await deleteStaffRequest(req.uid);
      }
      setSuccessNotice(`Đã cấp quyền ${ROLE_CONFIGS[approveRole].label} cho ${req.displayName}`);
      setTimeout(() => setSuccessNotice(null), 3000);
      await loadRoleData();
      setApprovingRequestUid(null);
    } catch (err) {
      console.error('Failed to approve access request:', err);
      alert('Không thể duyệt yêu cầu. Kiểm tra quyền ADMIN và kết nối Firestore.');
    }
  };

  const handleDismissRequest = async (req: StaffRequestDoc) => {
    if (!confirm(`Từ chối yêu cầu tham gia của ${req.displayName}?`)) return;
    try {
      if (tenancyMode === 'tenancy') {
        if (!currentShop) throw new Error('Không có cửa hàng hoạt động.');
        // Deleting the pending member doc rejects the join; the requester's
        // client sees it disappear and returns to the onboarding state.
        await removeMember(currentShop.shopId, req.uid);
      } else {
        await deleteStaffRequest(req.uid);
      }
      setSuccessNotice('Đã từ chối yêu cầu tham gia');
      setTimeout(() => setSuccessNotice(null), 3000);
      await loadRoleData();
    } catch (err) {
      console.error('Failed to dismiss access request:', err);
    }
  };

  const handleRevokeRole = async (assignment: StaffRoleDoc) => {
    if (assignment.uid === firebaseUser?.uid) {
      alert('Không thể thu hồi quyền tài khoản đang đăng nhập!');
      return;
    }
    if (!confirm(`Thu hồi quyền ${ROLE_CONFIGS[assignment.role].label} của ${assignment.displayName}?`)) return;
    try {
      if (tenancyMode === 'tenancy') {
        if (!currentShop) throw new Error('Không có cửa hàng hoạt động.');
        // Deleting the member doc signs their client out immediately
        // (membership listener) — same UX as the legacy revoke.
        await removeMember(currentShop.shopId, assignment.uid);
      } else {
        await deleteStaffRole(assignment.uid);
      }
      setSuccessNotice(`Đã thu hồi quyền của ${assignment.displayName}`);
      setTimeout(() => setSuccessNotice(null), 3000);
      await loadRoleData();
    } catch (err) {
      console.error('Failed to revoke role:', err);
      alert('Không thể thu hồi quyền.');
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
            {hasServerRole && (
              <span className="text-[9px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full font-bold">
                Theo role server
              </span>
            )}
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

          {isAdmin && (
            <button
              onClick={() => {
                setActiveTab('roles');
                setShowAddForm(false);
                loadRoleData();
              }}
              className={`px-3 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 ${
                activeTab === 'roles'
                  ? 'bg-white text-emerald-800 border-t-2 border-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Phân quyền truy cập</span>
              {(accessRequests.length > 0 || loadingRoles) && (
                <span className="ml-1 text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-full font-bold">
                  {loadingRoles ? '...' : accessRequests.length}
                </span>
              )}
            </button>
          )}
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
              {hasServerRole && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <p className="leading-relaxed">
                    Quyền hiện đang được xác định bởi role gán trên server. Việc đổi persona chỉ ảnh hưởng đến tên hiển thị, không mở khóa quyền truy cập.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {staffUsers.map((staff) => {
                  const cfg = ROLE_CONFIGS[staff.role];
                  const isCurrent = staff.id === activeStaff.id;

                  return (
                    <button
                      key={staff.id}
                      onClick={() => {
                        if (hasServerRole) return;
                        setActiveStaffId(staff.id);
                        setSuccessNotice(`Đã chuyển sang: ${staff.name} (${cfg.label})`);
                        setTimeout(() => setSuccessNotice(null), 2500);
                      }}
                      disabled={hasServerRole}
                      title={hasServerRole ? 'Đã khóa vì quyền được xác định bởi role từ server' : undefined}
                      className={`text-left p-3 rounded-xl border transition flex items-start gap-3 relative ${
                        isCurrent
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500'
                          : hasServerRole
                            ? 'border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed'
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
          {/* TAB 4: ACCESS CONTROL (ADMIN) */}
          {activeTab === 'roles' && isAdmin && (
            <div className="space-y-4">
              {/* P3: shareable invite link — the join path for new people. */}
              {tenancyMode === 'tenancy' && currentShop && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-emerald-900">Mã mời tham gia cửa hàng</p>
                    <p className="text-[11px] text-emerald-700">
                      Người mới nhập mã này rồi chờ bạn duyệt ở danh sách dưới đây.
                    </p>
                  </div>
                  <span className="text-sm font-black tracking-[0.2em] text-emerald-800 bg-white border border-emerald-200 rounded-lg px-2.5 py-1">
                    {currentShop.inviteCode}
                  </span>
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-700" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {tenancyMode === 'tenancy'
                          ? 'Yêu cầu tham gia đang chờ'
                          : 'Yêu cầu phân quyền đang chờ'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {tenancyMode === 'tenancy'
                          ? 'Người dùng nhập mã mời của cửa hàng sẽ ở trạng thái chờ — duyệt để cấp quyền'
                          : 'Người dùng đăng nhập Google nhưng chưa được cấp quyền sẽ tự gửi yêu cầu'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={loadRoleData}
                    disabled={loadingRoles}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60"
                  >
                    Làm mới
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {loadingRoles && accessRequests.length === 0 && (
                    <p className="px-4 py-3 text-xs text-slate-500">Đang tải...</p>
                  )}
                  {!loadingRoles && accessRequests.length === 0 && (
                    <p className="px-4 py-3 text-xs text-slate-500">Không có yêu cầu nào đang chờ.</p>
                  )}
                  {accessRequests.map((req) => (
                    <div key={req.uid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{req.displayName}</p>
                        <p className="text-[11px] text-slate-500">{req.email || req.uid}</p>
                        <p className="text-[10px] text-slate-400">Gửi lúc: {req.requestedAt}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={approvingRequestUid === req.uid ? approveRole : 'CASHIER'}
                          onChange={(e) => {
                            setApprovingRequestUid(req.uid);
                            setApproveRole(e.target.value as UserRole);
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 rounded-lg"
                        >
                          {(Object.keys(ROLE_CONFIGS) as UserRole[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_CONFIGS[r].label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleApproveRequest(req)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => handleDismissRequest(req)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <KeyRound className="w-4 h-4 text-slate-700" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900">Vai trò đã gán</p>
                    <p className="text-[11px] text-slate-500">
                      {tenancyMode === 'tenancy'
                        ? `Lưu trong shops/${currentShop?.shopId ?? '{shopId}'}/members/{uid}. Thu hồi = xoá tài liệu.`
                        : 'Lưu trong staffRoles/{uid}. Thu hồi = xoá tài liệu.'}
                    </p>
                  </div>
                  {roleAssignments.length > 0 && (
                    <div className="flex items-center gap-2">
                      <input
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        placeholder="Tìm theo tên/email..."
                        className="px-2 py-1 text-[11px] border border-slate-300 rounded-lg w-36 sm:w-48"
                      />
                      <select
                        value={roleSort}
                        onChange={(e) => setRoleSort(e.target.value as 'name' | 'role' | 'email')}
                        className="px-2 py-1 text-[11px] border border-slate-300 rounded-lg"
                      >
                        <option value="name">Sắp xếp: Tên</option>
                        <option value="role">Sắp xếp: Vai trò</option>
                        <option value="email">Sắp xếp: Email</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {!loadingRoles && roleAssignments.length === 0 && (
                    <p className="px-4 py-3 text-xs text-slate-500">Chưa gán vai trò nào.</p>
                  )}
                  {!loadingRoles && roleAssignments.length > 0 && filteredAssignments.length === 0 && (
                    <p className="px-4 py-3 text-xs text-slate-500">Không tìm thấy kết quả phù hợp.</p>
                  )}
                  {filteredAssignments.map((assignment) => (
                    <div key={assignment.uid} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{assignment.displayName}</p>
                        <p className="text-[11px] text-slate-500">{assignment.email || assignment.uid}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_CONFIGS[assignment.role].badgeClass}`}>
                          {ROLE_CONFIGS[assignment.role].label}
                        </span>
                        <button
                          onClick={() => handleRevokeRole(assignment)}
                          disabled={assignment.uid === firebaseUser?.uid}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Thu hồi
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
