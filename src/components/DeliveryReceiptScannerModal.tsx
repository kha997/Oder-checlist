import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { formatVND } from '../utils/storage';
import { Order, PaymentMethod } from '../types';
import { playNotificationSound } from '../utils/soundNotification';
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  ZapOff,
  Upload,
  CheckCircle2,
  Banknote,
  FileText,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Maximize2,
  Image as ImageIcon,
  Building2,
  Phone,
  Package,
  Plus,
} from 'lucide-react';

interface DeliveryReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickCreateWithReceipt?: (receiptDataUrl: string, detectedInfo?: { customerName?: string; room?: string; phone?: string }) => void;
}

export const DeliveryReceiptScannerModal: React.FC<DeliveryReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onOpenQuickCreateWithReceipt,
}) => {
  const { orders, markDelivered, markPaid, attachReceiptToOrder, soundEnabled } = useApp();

  // Camera & Stream State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Scanned / Captured Image
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Recognition / Matched Order State
  const [matchedOrder, setMatchedOrder] = useState<Order | null>(null);
  const [manualOrderId, setManualOrderId] = useState<string>('');
  const [detectedTextSummary, setDetectedTextSummary] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Active pending orders for linking
  const activeOrders = orders.filter((o) => o.status === 'ACTIVE');
  const pendingOrders = activeOrders.filter((o) => o.deliveryStatus !== 'DELIVERED');

  // Start Camera Stream
  const startCamera = useCallback(async (desiredFacing: 'environment' | 'user') => {
    setCameraError(null);
    try {
      // Stop any existing tracks
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Trình duyệt không hỗ trợ trực tiếp Camera API (getUserMedia). Bạn có thể tải ảnh hoặc chụp qua hệ thống bên dưới.');
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: desiredFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }

      // Check torch capability
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities && videoTrack.getCapabilities()) as any;
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      let message = 'Không thể mở camera. Vui lòng cấp quyền camera hoặc chọn ảnh từ thiết bị.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Quyền truy cập Camera bị từ chối. Vui lòng bấm Cho phép camera trên thanh địa chỉ hoặc tải ảnh lên.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'Không tìm thấy thiết bị camera trên máy này. Bạn có thể tải ảnh chụp biên nhận có sẵn.';
      }
      setCameraError(message);
    }
  }, [stream]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setIsTorchOn(false);
  }, [stream]);

  // Handle open/close
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setMatchedOrder(null);
      setManualOrderId('');
      setDetectedTextSummary(null);
      setActionSuccessNotice(null);
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch (e) {
        console.warn('Failed to toggle torch:', e);
      }
    }
  };

  // Flip Camera
  const flipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Scan & Match logic for an image
  const analyzeReceiptImage = async (dataUrl: string, filenameHint?: string) => {
    setIsCapturing(true);
    let detectedOrder: Order | null = null;
    let detectionNotes: string[] = [];

    // Try native BarcodeDetector if available
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'upc_a'],
        });

        // Create HTMLImageElement to pass to detector
        const img = new Image();
        img.src = dataUrl;
        await new Promise((res) => {
          img.onload = res;
        });

        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue.trim();
          detectionNotes.push(`Đã đọc mã vạch/QR: ${rawValue}`);

          // Match by Order ID directly
          const found = activeOrders.find(
            (o) => o.id.toUpperCase() === rawValue.toUpperCase() || rawValue.includes(o.id)
          );
          if (found) {
            detectedOrder = found;
          }
        }
      } catch (e) {
        console.warn('BarcodeDetector error:', e);
      }
    }

    // Heuristic matching from filename or recent orders if not barcode detected
    if (!detectedOrder && filenameHint) {
      const upper = filenameHint.toUpperCase();
      const found = activeOrders.find(
        (o) => upper.includes(o.id.toUpperCase()) || (o.location.formattedAddress && upper.includes(o.location.formattedAddress.toUpperCase()))
      );
      if (found) {
        detectedOrder = found;
        detectionNotes.push(`Khớp theo tên tệp: ${found.id}`);
      }
    }

    // If still no exact match, suggest the most recent pending delivery as smart candidate
    if (!detectedOrder && pendingOrders.length > 0) {
      detectedOrder = pendingOrders[0];
      detectionNotes.push(`Gợi ý đơn chờ giao gần nhất (${detectedOrder.id} - ${detectedOrder.customerName})`);
    }

    if (detectedOrder) {
      setMatchedOrder(detectedOrder);
      setManualOrderId(detectedOrder.id);
      if (soundEnabled) {
        playNotificationSound('SCAN_SUCCESS');
      }
    }

    setDetectedTextSummary(
      detectionNotes.length > 0
        ? detectionNotes.join(' • ')
        : 'Đã chụp biên nhận thành công. Kiểm tra thông tin đơn hàng bên dưới.'
    );

    setIsCapturing(false);
  };

  // Capture Frame from Video
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    if (soundEnabled) {
      playNotificationSound('CAMERA_SHUTTER');
    }

    setCapturedImage(dataUrl);
    stopCamera();
    analyzeReceiptImage(dataUrl);
  };

  // Handle File Upload Fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        stopCamera();
        analyzeReceiptImage(dataUrl, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Retake / Scan another
  const handleRetake = () => {
    setCapturedImage(null);
    setMatchedOrder(null);
    setManualOrderId('');
    setDetectedTextSummary(null);
    setActionSuccessNotice(null);
    startCamera(facingMode);
  };

  // Actions on Matched Order
  const handleConfirmDelivered = () => {
    if (!matchedOrder || !capturedImage) return;
    markDelivered(matchedOrder.id, capturedImage);
    setActionSuccessNotice(`✅ Đã xác nhận giao xong đơn ${matchedOrder.id}! Biên nhận đã được lưu vào đơn.`);
    if (soundEnabled) {
      playNotificationSound('READY_FOR_DELIVERY');
    }
  };

  const handleConfirmPaid = (method: PaymentMethod) => {
    if (!matchedOrder) return;
    markPaid(matchedOrder.id, method);
    if (capturedImage) {
      attachReceiptToOrder(matchedOrder.id, capturedImage);
    }
    setActionSuccessNotice(`💵 Đã xác nhận thu tiền đơn ${matchedOrder.id} (${method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'})!`);
  };

  const handleSaveReceiptOnly = () => {
    if (!matchedOrder || !capturedImage) return;
    attachReceiptToOrder(matchedOrder.id, capturedImage);
    setActionSuccessNotice(`📎 Đã đính kèm ảnh biên nhận vào đơn ${matchedOrder.id}!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200/80">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Camera className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-1.5">
                <span>Quét Phiếu Giao Hàng</span>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full font-bold uppercase">
                  Camera Scan
                </span>
              </h2>
              <p className="text-xs text-indigo-200/80">
                Chụp biên nhận, hóa đơn nhận hàng & đối soát tự động
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* CAMERA VIEWFINDER OR CAPTURED IMAGE */}
          {!capturedImage ? (
            <div className="space-y-3">
              {/* Viewfinder box */}
              <div className="relative aspect-4/3 w-full bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-2 border-indigo-500/40">
                {cameraError ? (
                  <div className="p-6 text-center text-white space-y-3 max-w-xs">
                    <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">{cameraError}</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Chọn ảnh từ thiết bị</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      autoPlay
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Reticle / Target Guides */}
                    <div className="absolute inset-6 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                      <div className="flex justify-between">
                        <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400 -mt-1 -ml-1"></div>
                        <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400 -mt-1 -mr-1"></div>
                      </div>

                      {/* Laser scanning beam animation */}
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>

                      <div className="flex justify-between">
                        <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400 -mb-1 -ml-1"></div>
                        <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400 -mb-1 -mr-1"></div>
                      </div>
                    </div>

                    {/* Overlay instruction tag */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/1 bg-black/60 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/20 flex items-center gap-1.5 shadow-md">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Đặt phiếu giao hàng vào khung ngắm</span>
                    </div>

                    {/* Camera Control overlay buttons */}
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      {hasTorch && (
                        <button
                          onClick={toggleTorch}
                          className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border transition ${
                            isTorchOn
                              ? 'bg-amber-400 text-slate-900 border-amber-300'
                              : 'bg-black/50 text-white border-white/20'
                          }`}
                          title="Bật/Tắt đèn Flash"
                        >
                          {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                        </button>
                      )}

                      <button
                        onClick={flipCamera}
                        className="w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center backdrop-blur-md active:scale-95 transition"
                        title="Đổi camera trước/sau"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Shutter & File Upload controls */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 active:scale-95 text-xs font-bold text-slate-700 flex items-center gap-2 transition"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Tải ảnh lên</span>
                </button>

                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!!cameraError || !stream}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 active:scale-95 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-700/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Camera className="w-5 h-5" />
                  <span>CHỤP BIÊN NHẬN</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          ) : (
            /* CAPTURED RECEIPT REVIEW & MATCHING VIEW */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Image Preview & Retake Bar */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-900 aspect-16/10">
                <img
                  src={capturedImage}
                  alt="Scanned Receipt"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2.5 right-2.5 flex items-center gap-2">
                  <button
                    onClick={handleRetake}
                    className="px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 active:scale-95 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Chụp lại</span>
                  </button>
                </div>
                <div className="absolute bottom-2.5 left-2.5 bg-black/70 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-white/20 flex items-center gap-1.5">
                  <ImageIcon className="w-3 h-3 text-emerald-400" />
                  <span>Ảnh phiếu giao hàng</span>
                </div>
              </div>

              {/* Status / Notice banner */}
              {actionSuccessNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900 font-bold animate-in slide-in-from-top-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{actionSuccessNotice}</span>
                </div>
              )}

              {detectedTextSummary && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="font-medium">{detectedTextSummary}</span>
                </div>
              )}

              {/* MATCHED ORDER CARD */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Đơn hàng liên kết với phiếu</span>
                  </h4>
                  {matchedOrder && (
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        matchedOrder.deliveryStatus === 'DELIVERED'
                          ? 'bg-blue-100 text-blue-800'
                          : matchedOrder.deliveryStatus === 'READY_FOR_DELIVERY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {matchedOrder.deliveryStatus === 'DELIVERED'
                        ? 'Đã giao'
                        : matchedOrder.deliveryStatus === 'READY_FOR_DELIVERY'
                        ? 'Sẵn sàng giao'
                        : 'Chờ giao'}
                    </span>
                  )}
                </div>

                {/* Dropdown to switch or pick order */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Chọn đơn hàng cần cập nhật:
                  </label>
                  <select
                    value={manualOrderId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setManualOrderId(id);
                      const ord = activeOrders.find((o) => o.id === id) || null;
                      setMatchedOrder(ord);
                    }}
                    className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                  >
                    <option value="">-- Chọn đơn hàng trong hệ thống --</option>
                    {activeOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} - {o.customerName} ({o.location.formattedAddress}) - {formatVND(o.totalAmount)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Matched Order Details Box */}
                {matchedOrder ? (
                  <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-900 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-sm font-black">{matchedOrder.location.formattedAddress}</span>
                      </div>
                      <span className="text-base font-black text-emerald-700">
                        {formatVND(matchedOrder.totalAmount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>Khách hàng: <strong>{matchedOrder.customerName}</strong></span>
                      {matchedOrder.customerPhone && (
                        <span className="flex items-center gap-1 text-blue-600 font-semibold">
                          <Phone className="w-3 h-3" />
                          {matchedOrder.customerPhone}
                        </span>
                      )}
                    </div>

                    {/* Order items preview */}
                    <div className="bg-slate-50 p-2 rounded-lg space-y-1 text-[11px] text-slate-700">
                      {matchedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>• {item.productName} x{item.quantity}</span>
                          <span className="font-mono">{formatVND(item.lineTotal)}</span>
                        </div>
                      ))}
                    </div>

                    {/* ACTION BUTTONS ON THIS ORDER */}
                    <div className="pt-2 space-y-2">
                      {matchedOrder.deliveryStatus !== 'DELIVERED' && (
                        <button
                          onClick={handleConfirmDelivered}
                          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          <span>XÁC NHẬN ĐÃ GIAO HÀNG (KÈM BIÊN NHẬN)</span>
                        </button>
                      )}

                      {matchedOrder.paymentStatus === 'UNPAID' && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleConfirmPaid('CASH')}
                            className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                          >
                            <Banknote className="w-4 h-4" />
                            <span>Thu Tiền Mặt</span>
                          </button>
                          <button
                            onClick={() => handleConfirmPaid('BANK_TRANSFER')}
                            className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                          >
                            <Banknote className="w-4 h-4" />
                            <span>Thu Chuyển Khoản</span>
                          </button>
                        </div>
                      )}

                      <button
                        onClick={handleSaveReceiptOnly}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>Chỉ lưu ảnh biên nhận vào đơn</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* No order matched -> Option to create new order from receipt */
                  <div className="bg-white rounded-xl p-3 border border-slate-200 text-center space-y-2">
                    <p className="text-xs text-slate-500">
                      Chưa tìm thấy đơn hàng tương ứng hoặc đây là đơn mới vừa giao.
                    </p>
                    {onOpenQuickCreateWithReceipt && (
                      <button
                        onClick={() => {
                          onOpenQuickCreateWithReceipt(capturedImage);
                          onClose();
                        }}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tạo đơn hàng mới từ phiếu này</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 text-[11px]">
            Hỗ trợ quét phiếu giao hàng, hóa đơn & mã vạch camera
          </span>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 active:scale-95 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
