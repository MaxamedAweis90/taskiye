import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineEmptyStateProps {
  resourceName: string;
  onRetry?: () => void;
  isCompact?: boolean;
}

export const OfflineEmptyState: React.FC<OfflineEmptyStateProps> = ({
  resourceName,
  onRetry,
  isCompact = false,
}) => {
  if (isCompact) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] my-2 select-none">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-2">
          <WifiOff className="w-4 h-4" />
        </div>
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
          No Internet Available
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed max-w-xs">
          Connect to a network to load your {resourceName}.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer flex items-center gap-1 active:scale-95"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Connection</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center py-16 px-4 text-center rounded-3xl bg-white/60 dark:bg-[#10192D]/60 border border-slate-200/80 dark:border-white/[0.08] shadow-sm my-4 select-none">
      <div className="w-16 h-16 rounded-3xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-inner">
        <WifiOff className="w-8 h-8 stroke-[1.8]" />
      </div>

      <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
        No Internet Available
      </h3>

      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
        Connect to a network to load your {resourceName}.
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Check Connection</span>
        </button>
      )}
    </div>
  );
};
