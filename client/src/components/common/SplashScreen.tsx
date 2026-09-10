import React, { useState, useEffect } from 'react';
import { useSession } from '../../lib/auth-client';

export const SplashScreen: React.FC = () => {
  const { data: session, isPending: isSessionLoading } = useSession();
  const [progress, setProgress] = useState(15);
  const [isDone, setIsDone] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Initial progress acceleration
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) return prev;
        return prev + Math.floor(Math.random() * 15) + 10;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // When session resolution completes
    if (!isSessionLoading) {
      const completeTimer = setTimeout(() => {
        setProgress(100);
        const fadeTimer = setTimeout(() => {
          setIsDone(true);
          const unmountTimer = setTimeout(() => {
            setShouldRender(false);
          }, 500);
          return () => clearTimeout(unmountTimer);
        }, 350);
        return () => clearTimeout(fadeTimer);
      }, 450);

      return () => clearTimeout(completeTimer);
    }
  }, [isSessionLoading]);

  if (!shouldRender) return null;

  const statusMessage = session?.user ? 'Getting user info...' : 'Loading guest data...';

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none transition-opacity duration-500 ease-out ${
        isDone ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#060B14',
        backgroundImage: `
          radial-gradient(circle at 50% 45%, #15223A 0%, #0A111F 55%, #050811 100%),
          linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 48px 48px, 48px 48px',
      }}
    >
      <div className="flex flex-col items-center text-center max-w-sm px-6">
        {/* Centered Logo with Golden Glow */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-full bg-amber-400/15 blur-2xl pointer-events-none" />
          <img
            src="/logo.png"
            alt="Taskiye Logo"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_0_24px_rgba(250,204,21,0.5)] transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML =
                  '<div class="w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-3xl text-amber-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]">⚡</div>';
              }
            }}
          />
        </div>

        {/* Brand Title & Subtitle */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Taskiye
        </h1>
        <p className="text-[10px] tracking-[0.22em] font-semibold text-slate-400 uppercase mt-1.5">
          Unbreakable Habits • Zero Friction
        </p>

        {/* Progress Bar */}
        <div className="w-52 sm:w-64 h-1 bg-slate-800/80 border border-white/5 rounded-full overflow-hidden mt-6 mb-3.5 relative shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 rounded-full transition-all duration-200 ease-out shadow-[0_0_12px_rgba(250,204,21,0.6)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Dynamic Status Text with Pulse Indicator */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span>{statusMessage}</span>
        </div>
      </div>

      {/* App Version at bottom 10px */}
      <div className="absolute bottom-[10px] text-[10px] tracking-[0.25em] font-semibold text-slate-400 uppercase select-none">
        v0.1.0
      </div>
    </div>
  );
};

export default SplashScreen;
