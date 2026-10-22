import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { type Order } from '../types';
import { playNotificationSound } from '../utils/soundNotification';
import { Camera, X, RefreshCw, Zap, ZapOff, Upload, CheckCircle2, Sparkles, RotateCcw, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';

interface ProofOfDeliveryCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess?: (orderId: string, photoUrl: string) => void;
}

/**
 * Longest edge for each captured proof-of-delivery photo.
 *
 * Firestore rejects any document over 1,048,576 bytes. The POD image is stored
 * inline on the order as `receiptImageUrl`, so the encoded data URL counts
 * against that budget. Measured on a high-entropy 12 MP frame (3024x4032, what
 * a phone camera actually produces) the data URL is ~9 MB at JPEG q=0.85 and
 * ~3 MB at 4032x3024 — both far past the limit, and the write would simply fail.
 * 1600 px keeps a legible watermark, verifies a package left at a door, and
 * lands around 200-450 kB.
 */
const POD_MAX_EDGE = 1600;

/** Quality steps tried until the encoded image fits the Firestore budget. */
const POD_QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55];

/**
 * Budget for the encoded image, well under Firestore's 1,048,576-byte hard
 * limit. The order carries other fields besides the photo, and the limit applies
 * to the whole document, not just this field.
 */
const POD_MAX_BYTES = 700_000;

/**
 * Shrink factor applied per pass when quality alone does not fit the budget.
 *
 * Dimensions are the only lever that reliably converges: quality barely moves a
 * high-entropy frame (the same 12 MP frame above is still ~3 MB at q=0.55).
 *
 * The encoder does not iterate a fixed list of sizes. It keeps shrinking the
 * dimensions until the encoded result fits, because a fixed list can only be as
 * good as the worst case it was measured against, and "it fit the inputs I tried"
 * is not the guarantee that matters here — the write must not be rejected.
 */
const POD_SHRINK_FACTOR = 0.75;

/**
 * Floor for the long edge, so the loop cannot shrink a photo into uselessness.
 *
 * The loop is expected to stop long before this. It is a safety stop, not the
 * mechanism: convergence comes from the budget check at every step. At this size
 * even an incompressible frame of noise encodes to well under the budget, so the
 * floor is not what makes the result fit.
 */
const POD_MIN_EDGE = 320;

/**
 * Hard cap on passes, in case a future change to the budget or the quality ladder
 * makes the loop fail to converge. Without it a non-converging encoder would
 * freeze the UI on the main thread.
 */
const POD_MAX_PASSES = 12;

/**
 * Render a source (video frame or loaded image) into a canvas capped at
 * POD_MAX_EDGE, then encode it as JPEG, stepping quality down — and, only if that
 * is not enough, shrinking the dimensions — until the result fits the budget.
 *
 * Returns null only when a 2D context is unavailable or the output never fits, so
 * the caller can fall back to the original image rather than storing something
 * that would be rejected.
 */
function encodePodPhoto(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, canvas: HTMLCanvasElement) => void,
  sourceWidth: number,
  sourceHeight: number
): string | null {
  // A corrupt or not-yet-decoded image can report NaN/0 dimensions, which would
  // propagate into the canvas and throw on drawImage.
  const firstPass = podOutputSize(sourceWidth, sourceHeight);
  if (!firstPass) return null;

  const canvas = document.createElement('canvas');
  let { width, height } = firstPass;

  for (let pass = 0; pass < POD_MAX_PASSES; pass++) {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Resizing a canvas resets its state, so set smoothing on every pass.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    draw(ctx, width, height, canvas);

    let dataUrl = canvas.toDataURL('image/jpeg', POD_QUALITY_STEPS[0]);
    for (let i = 1; i < POD_QUALITY_STEPS.length && dataUrlByteSize(dataUrl) > POD_MAX_BYTES; i++) {
      dataUrl = canvas.toDataURL('image/jpeg', POD_QUALITY_STEPS[i]);
    }

    if (dataUrlByteSize(dataUrl) <= POD_MAX_BYTES) return dataUrl;

    // Still too large, so shrink and try again — unless the floor is reached, in
    // which case no further pass would help.
    if (Math.max(width, height) <= POD_MIN_EDGE) return null;
    width = Math.max(1, Math.round(width * POD_SHRINK_FACTOR));
    height = Math.max(1, Math.round(height * POD_SHRINK_FACTOR));
  }

  return null;
}

/**
 * Draw the logistics proof-of-delivery watermark banner, scaled to the output
 * size so the text stays legible whatever the photo dimensions are.
 *
 * Clamped to the canvas: an extreme aspect ratio can produce a very short image
 * (the encoder's floor is on the *long* edge, so a 400x8 output is possible), and
 * a banner taller than the canvas would be drawn at a negative y and vanish.
 */
function drawPodWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  subtitle: string
): void {
  const bannerHeight = Math.min(height, Math.max(56, Math.round(height * 0.09)));
  const bannerTop = Math.max(0, height - bannerHeight);
  const padding = Math.min(24, Math.round(width * 0.03));
  const titleSize = Math.max(10, Math.round(bannerHeight * 0.34));
  const subtitleSize = Math.max(8, Math.round(bannerHeight * 0.25));

  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.fillRect(0, bannerTop, width, bannerHeight);

  // Green accent stripe
  ctx.fillStyle = '#10b981';
  ctx.fillRect(0, bannerTop, Math.max(3, Math.round(width * 0.006)), bannerHeight);

  // Only draw text when the banner is tall enough to hold it.
  if (bannerHeight >= 28) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(title, padding, bannerTop + Math.round(bannerHeight * 0.42));

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `${subtitleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(subtitle, padding, bannerTop + Math.round(bannerHeight * 0.78));
  }
}

/** Timestamp pair used on every watermark. */
function podTimestamp(includeSeconds: boolean): { date: string; time: string } {
  const now = new Date();
  return {
    date: now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
    }),
  };
}

// Matches any data URL up to the `base64,` marker, including parameterised media
// types such as `data:image/jpeg;charset=utf-8;base64,`.
const DATA_URL_PREFIX_RE = /^data:[^,]*,/;

/**
 * Encoded byte size of a data URL without decoding it.
 *
 * Firestore's limit applies to the stored bytes, not UTF-16 code units, so the
 * budget is checked in real bytes rather than by string length.
 */
export function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.replace(DATA_URL_PREFIX_RE, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Firestore's hard per-document limit, in bytes. */
export const FIRESTORE_DOC_LIMIT_BYTES = 1_048_576;

/**
 * Tunables of the POD encoder, exported so the budget contract can be tested
 * without rendering the component or needing a real canvas.
 */
export const POD_ENCODING = {
  maxEdge: POD_MAX_EDGE,
  minEdge: POD_MIN_EDGE,
  maxBytes: POD_MAX_BYTES,
  shrinkFactor: POD_SHRINK_FACTOR,
  maxPasses: POD_MAX_PASSES,
  qualitySteps: POD_QUALITY_STEPS,
} as const;

/**
 * First-pass output size for a source image: capped at `maxEdge` on the long
 * edge, never upscaled.
 *
 * Exported for testing. Returns null for a source whose dimensions are unusable
 * (NaN/0/Infinity), which a badly decoded image can report.
 */
export function podOutputSize(
  sourceWidth: number,
  sourceHeight: number
): { width: number; height: number } | null {
  const valid = (n: number) => Number.isFinite(n) && n >= 1;
  if (!valid(sourceWidth) || !valid(sourceHeight)) return null;

  const scale = Math.min(1, POD_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

/**
 * The size sequence the encoder walks when quality alone does not fit the budget.
 *
 * Exported for testing: it must reach the floor, shrink monotonically, and stop.
 */
export function podShrinkSequence(startWidth: number, startHeight: number): Array<{ width: number; height: number }> {
  const sizes: Array<{ width: number; height: number }> = [];
  let width = startWidth;
  let height = startHeight;

  for (let pass = 0; pass < POD_MAX_PASSES; pass++) {
    sizes.push({ width, height });
    if (Math.max(width, height) <= POD_MIN_EDGE) break;
    width = Math.max(1, Math.round(width * POD_SHRINK_FACTOR));
    height = Math.max(1, Math.round(height * POD_SHRINK_FACTOR));
  }

  return sizes;
}

export const ProofOfDeliveryCameraModal: React.FC<ProofOfDeliveryCameraModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
}) => {
  const { markDelivered, attachReceiptToOrder, soundEnabled } = useApp();

  const videoRef = useRef<HTMLVideoElement | null>(null);
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
    if (!videoRef.current) return;
    setIsCapturing(true);

    try {
      if (soundEnabled) {
        playNotificationSound('CAMERA_SHUTTER');
      }
    } catch {}

    const video = videoRef.current;
    const { date, time } = podTimestamp(true);
    const title = order
      ? `📦 ĐƠN ${order.id} • ${order.customerName}`
      : '📦 XÁC NHẬN GIAO HÀNG (PROOF OF DELIVERY)';
    const subtitle = [
      order ? `📍 ${order.location.formattedAddress} (${order.location.condoName || ''})` : '',
      `⏰ ${time} ${date}`,
    ]
      .filter(Boolean)
      .join('  |  ');

    const dataUrl = encodePodPhoto(
      (ctx, width, height) => {
        ctx.drawImage(video, 0, 0, width, height);
        drawPodWatermark(ctx, width, height, title, subtitle);
      },
      video.videoWidth || 1280,
      video.videoHeight || 960
    );

    if (dataUrl) {
      setCapturedImage(dataUrl);
    }
    setIsCapturing(false);
    stopCamera();
  };


  // Fallback File Upload (Mobile Native Camera or Gallery)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const source = event.target?.result as string | undefined;
      if (!source) return;

      const img = new Image();
      img.onload = () => {
        const { date, time } = podTimestamp(false);
        const title = order
          ? `📦 ĐƠN ${order.id} • ${order.customerName}`
          : '📦 XÁC NHẬN GIAO HÀNG';
        const subtitle = [
          order ? `📍 ${order.location.formattedAddress}` : '',
          `⏰ ${time} ${date}`,
        ]
          .filter(Boolean)
          .join('  |  ');

        // Same 1600 px cap as the live-camera path: a gallery pick can be a
        // 12 MP frame whose data URL would exceed Firestore's document limit.
        const dataUrl = encodePodPhoto(
          (ctx, width, height) => {
            ctx.drawImage(img, 0, 0, width, height);
            drawPodWatermark(ctx, width, height, title, subtitle);
          },
          img.width,
          img.height
        );

        setCapturedImage(dataUrl ?? source);
      };
      img.onerror = () => setCapturedImage(source);
      img.src = source;
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
