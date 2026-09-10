import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home, Sparkles } from 'lucide-react';

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();

  let errorMessage = 'An unexpected error occurred in the application.';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error.data?.message || error.statusText;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#152033]/90 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Warning Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 mb-3">
          Error {errorStatus}
        </span>

        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
          Something went wrong
        </h1>

        <p className="text-xs sm:text-sm text-slate-400 font-medium mb-6 line-clamp-3">
          {errorMessage}
        </p>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-slate-950 font-extrabold text-xs sm:text-sm shadow-[0_0_20px_rgba(250,204,21,0.25)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-4 h-4 stroke-[2.5]" />
            <span>Reload Page</span>
          </button>

          <Link
            to="/"
            className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-[#1C2B44] hover:bg-[#223554] border border-white/10 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-[11px] text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
          <span>Taskiye Error Resilience Shield Active</span>
        </div>
      </div>
    </div>
  );
};
