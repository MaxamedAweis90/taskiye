import React, { useState, useEffect } from 'react';
import { X, Compass, ArrowRight, Bot } from 'lucide-react';

interface WelcomeSpeechBubbleProps {
  onOpenChat: (initialPrompt?: string, language?: 'en' | 'so') => void;
  onDismiss: () => void;
  position?: 'desktop' | 'mobile';
  user?: {
    name?: string;
    username?: string;
    email?: string;
    avatarUrl?: string;
    image?: string | null;
  };
}

export const WelcomeSpeechBubble: React.FC<WelcomeSpeechBubbleProps> = ({
  onOpenChat,
  onDismiss,
  position = 'desktop',
  user,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const [storedLanguage, setStoredLanguage] = useState<'en' | 'so' | null>(() => {
    try {
      return (localStorage.getItem('taskiye_ai_language') as 'en' | 'so' | null) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const entranceTimer = setTimeout(() => setIsVisible(true), 150);

    const autoDismissTimer = setTimeout(() => {
      onDismiss();
    }, 30000);

    const playDing = () => {
      try {
        if (sessionStorage.getItem('taskiye_bubble_sound_played') === 'true') {
          return;
        }
        sessionStorage.setItem('taskiye_bubble_sound_played', 'true');
      } catch {
      }

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 — pleasant bell tone
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15); // subtle drop
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02); // soft attack (gain 0.12)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8); // gentle decay
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.8);
        osc.onended = () => ctx.close();
      } catch {
        // Ignore if AudioContext is not supported or blocked
      }
    };

    const dingTimer = setTimeout(playDing, 200);

    return () => {
      clearTimeout(entranceTimer);
      clearTimeout(autoDismissTimer);
      clearTimeout(dingTimer);
    };
  }, [onDismiss]);

  const displayName = user?.name || user?.username || user?.email?.split('@')[0];
  const firstName = displayName ? displayName.split(' ')[0] : null;

  const currentLang = storedLanguage || 'en';

  const handleSelectLanguage = (lang: 'en' | 'so', prompt?: string) => {
    try {
      localStorage.setItem('taskiye_ai_language', lang);
    } catch {
    }
    setStoredLanguage(lang);
    onOpenChat(prompt, lang);
  };

  if (!isVisible) return null;

  const isMobile = position === 'mobile';

  return (
    <div
      className={`z-50 animate-in fade-in slide-in-from-bottom-4 zoom-in-90 duration-500 select-none ${
        isMobile
          ? 'absolute bottom-[calc(100%+0.75rem)] right-0 max-w-[calc(100vw-1.75rem)] w-[20.5rem] filter drop-shadow-2xl'
          : 'fixed bottom-6 left-20 w-84'
      }`}
    >
      <div className="relative p-4 rounded-3xl bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.1] shadow-2xl text-slate-800 dark:text-slate-100 flex flex-col gap-3">
        {/* Header matching the chat popup header styling */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md shrink-0">
              <Bot className="w-4 h-4" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#10192D]" />
            </div>
            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
              {firstName ? (
                currentLang === 'so' ? (
                  `Ku soo dhawoow, ${firstName}! ⚡`
                ) : (
                  `Welcome back, ${firstName}! ⚡`
                )
              ) : currentLang === 'so' ? (
                'Soo dhowow, Marti sharafle! ⚡'
              ) : (
                'Welcome, Guest! ⚡'
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            title="Dismiss greeting"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body content based on whether language has been chosen */}
        {!storedLanguage ? (
          <>
            {/* First time: prompt to choose language */}
            <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
              {firstName
                ? `Hi ${firstName}, I am your Taskiye AI Assistant. Choose your language to get started:`
                : 'I am your Taskiye AI Assistant. Choose your language to explore habits, tasks, and streaks:'}
            </p>

            {/* Language Selection Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() =>
                  handleSelectLanguage('en', 'Hello! How do I get started with Taskiye?')
                }
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <span>🇬🇧</span>
                <span>English</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSelectLanguage('so', 'Asc! Sideen ku bilaabaa Taskiye?')
                }
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-400/15 dark:hover:bg-amber-400/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 dark:border-amber-400/30 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <span>🇸🇴</span>
                <span>Af-Soomaali</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Language already selected: greet directly without language prompt */}
            <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
              {storedLanguage === 'so'
                ? 'Sideen maanta kuugu caawiyaa dhisidda caadooyinkaaga iyo habeynta hawlahaaga?'
                : 'Need help optimizing your daily habits, protecting your streak, or prioritizing tasks?'}
            </p>

            {/* Quick Action Button matching the popup palette */}
            <button
              type="button"
              onClick={() => onOpenChat(undefined, storedLanguage)}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-2xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>
                {storedLanguage === 'so' ? 'Weydii Taskiye AI' : 'Chat with Taskiye AI'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {/* Speech Bubble Pointer Tail (Matching chat popup tail geometry) */}
        {isMobile ? (
          <div
            className="absolute -bottom-2 right-8 w-4 h-4 bg-white dark:bg-[#10192D] border-r border-b border-slate-200 dark:border-white/[0.1] rotate-45 transform pointer-events-none shadow-[2px_2px_4px_rgba(0,0,0,0.06)]"
            aria-hidden="true"
          />
        ) : (
          <div
            className="hidden md:block absolute bottom-5 -left-2 w-4 h-4 bg-white dark:bg-[#10192D] border-l border-b border-slate-200 dark:border-white/[0.1] rotate-45 transform pointer-events-none shadow-[-3px_3px_6px_rgba(0,0,0,0.04)]"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
};
