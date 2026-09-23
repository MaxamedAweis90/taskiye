import React, { useState } from 'react';
import { WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface OfflineEmptyStateProps {
  resourceName: string;
  onRetry?: () => void | Promise<unknown>;
  isCompact?: boolean;
}

export const OfflineEmptyState: React.FC<OfflineEmptyStateProps> = ({
  resourceName,
  onRetry,
  isCompact = false,
}) => {
  const { retryConnection, isChecking: globalChecking, isNetworkReconnected } = useOnlineStatus();
  const [isCheckingLocal, setIsCheckingLocal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCheck = async () => {
    setIsCheckingLocal(true);
    setFeedback(null);
    try {
      const connected = await retryConnection();
      if (!connected) {
        setFeedback('Still offline. Please check your internet connection.');
        setTimeout(() => setFeedback(null), 3500);
      } else if (onRetry) {
        await onRetry();
      }
    } catch {
      setFeedback('Still offline. Please check your internet connection.');
      setTimeout(() => setFeedback(null), 3500);
    } finally {
      setIsCheckingLocal(false);
    }
  };

  const isChecking = globalChecking || isCheckingLocal;

  if (isCompact) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] my-2 select-none">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
          isNetworkReconnected
            ? 'bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 dark:border-emerald-400/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 text-amber-600 dark:text-amber-400'
        }`}>
          <WifiOff className="w-4 h-4" />
        </div>
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
          {isNetworkReconnected ? 'Internet Restored' : 'No Internet Available'}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed max-w-xs">
          {isNetworkReconnected
            ? `Click retry to load your ${resourceName}.`
            : `Connect to a network to load your ${resourceName}.`}
        </p>
        <button
          type="button"
          disabled={isChecking}
          onClick={handleCheck}
          className={`mt-2.5 px-3 py-1 rounded-lg text-xs font-semibold text-white shadow-sm transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
            isNetworkReconnected
              ? 'bg-emerald-500 hover:bg-emerald-600'
              : 'bg-amber-500 hover:bg-amber-600'
          }`}
        >
          {isChecking ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3" />
              <span>{isNetworkReconnected ? 'Reconnect' : 'Retry Connection'}</span>
            </>
          )}
        </button>
        {feedback && (
          <span className="text-[10.5px] font-semibold text-rose-500 dark:text-rose-400 mt-1.5 animate-in fade-in">
            {feedback}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center py-16 px-4 text-center rounded-3xl bg-white/60 dark:bg-[#10192D]/60 border border-slate-200/80 dark:border-white/[0.08] shadow-sm my-auto select-none">
      <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-inner ${
        isNetworkReconnected
          ? 'bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 dark:border-emerald-400/20 text-emerald-600 dark:text-emerald-400'
          : 'bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 flex items-center justify-center text-amber-600 dark:text-amber-400'
      }`}>
        <WifiOff className="w-8 h-8 stroke-[1.8]" />
      </div>

      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
        {isNetworkReconnected ? 'Internet Connection Restored' : 'No Internet Available'}
      </h3>

      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
        {isNetworkReconnected
          ? `Click below to reconnect and load your ${resourceName}.`
          : `Connect to a network to load your ${resourceName}.`}
      </p>

      <button
        type="button"
        disabled={isChecking}
        onClick={handleCheck}
        className={`mt-5 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
          isNetworkReconnected
            ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
            : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
        }`}
      >
        {isChecking ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Checking connection...</span>
          </>
        ) : (
          <>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isNetworkReconnected ? 'Reconnect & Load' : 'Check Connection'}</span>
          </>
        )}
      </button>

      {feedback && (
        <span className="text-xs font-semibold text-rose-500 dark:text-rose-400 mt-2.5 animate-in fade-in">
          {feedback}
        </span>
      )}
    </div>
  );
};

