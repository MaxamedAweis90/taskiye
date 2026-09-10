import React from 'react';

interface PlaceholderProps {
  title: string;
  subtitle: string;
}

export const PlaceholderScreen: React.FC<PlaceholderProps> = ({ title, subtitle }) => (
  <div className="w-full h-full min-h-[440px] flex flex-col items-center justify-center text-center p-6 sm:p-12">
    <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mb-5 shadow-[0_0_30px_-4px_rgba(250,204,21,0.3)]">
      <span className="text-3xl">⚡</span>
    </div>
    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">{title}</h2>
    <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">{subtitle}</p>
    <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#10192D] border border-white/[0.08] text-xs text-slate-300 shadow-sm">
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#FACC15]" />
      <span className="font-medium">Reusable Fullscreen AppLayout Ready</span>
    </div>
  </div>
);
