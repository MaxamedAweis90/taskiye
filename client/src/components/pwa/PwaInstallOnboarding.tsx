import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X, Download, Smartphone, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'taskiye_pwa_onboarding_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallOnboarding: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 1. Strict Desktop Filter: Desktop browsers see NOTHING as requested
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
    const isAndroid = /Android/.test(ua);

    if (!isIOS && !isAndroid) {
      return; // Desktop: do nothing
    }

    // 2. Check if already installed as standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator &&
        (window.navigator as unknown as { standalone: boolean }).standalone === true);

    if (isStandalone) {
      return; // Already installed: do nothing
    }

    // 3. Check if user previously dismissed
    if (localStorage.getItem(STORAGE_KEY)) {
      return;
    }

    if (isIOS) {
      setDeviceType('ios');
      // Show iOS guide after a subtle 2.5s delay so the user first sees the app
      const timer = setTimeout(() => setIsVisible(true), 2500);
      return () => clearTimeout(timer);
    }

    if (isAndroid) {
      setDeviceType('android');
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setIsVisible(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        handleDismiss();
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  };

  if (!isVisible || !deviceType) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-end sm:items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="pointer-events-auto w-full max-w-sm bg-[#10192D] border border-amber-400/25 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(250,204,21,0.15)] flex flex-col relative animate-in slide-in-from-bottom-6 duration-300">
        {/* Top Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge & Icon */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
              <Sparkles className="w-3 h-3" />
              <span>Install Web App</span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Get Taskiye on your Phone
            </h3>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Install Taskiye to your home screen for instant streak alerts, habit notifications, and offline access.
        </p>

        {/* iOS Step-by-Step Onboarding */}
        {deviceType === 'ios' && (
          <div className="flex flex-col gap-2.5 mb-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3.5">
            <div className="flex items-center gap-3 text-xs text-slate-200">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Share className="w-3.5 h-3.5" />
              </div>
              <span>
                1. Tap the <strong className="text-white">Share</strong> button in Safari's toolbar.
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-200">
              <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
                <PlusSquare className="w-3.5 h-3.5" />
              </div>
              <span>
                2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          {deviceType === 'android' ? (
            <>
              <button
                type="button"
                onClick={handleDismiss}
                className="flex-1 py-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-white/5 transition-all cursor-pointer"
              >
                Not Now
              </button>
              <button
                type="button"
                onClick={handleAndroidInstall}
                className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] shadow-[0_0_15px_rgba(250,204,21,0.3)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Install App</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-3 rounded-xl text-xs font-bold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] shadow-[0_0_15px_rgba(250,204,21,0.3)] transition-all cursor-pointer text-center"
            >
              Got it, thanks!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
