import React, { useState, useEffect } from 'react';
import { Bell, Flame, Clock, ShieldAlert, CheckCircle2, X, Sparkles } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const STORAGE_KEY = 'taskiye_pwa_permission_dismissed';

export const PwaPermissionPrompt: React.FC = () => {
  const {
    isSupported,
    permission,
    subscribe,
    sendWelcomeNotification,
    playCelebrationChime,
  } = usePushNotifications();

  const [isVisible, setIsVisible] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isGrantedState, setIsGrantedState] = useState(false);

  useEffect(() => {
    if (!isSupported) return;

    // Check if running in standalone mode (PWA installed on iOS or Android)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator &&
        (window.navigator as unknown as { standalone: boolean }).standalone === true);

    // Also detect mobile web environments
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /iPad|iPhone|iPod|Android/.test(ua);

    // Show prompt if:
    // 1. Not already granted or denied
    // 2. Either in standalone PWA or mobile browser
    // 3. Not previously dismissed
    if (
      Notification.permission === 'default' &&
      (isStandalone || isMobile) &&
      !localStorage.getItem(STORAGE_KEY)
    ) {
      // Subtle delay so user lands on dashboard first
      const timer = setTimeout(() => setIsVisible(true), 1800);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission]);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
  };

  const handleEnableNotifications = async () => {
    setIsRequesting(true);

    try {
      const ok = await subscribe({
        dailyReminders: true,
        streakAlerts: true,
        dailyCadenceDigest: true,
      });

      if (ok || Notification.permission === 'granted') {
        setIsGrantedState(true);
        playCelebrationChime();

        // Send rich welcome notification directly to device
        await sendWelcomeNotification();

        // Auto close after celebrating
        setTimeout(() => {
          handleDismiss();
        }, 2000);
      } else {
        handleDismiss();
      }
    } catch (err) {
      console.warn('Notification permission error:', err);
      handleDismiss();
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white dark:bg-[#10192D] border border-amber-500/30 dark:border-amber-400/30 rounded-3xl p-6 shadow-2xl dark:shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(250,204,21,0.2)] flex flex-col relative animate-in slide-in-from-bottom-8 duration-300">
        {!isGrantedState ? (
          <>
            {/* Top Close Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-all cursor-pointer"
              title="Maybe Later"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Glowing Bell Header */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 dark:bg-amber-400/15 border border-amber-500/35 dark:border-amber-400/35 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-sm dark:shadow-[0_0_20px_rgba(250,204,21,0.25)]">
                <Bell className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-3 h-3" />
                  <span>Stay Consistent</span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Turn On Daily Alerts
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
              Taskiye works best when it can alert you at key moments throughout your day.
            </p>

            {/* Value Cards */}
            <div className="flex flex-col gap-2.5 mb-5">
              <div className="flex items-start gap-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Morning Habit Cadence</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Your scheduled habits ready as soon as you wake up
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Flame className="w-4 h-4 fill-rose-600 dark:fill-rose-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Streak Society Warnings</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Never lose your hard-earned streak to a forgotten habit
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-2xl p-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Evening Cadence Digest</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    Quick checklist check before the midnight rollover
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleDismiss}
                className="py-3 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 transition-all cursor-pointer"
              >
                Maybe Later
              </button>
              <button
                type="button"
                disabled={isRequesting}
                onClick={handleEnableNotifications}
                className="flex-1 py-3 rounded-xl text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-400 dark:bg-[#FACC15] dark:hover:bg-[#EAB308] shadow-sm dark:shadow-[0_0_20px_rgba(250,204,21,0.35)] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
              >
                <span>{isRequesting ? 'Connecting...' : 'Enable Notifications'}</span>
              </button>
            </div>
          </>
        ) : (
          /* Celebratory State */
          <div className="py-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm dark:shadow-[0_0_30px_rgba(52,211,153,0.3)] animate-bounce">
              <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
              Alerts Activated! 🎉
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
              We just sent a welcome notification to your device. You are ready to build indestructible habits!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
