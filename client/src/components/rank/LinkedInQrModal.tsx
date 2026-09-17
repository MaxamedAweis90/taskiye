import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  X,
  QrCode,
  Scan,
  Camera,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface LinkedInQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    name: string;
    handle: string;
    avatarUrl?: string;
  };
  onScannedUser?: (handle: string) => void;
}

// Safe ESM/CommonJS interop helper for QRCode
function getQrCodeLib() {
  const qr = QRCode as unknown as {
    toCanvas?: typeof QRCode.toCanvas;
    toString?: typeof QRCode.toString;
    default?: {
      toCanvas?: typeof QRCode.toCanvas;
      toString?: typeof QRCode.toString;
    };
  };
  if (qr && typeof qr.toCanvas === 'function') return qr;
  if (qr && qr.default && typeof qr.default.toCanvas === 'function') return qr.default;
  return qr;
}

// Safe ESM/CommonJS interop helper for jsQR
function getJsQrDecoder() {
  const jsqrAny = jsQR as unknown as typeof jsQR | { default?: typeof jsQR; jsQR?: typeof jsQR };
  if (typeof jsqrAny === 'function') return jsqrAny;
  if (jsqrAny && typeof (jsqrAny as { default?: typeof jsQR }).default === 'function') {
    return (jsqrAny as { default: typeof jsQR }).default;
  }
  if (jsqrAny && typeof (jsqrAny as { jsQR?: typeof jsQR }).jsQR === 'function') {
    return (jsqrAny as { jsQR: typeof jsQR }).jsQR;
  }
  return null;
}

function safeDecodeQr(data: Uint8ClampedArray, width: number, height: number) {
  try {
    const fn = getJsQrDecoder();
    if (typeof fn === 'function') {
      return fn(data, width, height, { inversionAttempts: 'dontInvert' });
    }
  } catch (err) {
    console.warn('[jsQR] Decode error:', err);
  }
  return null;
}

export const LinkedInQrModal: React.FC<LinkedInQrModalProps> = ({
  isOpen,
  onClose,
  currentUser = {
    name: 'Alex Morgan',
    handle: '@alexmorgan',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  onScannedUser,
}) => {
  const [activeTab, setActiveTab] = useState<'my_code' | 'scan'>('my_code');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [selfScanNotice, setSelfScanNotice] = useState<string | null>(null);
  const [invalidNotice, setInvalidNotice] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const cleanHandle = (currentUser?.handle || '@alexmorgan').replace(/^@/, '');
  const userName = currentUser?.name || 'Alex Morgan';
  const userAvatar = currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

  const qrPayload = useMemo(
    () =>
      JSON.stringify({
        app: 'taskiye',
        action: 'add_friend',
        handle: `@${cleanHandle}`,
        name: userName,
      }),
    [cleanHandle, userName]
  );

  // Generate real QR code image & SVG on mount
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const qrLib = getQrCodeLib();

    // 1. Generate vector SVG
    if (qrLib && typeof qrLib.toString === 'function') {
      try {
        qrLib.toString(qrPayload, { type: 'svg', margin: 1, errorCorrectionLevel: 'H' })
          .then((svg: string) => {
            if (mounted && svg && typeof svg === 'string' && svg.includes('<svg')) {
              setQrSvg(svg);
            }
          })
          .catch((err: unknown) => console.warn('[QRCode] SVG generation error:', err));
      } catch (err) {
        console.warn('[QRCode] SVG error:', err);
      }
    }

    // 2. Render directly onto canvas for instant guaranteed rendering
    if (qrCanvasRef.current && qrLib && typeof qrLib.toCanvas === 'function') {
      try {
        qrLib.toCanvas(qrCanvasRef.current, qrPayload, {
          width: 220,
          margin: 1.5,
          color: { dark: '#000000', light: '#FFFFFF' },
          errorCorrectionLevel: 'H',
        }).catch((err: unknown) => console.warn('[QRCode] Canvas render error:', err));
      } catch (err) {
        console.warn('[QRCode] Canvas error:', err);
      }
    }

    return () => {
      mounted = false;
    };
  }, [isOpen, qrPayload]);

  // Real Camera Scanner using `jsQR`
  useEffect(() => {
    if (!isOpen || activeTab !== 'scan') {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    setScanResult(null);
    setSelfScanNotice(null);
    setInvalidNotice(null);
    setIsScanning(true);

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access requires HTTPS or is not supported by this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(() => null);
        animationFrameRef.current = requestAnimationFrame(tickScan);
      }
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Camera permission denied or camera not found.';
      setCameraError(msg);
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const tickScan = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(tickScan);
      return;
    }

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameRef.current = requestAnimationFrame(tickScan);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = safeDecodeQr(imageData.data, imageData.width, imageData.height);

    if (code && code.data) {
      try {
        let handle = '';
        let isTaskiye = false;

        if (code.data.startsWith('{')) {
          const parsed = JSON.parse(code.data);
          if (parsed.app === 'taskiye' || parsed.handle) {
            isTaskiye = true;
            handle = parsed.handle || '';
          }
        } else if (code.data.startsWith('taskiye:connect:')) {
          isTaskiye = true;
          handle = `@${code.data.replace('taskiye:connect:', '').replace(/^@/, '')}`;
        } else if (code.data.includes('invite=')) {
          isTaskiye = true;
          const urlObj = new URL(code.data);
          const inviteParam = urlObj.searchParams.get('invite');
          if (inviteParam) handle = `@${inviteParam.replace(/^@/, '')}`;
        }

        if (!isTaskiye || !handle) {
          setInvalidNotice('Not a valid Taskiye streak code. Scan a rival’s QR code.');
          setTimeout(() => setInvalidNotice(null), 2500);
          animationFrameRef.current = requestAnimationFrame(tickScan);
          return;
        }

        // Self-Scan Detection: Check if scanned handle matches current user
        const decodedClean = handle.replace(/^@/, '').toLowerCase().trim();
        if (decodedClean === cleanHandle.toLowerCase().trim()) {
          stopCamera();
          setSelfScanNotice("That's you! 👋 This is your personal streak code. Show it to a rival so they can challenge you.");
          setTimeout(() => {
            setSelfScanNotice(null);
            setActiveTab('my_code');
          }, 2200);
          return;
        }

        // Valid rival QR code scanned
        setScanResult(handle);
        stopCamera();

        if (onScannedUser) {
          onScannedUser(handle);
        }

        setTimeout(() => {
          onClose();
        }, 1500);
        return;
      } catch (err) {
        console.warn('Error parsing QR payload:', err);
      }
    }

    animationFrameRef.current = requestAnimationFrame(tickScan);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex sm:hidden items-center justify-center p-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* Mobile-Only Fullscreen Container */}
      <div
        className="w-full h-full bg-slate-50 dark:bg-[#0A101D] p-5 flex flex-col justify-between text-left relative overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-4">
          {/* Top Bar Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] pb-3 pt-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-400/20 text-amber-600 dark:text-[#FACC15] flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">Taskiye League QR</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Scan or share your profile to connect</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Switcher: My QR Code vs Scan Camera */}
          <div className="flex p-1 bg-slate-200/80 dark:bg-[#060A14] border border-slate-300 dark:border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('my_code')}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'my_code'
                  ? 'bg-amber-400 dark:bg-[#FACC15] text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>My QR Code</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'scan'
                  ? 'bg-amber-400 dark:bg-[#FACC15] text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Scan Camera</span>
            </button>
          </div>

          {/* TAB 1: MY QR CODE */}
          {activeTab === 'my_code' && (
            <div className="flex flex-col items-center gap-4 text-center py-2">
              {/* Profile Card with Real QR Code */}
              <div className="w-full bg-white dark:bg-gradient-to-b dark:from-[#131D33] dark:to-[#0A101E] border border-slate-200 dark:border-amber-400/30 rounded-3xl p-5 flex flex-col items-center gap-3.5 shadow-md dark:shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-amber-400 dark:ring-[#FACC15] bg-slate-100 dark:bg-slate-800 shrink-0">
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left">
                    <div className="text-base font-black text-slate-900 dark:text-white">{userName}</div>
                    <div className="text-xs text-amber-600 dark:text-[#FACC15] font-bold">@{cleanHandle}</div>
                  </div>
                </div>

                {/* Real High-Resolution Vector QR Code with Instant Canvas Rendering */}
                <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 dark:border-transparent dark:shadow-[0_0_24px_rgba(250,204,21,0.25)] flex items-center justify-center">
                  {qrSvg && qrSvg.includes('<svg') ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                      className="w-44 h-44 [&>svg]:w-full [&>svg]:h-full"
                    />
                  ) : (
                    <canvas
                      ref={qrCanvasRef}
                      className="w-44 h-44 rounded-lg"
                    />
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium max-w-xs leading-relaxed">
                  Show this real QR code to any camera to connect on Taskiye.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SCAN CAMERA */}
          {activeTab === 'scan' && (
            <div className="flex flex-col items-center gap-3 text-center py-2">
              <div className="w-full h-72 sm:h-64 rounded-2xl bg-black border-2 border-dashed border-amber-500 dark:border-[#FACC15]/60 flex flex-col items-center justify-center relative overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder Target Box */}
                <div className="absolute inset-8 sm:inset-10 border-2 border-white/40 rounded-xl pointer-events-none flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-400 dark:border-[#FACC15]" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-400 dark:border-[#FACC15]" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-400 dark:border-[#FACC15]" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-400 dark:border-[#FACC15]" />

                  {isScanning && (
                    <div className="w-full h-0.5 bg-amber-400 dark:bg-[#FACC15] shadow-[0_0_12px_#FACC15] animate-pulse" />
                  )}
                </div>

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/95 dark:bg-[#0A101D]/95 p-4 flex flex-col items-center justify-center gap-2 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-500 dark:text-amber-400" />
                    <span className="text-xs font-bold text-white">Camera Access</span>
                    <span className="text-[11px] text-slate-300 dark:text-slate-400 max-w-xs">{cameraError}</span>
                  </div>
                )}
              </div>

              {selfScanNotice ? (
                <div className="w-full p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-400/15 border border-amber-500/30 dark:border-amber-400/35 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2.5 animate-in fade-in shadow-md text-left">
                  <span className="text-xl">👋</span>
                  <div className="flex flex-col">
                    <span className="text-slate-900 dark:text-white font-extrabold">That's you!</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-200/90 font-medium leading-tight">
                      This is your personal streak code. Switching to your QR card to share...
                    </span>
                  </div>
                </div>
              ) : invalidNotice ? (
                <div className="w-full p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" />
                  <span>{invalidNotice}</span>
                </div>
              ) : scanResult ? (
                <div className="w-full p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Scanned {scanResult}! Connecting...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <Camera className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Align a rival's Taskiye QR code inside the frame to connect</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile bottom close button */}
        <div className="sm:hidden pt-4 border-t border-slate-200 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 text-slate-900 dark:text-white font-bold text-xs cursor-pointer"
          >
            Close QR Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
