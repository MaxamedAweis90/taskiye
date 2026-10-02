import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Taskiye RootErrorBoundary] Uncaught application error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHardReset = async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      sessionStorage.clear();
      // Keep essential local storage if needed, or clear cache keys
      localStorage.removeItem('taskiye_auth_session');
      localStorage.removeItem('taskiye_chunk_reload');
    } catch (e) {
      console.warn('[Taskiye] Error during hard reset:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950">
          <div className="max-w-lg w-full bg-[#121927]/95 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl flex flex-col items-center text-center relative overflow-hidden">
            {/* Ambient Backlight */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 mb-5 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-3">
              Application Error Shield
            </span>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
              Something went wrong
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 font-medium mb-4 leading-relaxed max-w-sm">
              Taskiye encountered an unexpected issue while rendering this screen. Your data is safe.
            </p>

            {this.state.error?.message && (
              <div className="w-full mb-6 p-3 bg-slate-900/80 rounded-xl border border-white/5 text-left overflow-x-auto max-h-24">
                <p className="text-[11px] font-mono text-rose-300 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs sm:text-sm shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleHardReset}
                className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Clear Cache & Reset</span>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 w-full flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80" />
              <span>If issues persist, please try in an incognito window or clear browser site data.</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
