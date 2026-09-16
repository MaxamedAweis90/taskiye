import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  X,
  QrCode,
  Scan,
  Copy,
  Check,
  Camera,
  Share2,
  CheckCircle2,
  Download,
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
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const cleanHandle = currentUser.handle.replace(/^@/, '');
  const inviteLink = `${window.location.origin}/rank?invite=${encodeURIComponent(cleanHandle)}`;
  const qrPayload = JSON.stringify({
    app: 'taskiye',
    action: 'add_friend',
    handle: `@${cleanHandle}`,
    name: currentUser.name,
    timestamp: Date.now(),
  });

  // Generate real QR code image using `qrcode`
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR code:', err));
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
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    setScanResult(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device/browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationFrame(tickScan);
      }
    } catch (err: unknown) {
      console.warn('Camera access error:', err);
      setCameraError(
        (err as Error)?.message || 'Camera permission denied or camera not found.'
      );
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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      try {
        let handle = code.data;
        if (code.data.startsWith('{')) {
          const parsed = JSON.parse(code.data);
          if (parsed.handle) handle = parsed.handle;
        } else if (code.data.includes('invite=')) {
          const urlObj = new URL(code.data);
          const inviteParam = urlObj.searchParams.get('invite');
          if (inviteParam) handle = `@${inviteParam.replace(/^@/, '')}`;
        }

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

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `taskiye-qr-${cleanHandle}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Mobile Fullscreen Container (< sm) vs Desktop Modal (sm:) */}
      <div
        className="w-full h-full sm:h-auto sm:max-w-md bg-[#0A101D] sm:border sm:border-[#FACC15]/40 sm:rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(250,204,21,0.2)] flex flex-col justify-between text-left relative overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-4">
          {/* Top Bar Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 pt-2 sm:pt-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-[#FACC15] flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black text-white leading-tight">Taskiye League QR</h3>
                <p className="text-xs text-slate-400">Scan or share your profile to connect</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Switcher: My QR Code vs Scan Camera */}
          <div className="flex p-1 bg-[#060A14] border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('my_code')}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'my_code'
                  ? 'bg-[#FACC15] text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
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
                  ? 'bg-[#FACC15] text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
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
              <div className="w-full bg-gradient-to-b from-[#131D33] to-[#0A101E] border border-amber-400/30 rounded-3xl p-5 sm:p-6 flex flex-col items-center gap-3.5 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#FACC15] bg-slate-800 shrink-0">
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left">
                    <div className="text-base font-black text-white">{currentUser.name}</div>
                    <div className="text-xs text-[#FACC15] font-bold">{currentUser.handle}</div>
                  </div>
                </div>

                {/* Real High-Resolution QR Code */}
                <div className="p-3 bg-white rounded-2xl shadow-[0_0_24px_rgba(250,204,21,0.25)] flex items-center justify-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Real Taskiye QR Code"
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-500">
                      Generating QR...
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-300 font-medium max-w-xs leading-relaxed">
                  Point another phone camera at this real QR code to send an instant friend request.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Save QR</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2.5 rounded-xl bg-[#FACC15] hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SCAN CAMERA */}
          {activeTab === 'scan' && (
            <div className="flex flex-col items-center gap-3 text-center py-2">
              <div className="w-full h-72 sm:h-64 rounded-2xl bg-black border-2 border-dashed border-[#FACC15]/60 flex flex-col items-center justify-center relative overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder Target Box */}
                <div className="absolute inset-8 sm:inset-10 border-2 border-white/40 rounded-xl pointer-events-none flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#FACC15]" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#FACC15]" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#FACC15]" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#FACC15]" />

                  {isScanning && (
                    <div className="w-full h-0.5 bg-[#FACC15] shadow-[0_0_12px_#FACC15] animate-pulse" />
                  )}
                </div>

                {cameraError && (
                  <div className="absolute inset-0 bg-[#0A101D]/90 p-4 flex flex-col items-center justify-center gap-2 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <span className="text-xs font-bold text-white">Camera Unavailable</span>
                    <span className="text-[11px] text-slate-400 max-w-xs">{cameraError}</span>
                  </div>
                )}
              </div>

              {scanResult ? (
                <div className="w-full p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Scanned {scanResult}! Connecting...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Align Taskiye QR code inside the frame to scan</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile bottom close button */}
        <div className="sm:hidden pt-4 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white/10 text-white font-bold text-xs"
          >
            Close QR Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
