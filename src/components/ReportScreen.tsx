import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { Order, getOrderCost, getOrderPrice, getOrderProfit } from '../types';
import {
  exportSalesOrdersCsv,
  exportInventoryCsv,
  exportConsolidatedReportCsv,
  exportCurrentOrderListCsv,
} from '../utils/csvExport';
import { removeVietnameseTones } from '../utils/searchHelper';
import { OrderDetailModal } from './OrderDetailModal';
import { ExportOrderReportModal, ExportDocumentType } from './ExportOrderReportModal';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  Banknote,
  Landmark,
  AlertCircle,
  Copy,
  Boxes,
  TrendingUp,
  Receipt,
  Share2,
  Download,
  FileSpreadsheet,
  FileDown,
  HardDrive,
  Sparkles,
  ShoppingBag,
  Calculator,
  ArrowRight,
  Search,
  X,
  Building2,
  MapPin,
  Clock,
  Rocket,
  Camera,
  ClipboardList,
  FileText,
  PiggyBank,
  Percent,
  Coins,
  ShieldCheck,
} from 'lucide-react';

export const ReportScreen: React.FC = () => {
  const { orders, products, setCurrentScreen } = useApp();

  const [dateFilter, setDateFilter] = useState<'today' | 'month' | 'all'>('today');
  const [copied, setCopied] = useState(false);
  const [monthlyCopied, setMonthlyCopied] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // PDF & Printable export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalDocType, setExportModalDocType] = useState<ExportDocumentType>('ACCOUNTING_REPORT');
  const [exportModalOrders, setExportModalOrders] = useState<Order[]>([]);
  const [exportModalTitle, setExportModalTitle] = useState<string>('Báo cáo Kế toán Tài chính');

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentMonthFormatted = String(currentMonth + 1).padStart(2, '0');
  const currentMonthLabel = `Tháng ${currentMonth + 1}/${currentYear}`;

  // Monthly Overview calculations (always calculated for the current month)
  const monthlyOrders = orders.filter((o) => {
    if (o.status !== 'ACTIVE') return false;
    const d = new Date(o.createdAt);
    return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const monthlyTotalRevenue = monthlyOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const monthlyOrderCount = monthlyOrders.length;
  const monthlyAOV = monthlyOrderCount > 0 ? Math.round(monthlyTotalRevenue / monthlyOrderCount) : 0;

  const monthlyPaidAmount = monthlyOrders
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + (o.paidAmount || o.totalAmount), 0);

  const monthlyUnpaidAmount = monthlyOrders
    .filter((o) => o.paymentStatus === 'UNPAID')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const monthlyPaidOrdersCount = monthlyOrders.filter((o) => o.paymentStatus === 'PAID').length;
  const monthlyUnpaidOrdersCount = monthlyOrders.filter((o) => o.paymentStatus === 'UNPAID').length;

  const monthlyTotalItems = monthlyOrders.reduce(
    (sum, o) => sum + o.items.reduce((iSum, item) => iSum + item.quantity, 0),
    0
  );

  const monthlyCollectionRate =
    monthlyTotalRevenue > 0 ? Math.round((monthlyPaidAmount / monthlyTotalRevenue) * 100) : 100;

  // Monthly Profit Metrics
  const monthlyTotalCost = monthlyOrders.reduce((sum, o) => sum + getOrderCost(o, products), 0);
  const monthlyGrossProfit = monthlyTotalRevenue - monthlyTotalCost;
  const monthlyProfitMargin =
    monthlyTotalRevenue > 0 ? Math.round((monthlyGrossProfit / monthlyTotalRevenue) * 100) : 0;

  // Filter orders by date for the rest of the report
  const filteredOrders = orders.filter((o) => {
    if (o.status !== 'ACTIVE') return false;
    if (dateFilter === 'today') {
      return o.createdAt.slice(0, 10) === todayStr;
    }
    if (dateFilter === 'month') {
      const d = new Date(o.createdAt);
      return !isNaN(d.getTime()) && d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }
    return true;
  });

  // Financial Calculations
  const numberOfOrders = filteredOrders.length;
  const totalSales = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Profit & Cost Calculations
  const totalPrice = filteredOrders.reduce((sum, o) => sum + getOrderPrice(o), 0);
  const totalCost = filteredOrders.reduce((sum, o) => sum + getOrderCost(o, products), 0);
  const grossProfit = totalPrice - totalCost;
  const profitMarginPercent = totalPrice > 0 ? (grossProfit / totalPrice) * 100 : 0;
  const avgProfitPerOrder = numberOfOrders > 0 ? Math.round(grossProfit / numberOfOrders) : 0;
  const avgCostPerOrder = numberOfOrders > 0 ? Math.round(totalCost / numberOfOrders) : 0;

  // Cash realized vs Unrealized Profit
  const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'PAID');
  const paidRevenue = paidOrders.reduce((sum, o) => sum + (o.paidAmount || getOrderPrice(o)), 0);
  const paidCost = paidOrders.reduce((sum, o) => sum + getOrderCost(o, products), 0);
  const realizedProfit = paidRevenue - paidCost;

  const unpaidOrders = filteredOrders.filter((o) => o.paymentStatus === 'UNPAID');
  const unpaidRevenue = unpaidOrders.reduce((sum, o) => sum + getOrderPrice(o), 0);
  const unpaidCost = unpaidOrders.reduce((sum, o) => sum + getOrderCost(o, products), 0);
  const pendingProfit = unpaidRevenue - unpaidCost;

  // Cash received
  const cashReceived = filteredOrders
    .filter((o) => o.paymentStatus === 'PAID' && o.paymentMethod === 'CASH')
    .reduce((sum, o) => sum + (o.paidAmount || o.totalAmount), 0);

  // Bank transfer received
  const bankReceived = filteredOrders
    .filter((o) => o.paymentStatus === 'PAID' && o.paymentMethod === 'BANK_TRANSFER')
    .reduce((sum, o) => sum + (o.paidAmount || o.totalAmount), 0);

  // Total collected
  const amountCollected = cashReceived + bankReceived;

  // Unpaid amount
  const unpaidAmount = filteredOrders
    .filter((o) => o.paymentStatus === 'UNPAID')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  // Mathematical Reconciliation Check
  const sumFormula = cashReceived + bankReceived + unpaidAmount;
  const isReconciled = sumFormula === totalSales;

  // Quantity sold by product in filtered orders
  const productSalesMap: Record<string, { quantity: number; revenue: number }> = {};
  for (const ord of filteredOrders) {
    for (const item of ord.items) {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = { quantity: 0, revenue: 0 };
      }
      productSalesMap[item.productId].quantity += item.quantity;
      productSalesMap[item.productId].revenue += item.lineTotal;
    }
  }

  // Product profit items ranking
  const productProfitList = useMemo(() => {
    return products
      .map((p) => {
        const sold = productSalesMap[p.id] || { quantity: 0, revenue: 0 };
        const unitCost = p.cost !== undefined ? p.cost : Math.round(p.price * 0.45);
        const totalProductCost = sold.quantity * unitCost;
        const profit = sold.revenue - totalProductCost;
        const margin = sold.revenue > 0 ? (profit / sold.revenue) * 100 : 0;
        return {
          product: p,
          quantity: sold.quantity,
          revenue: sold.revenue,
          cost: totalProductCost,
          unitCost,
          profit,
          margin,
        };
      })
      .filter((item) => item.quantity > 0)
      .sort((a, b) => b.profit - a.profit);
  }, [products, productSalesMap]);

  const periodLabel =
    dateFilter === 'today'
      ? `Hôm nay (${todayStr})`
      : dateFilter === 'month'
      ? `Tháng này (${currentMonthLabel})`
      : 'Toàn bộ thời gian (Tất cả)';

  const notifyExport = (msg: string) => {
    setExportNotice(msg);
    setTimeout(() => {
      setExportNotice(null);
    }, 4000);
  };

  // Order list search and filter state within report
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | 'PENDING' | 'READY' | 'DELIVERED' | 'UNPAID' | 'PAID'>('ALL');
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);

  // Filtered orders for display and export in the Current Order List section
  const displayedOrders = useMemo(() => {
    return filteredOrders.filter((order) => {
      // 1. Status Filter
      if (orderStatusFilter === 'PENDING' && order.deliveryStatus !== 'PENDING') return false;
      if (orderStatusFilter === 'READY' && order.deliveryStatus !== 'READY_FOR_DELIVERY') return false;
      if (orderStatusFilter === 'DELIVERED' && order.deliveryStatus !== 'DELIVERED') return false;
      if (orderStatusFilter === 'UNPAID' && order.paymentStatus !== 'UNPAID') return false;
      if (orderStatusFilter === 'PAID' && order.paymentStatus !== 'PAID') return false;

      // 2. Search Term
      if (orderSearchTerm.trim()) {
        const q = orderSearchTerm.trim().toLowerCase();
        const cleanQ = removeVietnameseTones(q);
        const nameMatch =
          order.customerName.toLowerCase().includes(q) ||
          removeVietnameseTones(order.customerName).includes(cleanQ);
        const idMatch = order.id.toLowerCase().includes(q);
        const phoneMatch = (order.customerPhone || '').includes(q);
        const addrMatch =
          (order.location.formattedAddress || '').toLowerCase().includes(q) ||
          removeVietnameseTones(order.location.formattedAddress || '').includes(cleanQ);
        return nameMatch || idMatch || phoneMatch || addrMatch;
      }

      return true;
    });
  }, [filteredOrders, orderStatusFilter, orderSearchTerm]);

  const handleExportCurrentOrderList = (targetOrders?: Order[], customLabel?: string) => {
    const listToExport = targetOrders || displayedOrders;
    if (listToExport.length === 0) {
      notifyExport('Không có đơn hàng nào trong danh sách để xuất CSV.');
      return;
    }
    const label = customLabel || `${periodLabel} (${listToExport.length} đơn)`;
    exportCurrentOrderListCsv(listToExport, label, 'DanhSach_DonHang');
    notifyExport(`✓ Đã xuất thành công ${listToExport.length} đơn hàng ra file CSV!`);
  };

  const handleExportSales = () => {
    exportSalesOrdersCsv(filteredOrders, periodLabel);
    notifyExport(`Đã xuất ${filteredOrders.length} đơn hàng ra file CSV doanh số`);
  };

  const handleExportInventory = () => {
    exportInventoryCsv(products, productSalesMap, periodLabel);
    notifyExport(`Đã xuất báo cáo tồn kho ${products.length} sản phẩm ra file CSV`);
  };

  const handleExportConsolidated = () => {
    exportConsolidatedReportCsv(filteredOrders, products, productSalesMap, periodLabel);
    notifyExport(`Đã xuất toàn bộ báo cáo đối soát & dữ liệu kế toán ra CSV`);
  };

  const copySummaryText = () => {
    const periodHeader =
      dateFilter === 'today'
        ? 'HÔM NAY'
        : dateFilter === 'month'
        ? `THÁNG NÀY (${currentMonthLabel})`
        : 'TẤT CẢ';

    const summary = `📊 BÁO CÁO BÁN HÀNG & LỢI NHUẬN (${periodHeader})
-----------------------------
• Số đơn hàng: ${numberOfOrders} đơn
• Tổng doanh số (Giá bán): ${formatVND(totalPrice)}
• Tổng giá vốn (Chi phí): ${formatVND(totalCost)}
• LỢI NHUẬN GỘP: ${formatVND(grossProfit)} (${profitMarginPercent.toFixed(1)}%)
  - Lợi nhuận đã thực thu: ${formatVND(realizedProfit)}
  - Lợi nhuận đang chờ thu: ${formatVND(pendingProfit)}
  - Lợi nhuận bình quân/đơn: ${formatVND(avgProfitPerOrder)}
-----------------------------
• Tình hình thu tiền:
  - Đã thu tiền: ${formatVND(amountCollected)} [TM: ${formatVND(cashReceived)} | CK: ${formatVND(bankReceived)}]
  - Chưa thu (Nợ): ${formatVND(unpaidAmount)}
-----------------------------
✓ Đối soát tài chính: ${formatVND(totalSales)} = ${formatVND(cashReceived)} (TM) + ${formatVND(bankReceived)} (CK) + ${formatVND(unpaidAmount)} (Nợ)`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const copyMonthlyOverviewText = () => {
    const summary = `📅 TỔNG QUAN THÁNG NÀY (${currentMonthLabel})
-----------------------------
• Tổng doanh thu: ${formatVND(monthlyTotalRevenue)}
• Tổng giá vốn ước tính: ${formatVND(monthlyTotalCost)}
• Lợi nhuận gộp tháng: ${formatVND(monthlyGrossProfit)} (${monthlyProfitMargin}%)
• Số lượng đơn hàng: ${monthlyOrderCount} đơn
• Giá trị TB mỗi đơn (AOV): ${formatVND(monthlyAOV)}
• Đã thu: ${formatVND(monthlyPaidAmount)} (${monthlyPaidOrdersCount} đơn)
• Chưa thu (Nợ): ${formatVND(monthlyUnpaidAmount)} (${monthlyUnpaidOrdersCount} đơn)
• Tổng món xuất kho: ${monthlyTotalItems} món
• Tỷ lệ thu tiền: ${monthlyCollectionRate}%
-----------------------------
Oder Checklist - Quản lý đơn hàng & Tài chính`;

    navigator.clipboard.writeText(summary);
    setMonthlyCopied(true);
    setTimeout(() => setMonthlyCopied(false), 3000);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentScreen('HOME')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>
        <div className="text-center">
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">
            BÁO CÁO TÀI CHÍNH
          </h2>
          <p className="text-[10px] text-slate-500 font-medium">Đối soát chuẩn xác 100%</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setExportModalOrders(filteredOrders);
              setExportModalDocType('ACCOUNTING_REPORT');
              setExportModalTitle(`Báo cáo Tài chính - ${periodLabel}`);
              setIsExportModalOpen(true);
            }}
            className="py-1.5 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Xuất PDF hoặc In ấn Báo cáo Tài chính đối soát"
          >
            <FileDown className="w-4 h-4 text-rose-100" />
            <span className="hidden sm:inline">Xuất PDF / In</span>
          </button>
          <button
            onClick={() => handleExportCurrentOrderList(filteredOrders)}
            className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Xuất CSV danh sách đơn hàng hiện tại"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span className="hidden sm:inline">Xuất CSV Đơn ({filteredOrders.length})</span>
          </button>
          <button
            onClick={handleExportConsolidated}
            className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center gap-1 border border-emerald-200 shadow-sm transition"
            title="Xuất gói sao lưu kế toán CSV tổng hợp"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={copySummaryText}
            className="p-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold flex items-center gap-1 border border-purple-200 shadow-sm transition"
            title="Sao chép báo cáo"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {copied && (
        <div className="bg-emerald-600 text-white p-2.5 rounded-xl text-xs font-bold text-center animate-fadeIn shadow-md">
          ✓ Đã sao chép nội dung báo cáo vào bộ nhớ tạm!
        </div>
      )}

      {monthlyCopied && (
        <div className="bg-indigo-600 text-white p-2.5 rounded-xl text-xs font-bold text-center animate-fadeIn shadow-md">
          ✓ Đã sao chép tổng quan số liệu Tháng này ({currentMonthLabel})!
        </div>
      )}

      {exportNotice && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-md animate-fadeIn">
          <FileSpreadsheet className="w-5 h-5 shrink-0 text-emerald-200" />
          <div className="flex-1">
            <p className="font-extrabold">{exportNotice}</p>
            <p className="text-[11px] font-normal text-emerald-100">
              File UTF-8 BOM sẵn sàng mở trực tiếp trên Excel, Google Sheets mà không lỗi font tiếng Việt.
            </p>
          </div>
        </div>
      )}

      {/* Date Filter Pills */}
      <div className="flex gap-1.5 p-1 bg-slate-200/80 rounded-2xl">
        <button
          onClick={() => setDateFilter('today')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition ${
            dateFilter === 'today'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Hôm nay (Today)
        </button>
        <button
          onClick={() => setDateFilter('month')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition ${
            dateFilter === 'month'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Tháng này (Month)
        </button>
        <button
          onClick={() => setDateFilter('all')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition ${
            dateFilter === 'all'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Toàn bộ thời gian (All)
        </button>
      </div>

      {/* SECTION: TỔNG QUAN THÁNG NÀY (MONTHLY OVERVIEW) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shadow-xs shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-black uppercase text-slate-800 tracking-wide">
                  TỔNG QUAN THÁNG NÀY
                </h3>
                <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  Monthly Overview
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                {currentMonthLabel} (Từ ngày 01/{currentMonthFormatted} đến hiện tại)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={copyMonthlyOverviewText}
              className="p-2 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition border border-slate-200 hover:border-indigo-200"
              title="Sao chép số liệu tổng quan tháng này"
            >
              {monthlyCopied ? (
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* 3 Core Highlight KPI Cards: Total Revenue, Order Count, Average Order Value (AOV) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* 1. Total Revenue for the Month */}
          <div className="bg-gradient-to-br from-indigo-50/90 to-purple-50/90 rounded-2xl p-3.5 border border-indigo-100/90 flex flex-col justify-between">
            <div className="flex items-center justify-between text-indigo-800">
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                Tổng doanh thu tháng
              </span>
              <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />
            </div>
            <div className="my-2">
              <p className="text-xl sm:text-2xl font-black text-indigo-950 font-mono tracking-tight">
                {formatVND(monthlyTotalRevenue)}
              </p>
            </div>
            <p className="text-[10px] text-indigo-700/80 font-medium flex items-center justify-between">
              <span>Doanh số {currentMonthLabel}</span>
              <span className="font-bold">{monthlyOrderCount} đơn phát sinh</span>
            </p>
          </div>

          {/* 2. Order Count for the Month */}
          <div className="bg-gradient-to-br from-blue-50/90 to-cyan-50/90 rounded-2xl p-3.5 border border-blue-100/90 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-800">
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                Số lượng đơn hàng
              </span>
              <ShoppingBag className="w-4 h-4 text-blue-600 shrink-0" />
            </div>
            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-blue-950 font-mono">
                {monthlyOrderCount}
              </span>
              <span className="text-xs font-bold text-blue-700">đơn hàng</span>
            </div>
            <p className="text-[10px] text-blue-700/80 font-medium flex items-center justify-between">
              <span>Tổng lượng món bán</span>
              <span className="font-bold">{monthlyTotalItems} sản phẩm</span>
            </p>
          </div>

          {/* 3. Average Order Value (AOV) for the Month */}
          <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/90 rounded-2xl p-3.5 border border-emerald-100/90 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                Giá trị TB / đơn (AOV)
              </span>
              <Calculator className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <div className="my-2">
              <p className="text-xl sm:text-2xl font-black text-emerald-950 font-mono tracking-tight">
                {formatVND(monthlyAOV)}
              </p>
            </div>
            <p className="text-[10px] text-emerald-700/80 font-medium flex items-center justify-between">
              <span>Doanh thu bình quân</span>
              <span className="font-bold">AOV chuẩn</span>
            </p>
          </div>
        </div>

        {/* Monthly Financial Progress & Collection Status */}
        <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700">Tiến độ thu tiền trong tháng:</span>
            <span className="font-black text-emerald-700">{monthlyCollectionRate}% Đã thu</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, monthlyCollectionRate)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
            <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/60">
              <span className="text-slate-500">Đã thu:</span>
              <span className="font-extrabold text-emerald-700 font-mono">
                {formatVND(monthlyPaidAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/60">
              <span className="text-slate-500">Còn nợ:</span>
              <span className={`font-extrabold font-mono ${monthlyUnpaidAmount > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                {formatVND(monthlyUnpaidAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Filter Trigger for Seller */}
        {dateFilter !== 'month' && (
          <button
            onClick={() => setDateFilter('month')}
            className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.99] border border-indigo-200"
          >
            <span>Xem chi tiết danh sách đơn & đối soát cho kỳ {currentMonthLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Total Sales Banner */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-800 rounded-3xl p-5 text-white shadow-lg shadow-purple-800/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-purple-200 text-xs font-bold uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            <span>TỔNG DOANH SỐ (TOTAL SALES)</span>
          </div>
          <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
            {numberOfOrders} đơn hàng
          </span>
        </div>
        <p className="text-3xl font-black tracking-tight mt-2">{formatVND(totalSales)}</p>
        <div className="flex items-center justify-between text-xs text-purple-200 mt-2 pt-2 border-t border-purple-600/60">
          <span>Đã thu: <strong>{formatVND(amountCollected)}</strong></span>
          <span>Chưa thu: <strong>{formatVND(unpaidAmount)}</strong></span>
        </div>
      </div>

      {/* MANDATORY FINANCIAL RECONCILIATION CARD (REQUIREMENT 8) */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-700">
            <Receipt className="w-4 h-4 text-purple-600" />
            <span>KHỚP TOÁN TÀI CHÍNH (RECONCILIATION)</span>
          </div>
          {isReconciled ? (
            <span className="text-[11px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Khớp 100%</span>
            </span>
          ) : (
            <span className="text-[11px] font-black bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full">
              Lệch số
            </span>
          )}
        </div>

        {/* Formula breakdown */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-mono space-y-2">
          <div className="flex justify-between items-center text-slate-800 font-bold border-b border-slate-200 pb-1.5">
            <span>TỔNG DOANH SỐ (TOTAL SALES)</span>
            <span className="text-sm font-black text-purple-700">{formatVND(totalSales)}</span>
          </div>

          <div className="flex justify-between items-center text-emerald-700 font-semibold pl-2">
            <span>= Tiền mặt (Cash)</span>
            <span className="font-bold">{formatVND(cashReceived)}</span>
          </div>

          <div className="flex justify-between items-center text-blue-700 font-semibold pl-2">
            <span>+ Chuyển khoản (Bank Transfer)</span>
            <span className="font-bold">{formatVND(bankReceived)}</span>
          </div>

          <div className="flex justify-between items-center text-amber-700 font-semibold pl-2">
            <span>+ Chưa thu tiền (Unpaid)</span>
            <span className="font-bold">{formatVND(unpaidAmount)}</span>
          </div>

          <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 font-sans flex items-center justify-between">
            <span>Tổng vế phải ({formatVND(cashReceived)} + {formatVND(bankReceived)} + {formatVND(unpaidAmount)})</span>
            <span className="font-black text-slate-800">{formatVND(sumFormula)}</span>
          </div>
        </div>
      </div>

      {/* 4 DETAIL STAT TILES */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Cash tile */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
            <Banknote className="w-3.5 h-3.5" />
            <span>Tiền mặt đã thu</span>
          </div>
          <p className="text-lg font-black text-slate-900 mt-1">{formatVND(cashReceived)}</p>
          <p className="text-[10px] text-slate-400">
            {filteredOrders.filter((o) => o.paymentMethod === 'CASH').length} đơn thanh toán
          </p>
        </div>

        {/* Bank transfer tile */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1 text-[11px] font-bold text-blue-700">
            <Landmark className="w-3.5 h-3.5" />
            <span>Chuyển khoản đã thu</span>
          </div>
          <p className="text-lg font-black text-slate-900 mt-1">{formatVND(bankReceived)}</p>
          <p className="text-[10px] text-slate-400">
            {filteredOrders.filter((o) => o.paymentMethod === 'BANK_TRANSFER').length} đơn chuyển khoản
          </p>
        </div>

        {/* Total collected tile */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tổng tiền đã thu</span>
          </div>
          <p className="text-lg font-black text-slate-900 mt-1">{formatVND(amountCollected)}</p>
          <p className="text-[10px] text-slate-400">Tiền mặt + Chuyển khoản</p>
        </div>

        {/* Unpaid tile */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Tiền chưa thu (Nợ)</span>
          </div>
          <p className="text-lg font-black text-rose-600 mt-1">{formatVND(unpaidAmount)}</p>
          <p className="text-[10px] text-slate-400">
            {filteredOrders.filter((o) => o.paymentStatus === 'UNPAID').length} đơn chưa thu
          </p>
        </div>
      </div>

      {/* PROFIT SUMMARY CARD (BÁO CÁO LỢI NHUẬN & GIÁ VỐN) */}
      <div className="bg-gradient-to-br from-white via-emerald-50/25 to-teal-50/30 rounded-3xl p-4 sm:p-5 shadow-sm border border-emerald-200/90 space-y-4">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-700/20 shrink-0">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black uppercase text-slate-800 tracking-wide">
                  TỔNG KẾT LỢI NHUẬN & GIÁ VỐN (PROFIT SUMMARY)
                </h3>
                <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  {periodLabel}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                Theo dõi chi phí giá vốn (Cost), doanh số (Price) & biên lợi nhuận kinh doanh thực tế
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-black shadow-xs flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-200" />
              <span>+{formatVND(grossProfit)}</span>
            </div>
            <div className="bg-emerald-100/90 border border-emerald-300 text-emerald-800 px-2.5 py-1.5 rounded-xl text-xs font-black">
              {profitMarginPercent.toFixed(1)}% Biên LN
            </div>
          </div>
        </div>

        {/* 4 Core Profit & Margin KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Total Price / Revenue */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                Tổng doanh số (Price)
              </span>
              <Coins className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            </div>
            <p className="text-lg sm:text-xl font-black text-slate-900 font-mono my-1.5 tracking-tight">
              {formatVND(totalPrice)}
            </p>
            <p className="text-[10px] text-slate-500 flex items-center justify-between">
              <span>{numberOfOrders} đơn hàng</span>
              <span className="font-semibold text-purple-700">100% DT</span>
            </p>
          </div>

          {/* 2. Total Cost / COGS */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                Tổng giá vốn (Cost)
              </span>
              <Receipt className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            </div>
            <p className="text-lg sm:text-xl font-black text-amber-900 font-mono my-1.5 tracking-tight">
              {formatVND(totalCost)}
            </p>
            <p className="text-[10px] text-slate-500 flex items-center justify-between">
              <span>Giá vốn xuất kho</span>
              <span className="font-bold text-amber-700">
                {totalPrice > 0 ? ((totalCost / totalPrice) * 100).toFixed(1) : 0}% DT
              </span>
            </p>
          </div>

          {/* 3. Gross Profit */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-2xl p-3 border border-emerald-300 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                Lợi nhuận gộp (Profit)
              </span>
              <PiggyBank className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </div>
            <p className="text-lg sm:text-xl font-black text-emerald-700 font-mono my-1.5 tracking-tight">
              {formatVND(grossProfit)}
            </p>
            <p className="text-[10px] text-emerald-800/80 font-medium flex items-center justify-between">
              <span>Doanh thu - Giá vốn</span>
              <span className="font-bold text-emerald-700">+{formatVND(grossProfit)}</span>
            </p>
          </div>

          {/* 4. Profit Margin % */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[11px] font-extrabold uppercase tracking-wide">
                Tỷ suất lợi nhuận
              </span>
              <Percent className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            </div>
            <div className="my-1.5 flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-black text-teal-800 font-mono tracking-tight">
                {profitMarginPercent.toFixed(1)}%
              </span>
            </div>
            <p className="text-[10px] font-bold text-teal-700 flex items-center justify-between">
              <span>Đánh giá biên LN</span>
              <span className="bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-extrabold">
                {profitMarginPercent >= 45 ? 'Rất tốt' : profitMarginPercent >= 30 ? 'Tốt' : 'Ổn định'}
              </span>
            </p>
          </div>
        </div>

        {/* Visual Profit & Cost Composition Gauge Bar */}
        <div className="bg-white/90 p-3 rounded-2xl border border-emerald-200/80 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cơ cấu Doanh số (Cost vs Profit Ratio):</span>
            </span>
            <span className="font-mono text-slate-600 font-semibold text-[10px]">
              Giá bán ({formatVND(totalPrice)}) = Giá vốn ({formatVND(totalCost)}) + Lợi nhuận ({formatVND(grossProfit)})
            </span>
          </div>

          {/* Split Ratio Bar */}
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex shadow-inner">
            <div
              className="bg-amber-400 h-full transition-all duration-500"
              style={{ width: `${totalPrice > 0 ? (totalCost / totalPrice) * 100 : 45}%` }}
              title={`Giá vốn: ${formatVND(totalCost)}`}
            />
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${totalPrice > 0 ? (grossProfit / totalPrice) * 100 : 55}%` }}
              title={`Lợi nhuận: ${formatVND(grossProfit)}`}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>Giá vốn hàng bán: <strong>{totalPrice > 0 ? ((totalCost / totalPrice) * 100).toFixed(1) : 0}%</strong> ({formatVND(totalCost)})</span>
            </span>
            <span className="flex items-center gap-1 font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Lợi nhuận gộp: <strong>{profitMarginPercent.toFixed(1)}%</strong> ({formatVND(grossProfit)})</span>
            </span>
          </div>
        </div>

        {/* Realized Cash Profit vs Unrealized Debt Profit Sub-grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Realized Cash Profit */}
          <div className="bg-emerald-50/80 rounded-2xl p-3 border border-emerald-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-900">
              <span className="text-[11px] font-bold uppercase">Lợi nhuận đã thực thu</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-base font-black text-emerald-800 font-mono my-1">
              {formatVND(realizedProfit)}
            </p>
            <p className="text-[10px] text-emerald-700">
              Thu từ {paidOrders.length} đơn đã thanh toán xong
            </p>
          </div>

          {/* Unrealized Pending Profit */}
          <div className="bg-amber-50/80 rounded-2xl p-3 border border-amber-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-900">
              <span className="text-[11px] font-bold uppercase">Lợi nhuận đang chờ thu</span>
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="text-base font-black text-amber-900 font-mono my-1">
              {formatVND(pendingProfit)}
            </p>
            <p className="text-[10px] text-amber-700">
              Nằm trong {unpaidOrders.length} đơn chưa thu tiền (công nợ)
            </p>
          </div>

          {/* Average Profit per Order */}
          <div className="bg-indigo-50/80 rounded-2xl p-3 border border-indigo-200 flex flex-col justify-between">
            <div className="flex items-center justify-between text-indigo-900">
              <span className="text-[11px] font-bold uppercase">Lợi nhuận TB / Đơn</span>
              <Calculator className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-base font-black text-indigo-950 font-mono my-1">
              {formatVND(avgProfitPerOrder)}
            </p>
            <p className="text-[10px] text-indigo-700">
              Giá vốn TB: {formatVND(avgCostPerOrder)}/đơn
            </p>
          </div>
        </div>

        {/* Top Profitable Products Breakdown within the Card */}
        {productProfitList.length > 0 && (
          <div className="pt-1 border-t border-emerald-100">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Chi tiết lợi nhuận theo từng món ({productProfitList.length} món đã bán):</span>
              </span>
              <span className="text-[10px] text-slate-400">Giá vốn • Doanh thu • Lãi gộp</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {productProfitList.map(({ product, quantity, revenue, cost, profit, margin }) => (
                <div
                  key={product.id}
                  className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-900 truncate">{product.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Đã bán: <strong className="text-slate-800">{quantity} {product.unit}</strong> • Vốn: {formatVND(cost)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-black text-emerald-700 text-xs">
                      +{formatVND(profit)}
                    </p>
                    <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full inline-block">
                      {margin}% LN
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION: DANH SÁCH ĐƠN HÀNG HIỆN TẠI & XUẤT CSV (CURRENT ORDER LIST) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-3.5">
        {/* Section Header with Direct CSV Export Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs shrink-0">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black uppercase text-slate-800 tracking-wide">
                  DANH SÁCH ĐƠN HÀNG ({periodLabel})
                </h3>
                <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  {filteredOrders.length} đơn
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                Tra cứu, đối soát chi tiết & xuất file CSV quản lý dữ liệu
              </p>
            </div>
          </div>

          {/* Export Buttons for Current Order List */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => {
                setExportModalOrders(displayedOrders);
                setExportModalDocType('ACCOUNTING_REPORT');
                setExportModalTitle(`Danh sách đơn hàng (${displayedOrders.length} đơn - ${periodLabel})`);
                setIsExportModalOpen(true);
              }}
              disabled={displayedOrders.length === 0}
              className={`w-full sm:w-auto py-2.5 px-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition active:scale-95 ${
                displayedOrders.length > 0
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-700/20'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
              title="Xuất PDF hoặc In danh sách đơn hàng đang hiển thị"
            >
              <FileDown className="w-4 h-4 text-rose-100" />
              <span>XUẤT PDF / IN ({displayedOrders.length})</span>
            </button>
            <button
              onClick={() => handleExportCurrentOrderList(displayedOrders)}
              disabled={displayedOrders.length === 0}
              className={`w-full sm:w-auto py-2.5 px-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition active:scale-95 ${
                displayedOrders.length > 0
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white shadow-emerald-700/20'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
              title="Xuất danh sách đơn hàng đang hiển thị ra file CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>XUẤT CSV</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar within Report */}
        <div className="space-y-2">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Lọc nhanh tên khách, số ĐT, mã đơn, căn hộ..."
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-800 placeholder:text-slate-400 transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            {orderSearchTerm && (
              <button
                onClick={() => setOrderSearchTerm('')}
                className="absolute right-2 top-2 p-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 transition"
                title="Xóa lọc"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Status Filter Chips */}
          <div className="flex flex-wrap gap-1.5 text-xs font-bold">
            <button
              onClick={() => setOrderStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition ${
                orderStatusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({filteredOrders.length})
            </button>
            <button
              onClick={() => setOrderStatusFilter('PENDING')}
              className={`px-2.5 py-1 rounded-lg transition ${
                orderStatusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Chờ giao ({filteredOrders.filter((o) => o.deliveryStatus === 'PENDING').length})
            </button>
            <button
              onClick={() => setOrderStatusFilter('READY')}
              className={`px-2.5 py-1 rounded-lg transition ${
                orderStatusFilter === 'READY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Sẵn sàng ({filteredOrders.filter((o) => o.deliveryStatus === 'READY_FOR_DELIVERY').length})
            </button>
            <button
              onClick={() => setOrderStatusFilter('DELIVERED')}
              className={`px-2.5 py-1 rounded-lg transition ${
                orderStatusFilter === 'DELIVERED'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              Đã giao ({filteredOrders.filter((o) => o.deliveryStatus === 'DELIVERED').length})
            </button>
            <button
              onClick={() => setOrderStatusFilter('UNPAID')}
              className={`px-2.5 py-1 rounded-lg transition ${
                orderStatusFilter === 'UNPAID'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              Chưa thu ({filteredOrders.filter((o) => o.paymentStatus === 'UNPAID').length})
            </button>
            <button
              onClick={() => setOrderStatusFilter('PAID')}
              className={`px-2.5 py-1 rounded-lg transition ${
                orderStatusFilter === 'PAID'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
              }`}
            >
              Đã thu ({filteredOrders.filter((o) => o.paymentStatus === 'PAID').length})
            </button>
          </div>
        </div>

        {/* Orders Card / List View */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {displayedOrders.length === 0 ? (
            <div className="py-8 px-4 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
              <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                Không có đơn hàng nào khớp với điều kiện lọc hiện tại.
              </p>
              <button
                onClick={() => {
                  setOrderSearchTerm('');
                  setOrderStatusFilter('ALL');
                }}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : (
            displayedOrders.map((order) => {
              const isDelivered = order.deliveryStatus === 'DELIVERED';
              const isReady = order.deliveryStatus === 'READY_FOR_DELIVERY';
              const isPaid = order.paymentStatus === 'PAID';

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderForModal(order)}
                  className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition cursor-pointer active:scale-[0.99] group space-y-1.5"
                >
                  {/* Top line: ID, Priority, Date, Status Badges */}
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                        {order.id}
                      </span>
                      {order.priority && (
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                            order.priority === 'HIGH'
                              ? 'bg-rose-100 text-rose-800'
                              : order.priority === 'LOW'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.priority === 'HIGH' ? 'Cao' : order.priority === 'LOW' ? 'Thấp' : 'TB'}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-black">
                      <span
                        className={`px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                          isDelivered
                            ? 'bg-blue-100 text-blue-800'
                            : isReady
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isDelivered ? 'Đã giao' : isReady ? 'Sẵn sàng' : 'Chờ giao'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md ${
                          isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isPaid ? 'Đã thu' : 'Chưa thu'}
                      </span>
                    </div>
                  </div>

                  {/* Customer, Address & Total Amount */}
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <p className="font-extrabold text-slate-900 group-hover:text-emerald-800 transition">
                        {order.customerName}
                        {order.customerPhone && (
                          <span className="text-slate-500 font-normal ml-1">
                            ({order.customerPhone})
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-0.5">
                        {order.location.type === 'condo' ? (
                          <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        ) : (
                          <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                        )}
                        <span className="font-semibold">{order.location.formattedAddress}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-slate-900 text-sm font-mono block">
                        {formatVND(order.totalAmount)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {order.items.reduce((s, i) => s + i.quantity, 0)} phần món
                      </span>
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span className="truncate max-w-[260px] sm:max-w-md">
                      {order.items.map((i) => `${i.productName} x${i.quantity}`).join(', ')}
                    </span>
                    {order.receiptImageUrl && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                        <Camera className="w-3 h-3 text-indigo-600" />
                        <span>Biên nhận</span>
                      </span>
                    )}
                  </div>

                  {/* Delivery note if present */}
                  {(order.deliveryNote || order.note || order.location?.deliveryNote) && (
                    <div className="flex items-start gap-1.5 text-[11px] text-amber-900 bg-amber-50/80 px-2 py-1 rounded-lg border border-amber-200/60">
                      <FileText className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                      <span className="truncate">
                        Ghi chú: <strong>{order.deliveryNote || order.note || order.location?.deliveryNote}</strong>
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Section Bottom Summary & Full Export Button */}
        {displayedOrders.length > 0 && (
          <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="text-xs text-slate-600 font-medium">
              Đang xem <strong>{displayedOrders.length}</strong> / <strong>{filteredOrders.length}</strong> đơn trong kỳ • Doanh số:{' '}
              <strong className="text-emerald-700 font-mono font-bold">
                {formatVND(displayedOrders.reduce((s, o) => s + o.totalAmount, 0))}
              </strong>
            </div>

            <button
              onClick={() => handleExportCurrentOrderList(displayedOrders)}
              className="w-full sm:w-auto py-2 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98]"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Tải file CSV ({displayedOrders.length} đơn)</span>
            </button>
          </div>
        )}
      </div>

      {/* CSV EXPORT FOR ACCOUNTING & BACKUP */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-800">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>XUẤT DỮ LIỆU CSV (BACKUP & KẾ TOÁN)</span>
          </div>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>UTF-8 BOM (Mở Excel không lỗi font)</span>
          </span>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Xuất dữ liệu theo kỳ đang chọn (<strong>{periodLabel}</strong>) sang định dạng CSV tiêu chuẩn để lưu trữ sao lưu, nhập vào Excel, Google Sheets hoặc gửi cho bộ phận kế toán.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {/* Export Sales & Orders */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-purple-300 transition flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-purple-600" />
                  Báo cáo Đơn & Doanh số
                </span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded">
                  {filteredOrders.length} đơn
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Chi tiết từng đơn, khách hàng, món đặt, tiền thu (TM/CK), nợ và ghi chú nội bộ.
              </p>
            </div>
            <button
              onClick={handleExportSales}
              className="w-full py-2 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-[0.98]"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Tải CSV Doanh số ({filteredOrders.length})</span>
            </button>
          </div>

          {/* Export Inventory */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 transition flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                  Báo cáo Tồn kho & Món bán
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                  {products.length} món
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Bảng kê tồn đầu ngày, số lượng nhập thêm, đã bán và tồn kho hiện tại.
              </p>
            </div>
            <button
              onClick={handleExportInventory}
              className="w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-[0.98]"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Tải CSV Tồn kho ({products.length} món)</span>
            </button>
          </div>
        </div>

        {/* Master Consolidated Backup Button */}
        <div className="mt-2 p-3 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-emerald-50 border border-purple-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-purple-200 flex items-center justify-center text-purple-700 shadow-sm shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">
                Gói sao lưu Kế toán Tổng hợp (Full Backup CSV)
              </p>
              <p className="text-[10px] text-slate-600">
                Bao gồm Đối soát chuẩn + Báo cáo kho + Danh sách đơn chi tiết
              </p>
            </div>
          </div>
          <button
            onClick={handleExportConsolidated}
            className="shrink-0 py-2 px-3.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black flex items-center gap-1.5 shadow transition active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tải Báo Cáo Đầy Đủ</span>
          </button>
        </div>
      </div>

      {/* QUANTITY SOLD BY PRODUCT (REQUIREMENT 8) */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
            <Boxes className="w-4 h-4 text-purple-600" />
            <span>SỐ LƯỢNG ĐÃ BÁN THEO MÓN</span>
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            {products.length} sản phẩm
          </span>
        </div>

        <div className="space-y-2">
          {products.map((prod) => {
            const soldData = productSalesMap[prod.id] || { quantity: 0, revenue: 0 };
            return (
              <div
                key={prod.id}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{prod.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Đơn giá: {formatVND(prod.price)}/{prod.unit}
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="font-black text-purple-700 text-sm">
                      {soldData.quantity} {prod.unit}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({formatVND(soldData.revenue)})
                    </span>
                  </div>
                  <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.5 rounded font-semibold mt-1 inline-block">
                    Tồn kho hiện tại: {prod.currentStock}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Detail Inspection Modal */}
      <OrderDetailModal
        order={selectedOrderForModal}
        isOpen={!!selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
      />

      {/* PDF / Print / CSV Export Modal */}
      <ExportOrderReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        orders={exportModalOrders}
        products={products}
        title={exportModalTitle}
        periodLabel={periodLabel}
        defaultDocType={exportModalDocType}
      />
    </div>
  );
};
