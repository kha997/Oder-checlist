import React, { useState, useRef } from 'react';
import { Order, Product, OrderPriority } from '../types';
import { formatVND } from '../utils/storage';
import { exportElementToPdf, downloadHtmlReport } from '../utils/pdfExport';
import { exportCurrentOrderListCsv, exportSalesOrdersCsv, exportConsolidatedReportCsv } from '../utils/csvExport';
import {
  X,
  FileDown,
  Printer,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Loader2,
  Eye,
  Sliders,
  Share2,
} from 'lucide-react';

export type ExportDocumentType = 'ACCOUNTING_REPORT' | 'DELIVERY_MANIFEST' | 'ORDER_SUMMARY';

interface ExportOrderReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  products?: Product[];
  title?: string;
  periodLabel?: string;
  defaultDocType?: ExportDocumentType;
  currentUser?: string;
}

export const ExportOrderReportModal: React.FC<ExportOrderReportModalProps> = ({
  isOpen,
  onClose,
  orders,
  products = [],
  title = 'Báo cáo & Danh sách đơn hàng',
  periodLabel = 'Hôm nay',
  defaultDocType = 'ACCOUNTING_REPORT',
  currentUser = 'Quản lý',
}) => {
  const [docType, setDocType] = useState<ExportDocumentType>(defaultDocType);
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [showItemDetails, setShowItemDetails] = useState<boolean>(true);
  const [showNotes, setShowNotes] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportStep, setExportStep] = useState<string>('');
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Filter and sort orders
  const sortedOrders = [...orders].sort((a, b) => {
    // Sort high priority first, then by date or apartment
    if (docType === 'DELIVERY_MANIFEST') {
      const condoA = a.location.condoName || '';
      const condoB = b.location.condoName || '';
      if (condoA !== condoB) return condoA.localeCompare(condoB);
      const unitA = a.location.unit || '';
      const unitB = b.location.unit || '';
      return unitA.localeCompare(unitB);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Financial aggregates
  const totalOrders = sortedOrders.length;
  const totalSales = sortedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const cashReceived = sortedOrders
    .filter((o) => o.paymentStatus === 'PAID' && o.paymentMethod === 'CASH')
    .reduce((sum, o) => sum + (o.paidAmount || o.totalAmount), 0);
  const bankReceived = sortedOrders
    .filter((o) => o.paymentStatus === 'PAID' && o.paymentMethod === 'BANK_TRANSFER')
    .reduce((sum, o) => sum + (o.paidAmount || o.totalAmount), 0);
  const totalCollected = cashReceived + bankReceived;
  const totalUnpaid = sortedOrders
    .filter((o) => o.paymentStatus === 'UNPAID')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const deliveredCount = sortedOrders.filter((o) => o.deliveryStatus === 'DELIVERED').length;
  const pendingCount = sortedOrders.filter((o) => o.deliveryStatus !== 'DELIVERED').length;
  const paidCount = sortedOrders.filter((o) => o.paymentStatus === 'PAID').length;
  const unpaidCount = sortedOrders.filter((o) => o.paymentStatus === 'UNPAID').length;
  const highPriorityCount = sortedOrders.filter((o) => o.priority === 'HIGH').length;

  const collectionRate = totalSales > 0 ? Math.round((totalCollected / totalSales) * 100) : 100;
  const isReconciled = totalSales === cashReceived + bankReceived + totalUnpaid;

  const currentDateFormatted = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const fileSlug = `${docType === 'ACCOUNTING_REPORT' ? 'BaoCao_KeToan' : docType === 'DELIVERY_MANIFEST' ? 'BangKe_GiaoHang' : 'DanhSach_DonHang'}_${new Date().toISOString().slice(0, 10)}`;

  const showNotification = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  // Export handlers
  const handleExportPdf = async () => {
    if (!printAreaRef.current) return;
    setIsExportingPdf(true);
    setExportStep('Đang chuẩn bị trang in...');
    try {
      await exportElementToPdf(printAreaRef.current, `${fileSlug}.pdf`, (step) => setExportStep(step));
      showNotification('✓ Đã tải file PDF thành công!');
    } catch (err) {
      console.error(err);
      showNotification('Không thể tạo file PDF. Bạn có thể dùng tính năng "In / Lưu PDF" trực tiếp!');
    } finally {
      setIsExportingPdf(false);
      setExportStep('');
    }
  };

  const handlePrintBrowser = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (docType === 'ACCOUNTING_REPORT') {
      exportSalesOrdersCsv(sortedOrders, periodLabel);
      showNotification(`✓ Đã xuất ${sortedOrders.length} đơn sang file CSV kế toán!`);
    } else {
      exportCurrentOrderListCsv(sortedOrders, periodLabel, fileSlug);
      showNotification(`✓ Đã xuất ${sortedOrders.length} đơn hàng sang file CSV!`);
    }
  };

  const handleExportHtml = () => {
    if (!printAreaRef.current) return;
    downloadHtmlReport(
      `${fileSlug}.html`,
      title,
      printAreaRef.current.innerHTML
    );
    showNotification('✓ Đã tải file HTML lưu trữ đối soát!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 print-active-host">
      {/* Container */}
      <div className="bg-slate-50 w-full sm:max-w-4xl max-h-[95vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Top Header - No print */}
        <div className="no-print bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm">
              <FileDown className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-1.5">
                Xuất Báo cáo & Bảng kê In ấn (PDF / CSV)
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Kỳ: <span className="font-semibold text-slate-700">{periodLabel}</span> • {totalOrders} đơn hàng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Document Template Selector & Options - No print */}
        <div className="no-print bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Doc Type Pills */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setDocType('ACCOUNTING_REPORT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                docType === 'ACCOUNTING_REPORT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Bảng kê Kế toán</span>
            </button>
            <button
              onClick={() => setDocType('DELIVERY_MANIFEST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                docType === 'DELIVERY_MANIFEST'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Bảng lộ trình Giao hàng</span>
            </button>
            <button
              onClick={() => setDocType('ORDER_SUMMARY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                docType === 'ORDER_SUMMARY'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Danh sách Đơn tóm tắt</span>
            </button>
          </div>

          {/* Display toggles */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showItemDetails}
                onChange={(e) => setShowItemDetails(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Chi tiết món</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showNotes}
                onChange={(e) => setShowNotes(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Ghi chú</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Chữ ký kế toán</span>
            </label>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {feedbackNotice && (
          <div className="no-print bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 text-center transition animate-pulse">
            {feedbackNotice}
          </div>
        )}

        {/* Document Live Preview Container - Scrollable */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/70">
          {/* Printable Document Sheet (A4 Styled) */}
          <div
            ref={printAreaRef}
            id="printable-export-document"
            className="print-printable-sheet bg-white text-slate-900 rounded-lg shadow-md max-w-[210mm] mx-auto p-6 sm:p-8 text-xs font-sans leading-relaxed border border-slate-300 print:border-none print:shadow-none print:p-0"
          >
            {/* Header section */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                    {docType === 'ACCOUNTING_REPORT' && 'BẢNG KÊ DOANH THU & ĐỐI SOÁT TÀI CHÍNH KẾ TOÁN'}
                    {docType === 'DELIVERY_MANIFEST' && 'PHIẾU GIAO HÀNG & BẢNG KÊ LỘ TRÌNH VẬN CHUYỂN'}
                    {docType === 'ORDER_SUMMARY' && 'BẢNG TỔNG HỢP DANH SÁCH ĐƠN HÀNG'}
                  </h1>
                  <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                    Hệ thống quản lý Oder Checklist • Giao hàng chung cư & Khách ngoài
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Mã xuất báo cáo</div>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    EXP-{new Date().toISOString().slice(2, 10).replace(/-/g, '')}-{totalOrders}D
                  </div>
                </div>
              </div>

              {/* Metadata Subgrid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-dashed border-slate-300 text-[11px]">
                <div>
                  <span className="text-slate-500">Kỳ lọc / Báo cáo:</span>{' '}
                  <span className="font-bold text-slate-800">{periodLabel}</span>
                </div>
                <div>
                  <span className="text-slate-500">Ngày lập biểu:</span>{' '}
                  <span className="font-medium text-slate-800">{new Date().toLocaleDateString('vi-VN')}</span>
                </div>
                <div>
                  <span className="text-slate-500">Người lập:</span>{' '}
                  <span className="font-bold text-slate-800">{currentUser}</span>
                </div>
                <div>
                  <span className="text-slate-500">Tổng số đơn:</span>{' '}
                  <span className="font-bold text-emerald-700">{totalOrders} đơn hàng</span>
                </div>
              </div>
            </div>

            {/* Financial Summary Cards (Only in Accounting or Order Summary) */}
            {docType !== 'DELIVERY_MANIFEST' && (
              <div className="mb-5 print-break-inside-avoid">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <p className="text-[9px] uppercase font-bold text-slate-500">TỔNG DOANH THU</p>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{formatVND(totalSales)}</p>
                    <p className="text-[9px] text-slate-500">{totalOrders} đơn hàng</p>
                  </div>
                  <div className="bg-emerald-50/70 p-2.5 rounded border border-emerald-200">
                    <p className="text-[9px] uppercase font-bold text-emerald-700">ĐÃ THU TIỀN MẶT</p>
                    <p className="text-sm font-black text-emerald-800 mt-0.5">{formatVND(cashReceived)}</p>
                    <p className="text-[9px] text-emerald-600">Tiền mặt tại chỗ</p>
                  </div>
                  <div className="bg-blue-50/70 p-2.5 rounded border border-blue-200">
                    <p className="text-[9px] uppercase font-bold text-blue-700">ĐÃ CHUYỂN KHOẢN</p>
                    <p className="text-sm font-black text-blue-800 mt-0.5">{formatVND(bankReceived)}</p>
                    <p className="text-[9px] text-blue-600">Chuyển khoản ngân hàng</p>
                  </div>
                  <div className={`p-2.5 rounded border ${totalUnpaid > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-[9px] uppercase font-bold ${totalUnpaid > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
                      CHƯA THU (CÔNG NỢ)
                    </p>
                    <p className={`text-sm font-black mt-0.5 ${totalUnpaid > 0 ? 'text-amber-900' : 'text-slate-700'}`}>
                      {formatVND(totalUnpaid)}
                    </p>
                    <p className="text-[9px] text-slate-500">{unpaidCount} đơn chưa thanh toán</p>
                  </div>
                </div>

                {/* Accounting balance check line */}
                <div className="bg-slate-100/80 px-3 py-1.5 rounded flex items-center justify-between text-[10px] font-mono border border-slate-200">
                  <span className="font-bold text-slate-700">
                    ĐỐI SOÁT CÂN ĐỐI:{' '}
                    <span className="text-slate-900">{formatVND(totalSales)}</span> ={' '}
                    <span className="text-emerald-700">{formatVND(cashReceived)}</span> (TM) +{' '}
                    <span className="text-blue-700">{formatVND(bankReceived)}</span> (CK) +{' '}
                    <span className="text-amber-700">{formatVND(totalUnpaid)}</span> (Nợ)
                  </span>
                  <span className={`font-black uppercase ${isReconciled ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {isReconciled ? '✓ Khớp 100%' : '⚠️ Lệch số đối soát'}
                  </span>
                </div>
              </div>
            )}

            {/* Delivery Manifest Quick Header (Only in Delivery Manifest mode) */}
            {docType === 'DELIVERY_MANIFEST' && (
              <div className="mb-4 bg-blue-50/70 p-3 rounded border border-blue-200 print-break-inside-avoid">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-blue-700 font-medium">Tổng điểm giao:</span>{' '}
                    <span className="font-bold text-slate-900">{totalOrders} điểm</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Cần thu tiền mặt:</span>{' '}
                    <span className="font-bold text-rose-700">{formatVND(totalUnpaid)}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Đã trả trước:</span>{' '}
                    <span className="font-bold text-emerald-700">{formatVND(totalCollected)}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Đơn hỏa tốc / gấp:</span>{' '}
                    <span className="font-bold text-amber-700">{highPriorityCount} đơn</span>
                  </div>
                </div>
              </div>
            )}

            {/* Main Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[10px] sm:text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-y border-slate-300 font-bold">
                    <th className="py-2 px-1 text-center w-7 border-r border-slate-200">STT</th>
                    <th className="py-2 px-2 text-left w-20 border-r border-slate-200">Mã đơn</th>
                    {docType === 'DELIVERY_MANIFEST' && (
                      <th className="py-2 px-1 text-center w-7 border-r border-slate-200">Xong</th>
                    )}
                    <th className="py-2 px-2 text-left border-r border-slate-200">
                      {docType === 'DELIVERY_MANIFEST' ? 'Căn hộ / Tòa / Địa chỉ' : 'Khách hàng / Vị trí'}
                    </th>
                    {showItemDetails && (
                      <th className="py-2 px-2 text-left border-r border-slate-200">Món hàng</th>
                    )}
                    <th className="py-2 px-2 text-right w-20 border-r border-slate-200">
                      {docType === 'DELIVERY_MANIFEST' ? 'Tiền thu COD' : 'Tổng tiền'}
                    </th>
                    <th className="py-2 px-2 text-center w-20 border-r border-slate-200">Thanh toán</th>
                    {docType === 'DELIVERY_MANIFEST' ? (
                      <th className="py-2 px-2 text-center w-24 border-r border-slate-200">Ký nhận</th>
                    ) : (
                      <th className="py-2 px-2 text-center w-20 border-r border-slate-200">Trạng thái</th>
                    )}
                    {showNotes && <th className="py-2 px-2 text-left">Ghi chú</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedOrders.map((ord, idx) => {
                    const isPaid = ord.paymentStatus === 'PAID';
                    const isHighPriority = ord.priority === 'HIGH';

                    return (
                      <tr
                        key={ord.id}
                        className={`hover:bg-slate-50 transition print-break-inside-avoid ${
                          isHighPriority ? 'bg-amber-50/40' : idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                        }`}
                      >
                        {/* STT */}
                        <td className="py-2 px-1 text-center font-mono text-slate-500 border-r border-slate-200">
                          {idx + 1}
                        </td>

                        {/* Order ID & Time */}
                        <td className="py-2 px-2 border-r border-slate-200">
                          <span className="font-mono font-bold text-slate-900">{ord.id}</span>
                          {isHighPriority && (
                            <span className="ml-1 text-[8px] font-black uppercase text-rose-600 bg-rose-100 px-1 rounded">
                              GẤP
                            </span>
                          )}
                          <div className="text-[9px] text-slate-400 font-mono">
                            {new Date(ord.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Checkbox for delivery manifest */}
                        {docType === 'DELIVERY_MANIFEST' && (
                          <td className="py-2 px-1 text-center border-r border-slate-200">
                            <div className="w-4 h-4 border border-slate-400 rounded mx-auto"></div>
                          </td>
                        )}

                        {/* Customer / Address */}
                        <td className="py-2 px-2 border-r border-slate-200">
                          <div className="font-bold text-slate-900">{ord.customerName}</div>
                          {ord.customerPhone && (
                            <div className="text-[9px] text-slate-500 font-mono">{ord.customerPhone}</div>
                          )}
                          <div className="font-medium text-slate-700 text-[10px] mt-0.5">
                            {ord.location.formattedAddress}
                          </div>
                        </td>

                        {/* Order Items */}
                        {showItemDetails && (
                          <td className="py-2 px-2 border-r border-slate-200 max-w-[200px]">
                            {ord.items.map((it, iIdx) => (
                              <div key={iIdx} className="text-[10px] leading-tight text-slate-800">
                                • <span className="font-semibold">{it.productName}</span>{' '}
                                <span className="text-slate-500">
                                  (x{it.quantity} {it.unit || 'phần'})
                                </span>
                              </div>
                            ))}
                          </td>
                        )}

                        {/* Total Amount / COD */}
                        <td className="py-2 px-2 text-right font-mono font-bold border-r border-slate-200">
                          {docType === 'DELIVERY_MANIFEST' ? (
                            isPaid ? (
                              <span className="text-emerald-700">0 đ (Đã trả)</span>
                            ) : (
                              <span className="text-rose-700 font-black">{formatVND(ord.totalAmount)}</span>
                            )
                          ) : (
                            <span className="text-slate-900">{formatVND(ord.totalAmount)}</span>
                          )}
                        </td>

                        {/* Payment Status */}
                        <td className="py-2 px-2 text-center border-r border-slate-200">
                          {isPaid ? (
                            <span className="text-emerald-700 font-bold">
                              {ord.paymentMethod === 'BANK_TRANSFER' ? 'Đã CK' : 'Đã trả TM'}
                            </span>
                          ) : (
                            <span className="text-rose-600 font-black">Chưa thu</span>
                          )}
                        </td>

                        {/* Delivery Status or Signature field */}
                        {docType === 'DELIVERY_MANIFEST' ? (
                          <td className="py-2 px-2 text-center border-r border-slate-200">
                            <div className="h-7 border-b border-dotted border-slate-300"></div>
                          </td>
                        ) : (
                          <td className="py-2 px-2 text-center border-r border-slate-200">
                            {ord.deliveryStatus === 'DELIVERED' ? (
                              <span className="text-emerald-700 font-bold">Đã giao</span>
                            ) : ord.deliveryStatus === 'OUT_FOR_DELIVERY' ? (
                              <span className="text-blue-700 font-bold">Đang giao</span>
                            ) : ord.deliveryStatus === 'READY_FOR_DELIVERY' ? (
                              <span className="text-amber-700 font-bold">Sẵn sàng</span>
                            ) : (
                              <span className="text-slate-500">Chờ giao</span>
                            )}
                          </td>
                        )}

                        {/* Notes */}
                        {showNotes && (
                          <td className="py-2 px-2 text-[10px] text-slate-600 italic">
                            {ord.location.deliveryNote || ord.deliveryNote || ord.internalNote || ord.note || '-'}
                            {ord.tags && ord.tags.length > 0 && (
                              <span className="block not-italic text-[9px] text-slate-500 font-medium">
                                [{ord.tags.join(', ')}]
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer Totals */}
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
                    <td
                      colSpan={docType === 'DELIVERY_MANIFEST' ? (showItemDetails ? 4 : 3) : (showItemDetails ? 3 : 2)}
                      className="py-2 px-2 text-right uppercase"
                    >
                      Tổng cộng ({totalOrders} đơn):
                    </td>
                    {showItemDetails && docType !== 'DELIVERY_MANIFEST' && <td></td>}
                    <td className="py-2 px-2 text-right font-mono text-xs font-black text-slate-900">
                      {formatVND(totalSales)}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-emerald-800">
                      {paidCount} đã thu / {unpaidCount} nợ
                    </td>
                    <td colSpan={showNotes ? 2 : 1} className="py-2 px-2 text-left text-[10px] text-slate-600">
                      {deliveredCount} đã giao • {pendingCount} đang xử lý
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Formal Accounting Signatures Block */}
            {showSignatures && (
              <div className="mt-8 pt-4 border-t border-slate-300 print-break-inside-avoid">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="font-bold text-slate-800 uppercase text-[11px]">Người lập biểu</p>
                    <p className="text-[9px] text-slate-500 italic">(Ký & ghi rõ họ tên)</p>
                    <div className="h-14"></div>
                    <p className="font-semibold text-slate-700">{currentUser}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 uppercase text-[11px]">
                      {docType === 'DELIVERY_MANIFEST' ? 'Người giao hàng' : 'Kế toán / Thủ quỹ'}
                    </p>
                    <p className="text-[9px] text-slate-500 italic">(Ký xác nhận tiền & hàng)</p>
                    <div className="h-14"></div>
                    <p className="font-semibold text-slate-700">................................</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 uppercase text-[11px]">
                      {docType === 'DELIVERY_MANIFEST' ? 'Bàn giao / Tiếp nhận' : 'Quản lý duyệt'}
                    </p>
                    <p className="text-[9px] text-slate-500 italic">(Ký duyệt sổ sách)</p>
                    <div className="h-14"></div>
                    <p className="font-semibold text-slate-700">................................</p>
                  </div>
                </div>

                {/* Footer disclaimer */}
                <div className="mt-6 text-center text-[9px] text-slate-400 border-t border-dotted border-slate-200 pt-2">
                  Báo cáo được trích xuất từ phần mềm Quản lý đơn hàng Oder Checklist • {currentDateFormatted}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Bar - No print */}
        <div className="no-print bg-white p-3 sm:p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            <span>Sẵn sàng xuất: </span>
            <span className="font-bold text-slate-800">{totalOrders} đơn</span> •{' '}
            <span className="font-bold text-emerald-700">{formatVND(totalSales)}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Download PDF button */}
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || totalOrders === 0}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Tải file định dạng PDF lưu về máy"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{exportStep || 'Đang tạo PDF...'}</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-rose-100" />
                  <span>Tải file PDF (.pdf)</span>
                </>
              )}
            </button>

            {/* Print / Save as PDF via native dialog */}
            <button
              onClick={handlePrintBrowser}
              disabled={totalOrders === 0}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Mở hộp thoại in trình duyệt để in trực tiếp hoặc Lưu dạng PDF vector"
            >
              <Printer className="w-4 h-4 text-slate-200" />
              <span>In / Lưu PDF</span>
            </button>

            {/* Export CSV button */}
            <button
              onClick={handleExportCsv}
              disabled={totalOrders === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Tải file Excel / CSV kế toán UTF-8"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Tải file CSV</span>
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
