import type { FC } from 'react';

interface PageLoaderProps {
  message?: string;
}

export const PageLoader: FC<PageLoaderProps> = ({ message = 'Loading workspace...' }) => {
  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center p-6 animate-fade-in select-none">
      <div className="relative w-12 h-12 flex items-center justify-center mb-4">
        <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 dark:border-amber-400/20" />
        <div className="w-12 h-12 rounded-full border-2 border-t-amber-500 dark:border-t-amber-400 animate-spin" />
      </div>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
        {message}
      </p>
    </div>
  );
};
