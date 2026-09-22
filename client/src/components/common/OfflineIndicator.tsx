import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOnlineStatus();
  const [showReconnectedPill, setShowReconnectedPill] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setIsDismissed(false);
      setShowReconnectedPill(false);
    } else {
      // Just reconnected
      setShowReconnectedPill(true);
      const timer = setTimeout(() => {
        setShowReconnectedPill(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  // If online and not in the brief reconnected state, show nothing
  if (isOnline && !showReconnectedPill) {
    return null;
  }

  // If offline but user manually closed this session
  if (!isOnline && isDismissed) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-5 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto select-none animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {isOnline && showReconnectedPill ? (
        /* Reconnected Pill */
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/90 dark:bg-emerald-950/95 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-2xl backdrop-blur-xl">
          <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Back online. {isSyncing ? 'Syncing changes…' : 'Everything is synced.'}</span>
        </div>
      ) : (
        /* Offline Pill */
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/95 dark:bg-[#0B132B]/95 border border-slate-700/60 dark:border-white/[0.12] text-slate-300 text-xs font-semibold shadow-2xl backdrop-blur-xl">
          <span className="flex items-center gap-1.5 text-amber-400">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </span>
          <span>You are offline. Showing cached data.</span>

          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {isSyncing ? (
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              ) : null}
              {pendingCount} pending sync
            </span>
          )}

          <button
            type="button"
            onClick={() => syncNow()}
            className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2 ml-1 cursor-pointer transition-colors"
            title="Attempt to reconnect and sync now"
          >
            Retry
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-slate-500 hover:text-slate-300 p-0.5 ml-0.5 rounded transition-colors cursor-pointer text-xs"
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        </div>
      )}
    </aside>
  );
};
