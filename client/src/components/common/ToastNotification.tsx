import React, { useEffect, useState } from 'react';
import { AlertCircle, Info, X, ShieldCheck, RotateCcw } from 'lucide-react';
import { useTaskiyeStore } from '../../store/useTaskiyeStore';

export const ToastNotification: React.FC = () => {
  const { toastNotification, dismissToast, showToast } = useTaskiyeStore();
  const [visible, setVisible] = useState(false);

  // Check for pending migration confirmation across page reloads
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('taskiye_migration_toast');
      if (pending) {
        sessionStorage.removeItem('taskiye_migration_toast');
        const parsed = JSON.parse(pending);
        if (parsed.title) {
          showToast(parsed.title, parsed.description, parsed.type || 'success');
        }
      }
    } catch {
      // Ignore in restricted environments
    }
  }, [showToast]);

  useEffect(() => {
    if (toastNotification) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        const unmountTimer = setTimeout(() => {
          dismissToast();
        }, 300);
        return () => clearTimeout(unmountTimer);
      }, 6500);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [toastNotification, dismissToast]);

  if (!toastNotification) return null;

  const isSuccess = toastNotification.type === 'success' || !toastNotification.type;
  const isError = toastNotification.type === 'error';

  return (
    <div
      className={`fixed top-[calc(4.75rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 sm:top-6 sm:right-6 sm:left-auto sm:translate-x-0 z-[10000] max-w-md w-[calc(100vw-2rem)] sm:w-auto select-none transition-all duration-350 ease-out transform ${
        visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-4 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-2xl border border-amber-500/30 dark:border-amber-400/30 p-4 shadow-xl dark:shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_24px_rgba(250,204,21,0.18)] flex items-start gap-3.5">
        {/* Left Icon with subtle glow */}
        <div className="shrink-0 mt-0.5">
          {isSuccess ? (
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:bg-amber-400/15 dark:border-amber-400/30 dark:text-amber-300 dark:shadow-[0_0_12px_rgba(250,204,21,0.3)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
          ) : isError ? (
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <Info className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
            {toastNotification.title}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1 font-normal">
            {toastNotification.description}
          </p>

          {toastNotification.action && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => {
                  toastNotification.action?.onClick();
                  setVisible(false);
                  setTimeout(dismissToast, 200);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 shadow-sm dark:shadow-[0_0_12px_rgba(250,204,21,0.35)] transition-all cursor-pointer active:scale-95 select-none"
              >
                <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{toastNotification.action.label}</span>
              </button>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            setTimeout(dismissToast, 250);
          }}
          className="shrink-0 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Animated Progress Bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-200 dark:bg-white/[0.06]">
          <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 animate-[shrink_6.5s_linear_forwards]" />
        </div>
      </div>
    </div>
  );
};
