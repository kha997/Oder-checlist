import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { Product } from '../types';
import {
  ArrowLeft,
  Boxes,
  Plus,
  PlusCircle,
  History,
  Edit2,
  Check,
  AlertTriangle,
  TrendingDown,
  PackageCheck,
  X,
} from 'lucide-react';

export const InventoryScreen: React.FC = () => {
  const { products, addProduct, updateProduct, addStockReceived, stockLogs, setCurrentScreen } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState<Product | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // New product form
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newInitialStock, setNewInitialStock] = useState('50');
  const [newUnit, setNewUnit] = useState('Phần');

  // Restock form
  const [restockAmount, setRestockAmount] = useState('10');
  const [restockNote, setRestockNote] = useState('');

  // Edit form
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editInitialStock, setEditInitialStock] = useState('');
  const [editUnit, setEditUnit] = useState('');

  const totalCurrentStock = products.reduce((sum, p) => sum + Math.max(0, p.currentStock), 0);
  const totalSold = products.reduce((sum, p) => sum + p.quantitySold, 0);

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPrice) return;
    addProduct({
      name: newName.trim(),
      price: parseFloat(newPrice) || 0,
      initialStock: parseInt(newInitialStock, 10) || 0,
      stockReceived: 0,
      unit: newUnit.trim() || 'Phần',
    });
    setNewName('');
    setNewPrice('');
    setNewInitialStock('50');
    setShowAddModal(false);
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRestockModal) return;
    const amt = parseInt(restockAmount, 10);
    if (amt > 0) {
      addStockReceived(showRestockModal.id, amt, restockNote.trim() || 'Nhập thêm hàng');
    }
    setShowRestockModal(null);
    setRestockAmount('10');
    setRestockNote('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    updateProduct(showEditModal.id, {
      name: editName.trim(),
      price: parseFloat(editPrice) || 0,
      initialStock: parseInt(editInitialStock, 10) || 0,
      unit: editUnit.trim() || showEditModal.unit,
    });
    setShowEditModal(null);
  };

  const openEditModal = (p: Product) => {
    setShowEditModal(p);
    setEditName(p.name);
    setEditPrice(p.price.toString());
    setEditInitialStock(p.initialStock.toString());
    setEditUnit(p.unit);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentScreen('HOME')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>
        <div className="text-center">
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">
            KHO HÀNG & SẢN PHẨM
          </h2>
          <p className="text-[10px] text-slate-500 font-medium">Tồn đầu + Nhập thêm - Đã bán = Tồn kho</p>
        </div>
        <button
          onClick={() => setShowLogs(!showLogs)}
          className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
            showLogs ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200'
          }`}
          title="Lịch sử nhập kho"
        >
          <History className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-teal-700 rounded-2xl p-4 text-white shadow-sm">
          <div className="flex items-center gap-1.5 text-teal-200 text-xs font-bold">
            <Boxes className="w-4 h-4" />
            <span>Tổng tồn kho</span>
          </div>
          <p className="text-2xl font-black mt-1">{totalCurrentStock} món</p>
          <p className="text-[10px] text-teal-200 mt-0.5">{products.length} mặt hàng</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold">
            <TrendingDown className="w-4 h-4 text-emerald-600" />
            <span>Tổng đã bán</span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalSold} món</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Tự động trừ theo đơn hàng</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ THÊM SẢN PHẨM MỚI</span>
        </button>
      </div>

      {!showLogs ? (
        /* PRODUCT LIST WITH ALL INVENTORY COLUMNS */
        <div className="space-y-3">
          {products.map((prod) => {
            const isLowStock = prod.currentStock <= 5;
            return (
              <div
                key={prod.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-teal-400 transition-all space-y-3"
              >
                {/* Product Name & Price */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                      {prod.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-black text-teal-700">
                        {formatVND(prod.price)}
                      </span>
                      <span className="text-xs text-slate-500">/ {prod.unit}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(prod)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                      title="Sửa thông tin sản phẩm"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowRestockModal(prod)}
                      className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200 flex items-center gap-1 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nhập hàng</span>
                    </button>
                  </div>
                </div>

                {/* 4 Inventory Numbers Table */}
                <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold">Tồn đầu</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">{prod.initialStock}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-teal-700 font-semibold">Nhập thêm</p>
                    <p className="text-xs font-bold text-teal-800 mt-0.5">+{prod.stockReceived}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-rose-600 font-semibold">Đã bán</p>
                    <p className="text-xs font-bold text-rose-700 mt-0.5">-{prod.quantitySold}</p>
                  </div>
                  <div className={`rounded-lg py-0.5 ${isLowStock ? 'bg-amber-100 text-amber-900 font-black' : 'bg-teal-100 text-teal-900 font-black'}`}>
                    <p className="text-[10px] uppercase font-extrabold">TỒN KHO</p>
                    <p className="text-sm font-black mt-0.5">{prod.currentStock}</p>
                  </div>
                </div>

                {isLowStock && (
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Cảnh báo: Tồn kho sắp hết!</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* STOCK LOGS (NHẬP KHO) */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-600">
              Nhật ký nhập hàng ({stockLogs.length})
            </h3>
            <button
              onClick={() => setShowLogs(false)}
              className="text-xs text-teal-600 font-bold hover:underline"
            >
              ← Về danh sách tồn kho
            </button>
          </div>

          {stockLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-2xl p-3 border border-slate-200 flex items-center justify-between text-xs"
            >
              <div>
                <p className="font-bold text-slate-900">{log.productName}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{log.note || 'Nhập thêm'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Bởi: <strong>{log.addedBy || 'Chủ shop'}</strong> •{' '}
                  {new Date(log.date).toLocaleDateString('vi-VN')} {new Date(log.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl">
                  +{log.quantityAdded}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: ADD PRODUCT */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-base">Thêm Sản Phẩm Mới</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên món *</label>
                <input
                  type="text"
                  placeholder="e.g. Trà Sữa Trân Châu"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Giá bán (VNĐ) *</label>
                  <input
                    type="number"
                    placeholder="35000"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    placeholder="Ly, Phần, Hộp..."
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tồn kho ban đầu</label>
                <input
                  type="number"
                  value={newInitialStock}
                  onChange={(e) => setNewInitialStock(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-teal-600 rounded-xl"
                >
                  Lưu sản phẩm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESTOCK (NHẬP HÀNG) */}
      {showRestockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-base">Nhập thêm hàng vào kho</h3>
                <p className="text-xs text-teal-700 font-bold">{showRestockModal.name}</p>
              </div>
              <button onClick={() => setShowRestockModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRestockSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Số lượng nhập thêm *</label>
                <input
                  type="number"
                  min="1"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  className="w-full px-3 py-2 text-lg font-black text-center rounded-xl bg-slate-50 border border-slate-200"
                  required
                />
                <div className="flex gap-1.5 justify-center mt-2">
                  {[5, 10, 20, 50].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRestockAmount(num.toString())}
                      className="px-2.5 py-1 text-xs font-bold bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-700"
                    >
                      +{num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Ghi chú nhập</label>
                <input
                  type="text"
                  placeholder="e.g. Nhập đợt sáng, bổ sung tủ..."
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(null)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-teal-600 rounded-xl"
                >
                  Xác nhận nhập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PRODUCT */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-base">Sửa Thông Tin Sản Phẩm</h3>
              <button onClick={() => setShowEditModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên món</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Giá bán</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tồn kho ban đầu</label>
                <input
                  type="number"
                  value={editInitialStock}
                  onChange={(e) => setEditInitialStock(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-teal-600 rounded-xl"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
