import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Order } from '../types';
import { playNotificationSound } from '../utils/soundNotification';
import {
  Camera,
  X,
  RefreshCw,
  Zap,
  ZapOff,
  Upload,
  CheckCircle2,
  Building2,
  MapPin,
  Sparkles,
  RotateCcw,
  Check,
  FileText,
  AlertCircle,
  Truck,
  Image as ImageIcon,
} from 'lucide-react';

interface ProofOfDeliveryCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess?: (orderId: string, photoUrl: string) => void;
}

export const ProofOfDeliveryCameraModal: React.FC<ProofOfDeliveryCameraModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
}) => {
  const { markDelivered, attachReceiptToOrder, soundEnabled } = useApp();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Preview captured image before saving
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [deliveryProofNote, setDeliveryProofNote] = useState<string>('Đặt trước cửa');
  const [alsoMarkDelivered, setAlsoMarkDelivered] = useState<boolean>(true);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start Camera Stream
  const startCamera = useCallback(
    async (desiredFacing: 'environment' | 'user') => {
      setCameraError(null);
      try {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          setStream(null);
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError(
            'Trình duyệt không hỗ trợ trực tiếp Camera API. Bạn có thể sử dụng nút Tải ảnh/Chụp qua hệ thống.'
          );
          return;
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: desiredFacing },
            width: { ideal: 1280 },
            height: { ideal: 960 },
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
          if (capabilities && capabilities.torch) {
            setHasTorch(true);
          } else {
            setHasTorch(false);
          }
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        setCameraError(
          err.name === 'NotAllowedError'
            ? 'Quyền truy cập Camera bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt hoặc dùng nút tải ảnh.'
            : 'Không thể khởi động camera thiết bị. Vui lòng thử nút chụp qua hệ thống bên dưới.'
        );
      }
    },
    [stream]
  );

  // Toggle Torch
  const toggleTorch = async () => {
    if (!stream || !hasTorch) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextTorch = !isTorchOn;
        await (videoTrack.applyConstraints as any)({
          advanced: [{ torch: nextTorch }],
        });
        setIsTorchOn(nextTorch);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  // Flip Camera
  const flipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Handle modal open/close
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setCameraError(null);
      setIsTorchOn(false);
      setDeliveryProofNote('Đặt trước cửa phòng');
      if (order) {
        setAlsoMarkDelivered(order.deliveryStatus !== 'DELIVERED');
      }
      startCamera(facingMode);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Capture Photo with Timestamp & Order Watermark
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    try {
      if (soundEnabled) {
        playNotificationSound('CAMERA_SHUTTER');
      }
    } catch {}

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 960;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw main video frame
    ctx.drawImage(video, 0, 0, width, height);

    // Apply logistics proof-of-delivery watermark banner
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeFormatted = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const bannerHeight = Math.max(70, Math.round(height * 0.08));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

    // Green accent stripe
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, height - bannerHeight, 8, bannerHeight);

    // Text: Order info, Address, and Timestamp
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    const orderTitle = order
      ? `📦 ĐƠN ${order.id} • ${order.customerName}`
      : '📦 XÁC NHẬN GIAO HÀNG (PROOF OF DELIVERY)';
    ctx.fillText(orderTitle, 24, height - bannerHeight + 32);

    ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    const locationInfo = order ? `📍 ${order.location.formattedAddress} (${order.location.condoName || ''})` : '';
    const timeInfo = `⏰ ${timeFormatted} ${dateFormatted}`;
    ctx.fillText(`${locationInfo}  |  ${timeInfo}`, 24, height - bannerHeight + 60);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    setIsCapturing(false);
    stopCamera();
  };

  // Fallback File Upload (Mobile Native Camera or Gallery)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) {
          setCapturedImage(event.target?.result as string);
          return;
        }

        const canvas = canvasRef.current;
        const width = img.width;
        const height = img.height;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setCapturedImage(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Watermark
        const now = new Date();
        const dateFormatted = now.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const timeFormatted = now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const bannerHeight = Math.max(70, Math.round(height * 0.08));
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

        ctx.fillStyle = '#10b981';
        ctx.fillRect(0, height - bannerHeight, 8, bannerHeight);

        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#ffffff';
        const orderTitle = order
          ? `📦 ĐƠN ${order.id} • ${order.customerName}`
          : '📦 XÁC NHẬN GIAO HÀNG';
        ctx.fillText(orderTitle, 24, height - bannerHeight + 32);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#cbd5e1';
        const locationInfo = order ? `📍 ${order.location.formattedAddress}` : '';
        ctx.fillText(`${locationInfo}  |  ${timeFormatted} ${dateFormatted}`, 24, height - bannerHeight + 60);

        setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    stopCamera();
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  // Confirm and attach to order
  const handleConfirmProof = () => {
    if (!order || !capturedImage) return;

    if (alsoMarkDelivered) {
      markDelivered(order.id, capturedImage, deliveryProofNote);
    } else {
      attachReceiptToOrder(order.id, capturedImage, deliveryProofNote);
    }

    if (soundEnabled) {
      playNotificationSound('SCAN_SUCCESS');
    }

    if (onSuccess) {
      onSuccess(order.id, capturedImage);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4">
      {/* Hidden canvas for snapshot watermark composition */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden native camera/file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="w-full max-w-lg bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 text-white">
        {/* Top Header */}
        <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm uppercase tracking-wide text-white">
                  Chụp ảnh gói hàng đã giao
                </h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  POD Camera
                </span>
              </div>
              {order ? (
                <p className="text-[11px] text-slate-300 font-medium">
                  {order.id} • {order.customerName} ({order.location.formattedAddress})
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">Bằng chứng giao hàng (Proof-of-Delivery)</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder or Preview Viewport */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[340px] max-h-[58vh] overflow-hidden">
          {!capturedImage ? (
            /* LIVE CAMERA STREAM VIEW */
            <>
              {cameraError ? (
                <div className="p-6 text-center space-y-3 max-w-sm">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-rose-300 font-bold">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Chụp hoặc Tải ảnh từ thiết bị</span>
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Viewfinder Overlay Targeting Guide */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4">
                    <div className="bg-slate-950/70 backdrop-blur-xs text-slate-200 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/10 shadow-lg text-center flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Căn gói hàng & số phòng / cửa vào khung hình</span>
                    </div>

                    {/* Viewfinder Frame with corner brackets */}
                    <div className="w-[82%] h-[68%] border-2 border-dashed border-emerald-400/80 rounded-2xl relative shadow-2xl flex items-center justify-center">
                      <div className="w-8 h-8 border-t-2 border-l-2 border-emerald-400 absolute -top-1 -left-1 rounded-tl-lg" />
                      <div className="w-8 h-8 border-t-2 border-r-2 border-emerald-400 absolute -top-1 -right-1 rounded-tr-lg" />
                      <div className="w-8 h-8 border-b-2 border-l-2 border-emerald-400 absolute -bottom-1 -left-1 rounded-bl-lg" />
                      <div className="w-8 h-8 border-b-2 border-r-2 border-emerald-400 absolute -bottom-1 -right-1 rounded-br-lg" />

                      {order && (
                        <div className="bg-black/60 backdrop-blur-xs px-3 py-1 rounded-xl text-center border border-white/10">
                          <p className="text-xs font-black text-white">{order.location.formattedAddress}</p>
                          <p className="text-[10px] text-emerald-300 font-bold">{order.customerName}</p>
                        </div>
                      )}
                    </div>

                    <div className="h-6" />
                  </div>

                  {/* Top Floating Controls on Video */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    {hasTorch && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`p-2 rounded-xl backdrop-blur-md transition ${
                          isTorchOn
                            ? 'bg-amber-400 text-slate-950 shadow-lg'
                            : 'bg-black/50 text-white hover:bg-black/70'
                        }`}
                        title="Bật/Tắt đèn Flash"
                      >
                        {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={flipCamera}
                      className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition active:scale-95"
                      title="Đổi camera trước/sau"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            /* CAPTURED PREVIEW REVIEW */
            <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
              <img
                src={capturedImage}
                alt="Ảnh gói hàng đã giao"
                className="max-h-[58vh] w-full object-contain"
              />

              <div className="absolute top-3 left-3 bg-emerald-600/90 backdrop-blur-xs text-white text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-md">
                <CheckCircle2 className="w-4 h-4" />
                <span>Đã chụp ảnh xác nhận</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3 shrink-0">
          {!capturedImage ? (
            /* CAMERA SHUTTER & FALLBACK BUTTONS */
            <div className="flex items-center justify-between gap-3">
              {/* Fallback File/Gallery Picker */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 border border-slate-700"
                title="Tải ảnh từ thư viện"
              >
                <ImageIcon className="w-4 h-4 text-slate-300" />
                <span className="hidden sm:inline">Thư viện</span>
              </button>

              {/* GIANT TACTILE SHUTTER BUTTON */}
              <button
                type="button"
                onClick={capturePhoto}
                disabled={isCapturing || Boolean(cameraError)}
                className={`w-18 h-18 rounded-full border-4 border-white flex items-center justify-center p-1 transition-all active:scale-90 shadow-2xl mx-auto ${
                  isCapturing ? 'opacity-50 scale-95' : 'hover:scale-105'
                }`}
                title="Bấm để chụp ảnh gói hàng"
              >
                <div className="w-full h-full rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-inner">
                  <Camera className="w-7 h-7 text-white" />
                </div>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition active:scale-95"
              >
                Hủy
              </button>
            </div>
          ) : (
            /* REVIEW & CONFIRMATION PANEL */
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Quick Delivery Notes / Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                  <span>Ghi chú vị trí đặt gói hàng:</span>
                  <span className="text-emerald-400 font-medium">Bằng chứng POD</span>
                </div>
                <input
                  type="text"
                  placeholder="Ví dụ: Đặt trước cửa căn hộ, Gửi sảnh lễ tân, Treo tay nắm cửa..."
                  value={deliveryProofNote}
                  onChange={(e) => setDeliveryProofNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />

                {/* Quick note suggestion chips */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    'Đặt trước cửa phòng',
                    'Gửi sảnh lễ tân tháp',
                    'Gửi bảo vệ sảnh',
                    'Treo tay nắm cửa',
                    'Giao trực tiếp khách',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setDeliveryProofNote(chip)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition ${
                        deliveryProofNote === chip
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle to also mark order as DELIVERED */}
              {order && order.deliveryStatus !== 'DELIVERED' && (
                <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    checked={alsoMarkDelivered}
                    onChange={(e) => setAlsoMarkDelivered(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-500"
                  />
                  <span>Đồng thời đánh dấu đơn hàng sang trạng thái "ĐÃ GIAO XONG"</span>
                </label>
              )}

              {/* Action Buttons: Retake vs Attach */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                  <span>Chụp lại (Retake)</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmProof}
                  className="py-3 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-700/30 active:scale-95 transition"
                >
                  <Check className="w-4 h-4 text-white" />
                  <span>LƯU ẢNH XÁC NHẬN</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
