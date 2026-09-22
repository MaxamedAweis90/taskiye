import React, { useState } from 'react';
import { WifiOff, Wifi, RefreshCw, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const {
    isOnline,
    isNetworkReconnected,
    isChecking,
    isSyncing,
    pendingCount,
    retryConnection,
  } = useOnlineStatus();

  const [isDismissed, setIsDismissed] = useState(false);

  // When online, do not show the offline bar
  if (isOnline) {
    return null;
  }

  // If dismissed by user
  if (isDismissed) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-5 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto select-none animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div
        className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border shadow-2xl backdrop-blur-xl transition-all ${
          isNetworkReconnected
            ? 'bg-emerald-950/90 dark:bg-emerald-950/95 border-emerald-500/40 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
            : 'bg-slate-900/95 dark:bg-[#0B132B]/95 border-slate-700/60 dark:border-white/[0.12] text-slate-300'
        }`}
      >
        {isNetworkReconnected ? (
          /* Internet detected: green icon + pulse */
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Wifi className="w-3.5 h-3.5 shrink-0" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </span>
        ) : (
          /* Offline: amber icon + pulse */
          <span className="flex items-center gap-1.5 text-amber-400">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </span>
        )}

        <span className={`text-xs font-semibold ${isNetworkReconnected ? 'text-emerald-300 font-bold' : ''}`}>
          {isNetworkReconnected ? 'You are online.' : 'You are offline.'}
        </span>

        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            {isSyncing ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : null}
            {pendingCount} pending
          </span>
        )}

        <button
          type="button"
          disabled={isChecking}
          onClick={() => retryConnection()}
          className={`text-[11px] underline underline-offset-2 ml-1 cursor-pointer transition-colors flex items-center gap-1 font-bold ${
            isNetworkReconnected
              ? 'text-emerald-400 hover:text-white font-extrabold'
              : 'text-slate-400 hover:text-white'
          }`}
          title="Try to reconnect to internet now"
        >
          {isChecking ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Checking...</span>
            </>
          ) : (
            <span>Retry</span>
          )}
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
    </aside>
  );
};

