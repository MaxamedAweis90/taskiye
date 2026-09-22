import React, { useState, useEffect, useRef } from 'react';
import { X, Flag, Lock, CheckCircle2, AlertCircle, ChevronDown, WifiOff } from 'lucide-react';
import { useSession } from '../../lib/auth-client';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = 'bug' | 'ui' | 'feature' | 'account' | 'other';

const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: '🐛 Bug Report' },
  { value: 'ui', label: '🎨 UI / Visual Problem' },
  { value: 'feature', label: '✨ Feature Request' },
  { value: 'account', label: '🔐 Account Issue' },
  { value: 'other', label: '💬 Other' },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const { data: session } = useSession();
  const isAuth = Boolean(session?.user);
  const { isOnline } = useOnlineStatus();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<FeedbackType | ''>('');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSuccessMsg('');
    setErrorMsg('');
    setMessage('');
    setType('');
    setIsTypeDropdownOpen(false);

    if (session?.user) {
      setName(session.user.name || '');
      setEmail(session.user.email || '');
    } else {
      setName('');
      setEmail('');
    }
  }, [isOpen, session]);

  // Close type dropdown when clicking outside
  useEffect(() => {
    if (!isTypeDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setIsTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isTypeDropdownOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isOnline) {
      return setErrorMsg('No Internet Available. Connect to a network to submit feedback.');
    }

    if (!name.trim()) return setErrorMsg('Please enter your name.');
    if (!email.trim() || !email.includes('@')) return setErrorMsg('Please enter a valid email address.');
    if (!type) return setErrorMsg('Please select a feedback type.');
    if (message.trim().length < 10) return setErrorMsg('Message must be at least 10 characters.');
    if (message.trim().length > 2000) return setErrorMsg('Message must be under 2000 characters.');

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), type, message: message.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Something went wrong.');
      setSuccessMsg('Thanks! We received your feedback and will look into it.');
      setTimeout(() => onClose(), 2200);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl text-sm font-medium transition-all outline-none ' +
    'bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.10] ' +
    'text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 ' +
    'focus:border-amber-500/50 dark:focus:border-amber-400/50 focus:ring-2 focus:ring-amber-500/15';

  const readOnlyClass =
    'w-full px-4 py-3 rounded-xl text-sm font-medium ' +
    'bg-slate-100/60 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06] ' +
    'text-slate-500 dark:text-slate-400 cursor-not-allowed select-none';

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-[#0B132B] text-slate-900 dark:text-slate-100 flex flex-col overflow-y-auto animate-in fade-in duration-200">
      {/* Top bar — X left, title right (matches ProfileSettingsModal) */}
      <div className="w-full flex items-center justify-between p-6 sm:px-10 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Close Feedback"
        >
          <X className="w-6 h-6 stroke-[2.5]" />
        </button>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
          Feedback & Bug Report
        </div>
      </div>

      {/* Offline Status Warning Banner */}
      {!isOnline && (
        <div className="w-full max-w-lg mx-auto px-4 -mt-2 mb-2">
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-medium">
            <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>No Internet Available. Connect to a network to submit feedback.</span>
          </div>
        </div>
      )}

      {/* Centered form content */}
      <div className="w-full max-w-md mx-auto px-4 pb-16 flex flex-col">
        {/* Icon + heading */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 flex items-center justify-center mb-4">
            <Flag className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Report a Problem
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
            Found a bug or have a suggestion? Tell us — we read everything.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Name
            </label>
            {isAuth ? (
              <div className="relative">
                <input value={name} readOnly className={readOnlyClass} />
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
              </div>
            ) : (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className={inputClass}
              />
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Email
            </label>
            {isAuth ? (
              <div className="relative">
                <input value={email} readOnly className={readOnlyClass} />
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
              </div>
            ) : (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
                className={inputClass}
              />
            )}
          </div>

          {/* Type dropdown — custom accessible dark mode select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Type of Feedback
            </label>
            <div ref={dropdownContainerRef} className="relative">
              <button
                type="button"
                onClick={() => setIsTypeDropdownOpen((prev) => !prev)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all outline-none flex items-center justify-between text-left cursor-pointer
                  bg-slate-100 dark:bg-white/[0.06] border ${
                    isTypeDropdownOpen
                      ? 'border-amber-500/60 dark:border-amber-400/60 ring-2 ring-amber-500/15'
                      : 'border-slate-200 dark:border-white/[0.10]'
                  }`}
              >
                <span className={type ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500'}>
                  {type ? FEEDBACK_TYPES.find((t) => t.value === type)?.label : 'Select a type…'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isTypeDropdownOpen ? 'rotate-180 text-amber-500 dark:text-amber-400' : ''
                  }`}
                />
              </button>

              {isTypeDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 p-1.5 rounded-2xl bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.12] shadow-2xl z-50 animate-in fade-in duration-150 flex flex-col gap-1">
                  {FEEDBACK_TYPES.map((t) => {
                    const isSelected = type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          setType(t.value);
                          setIsTypeDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 dark:border-amber-400/30'
                            : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Message textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Message
              </label>
              <span className={`text-xs tabular-nums ${message.length > 1800 ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {message.length}/2000
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue or idea in detail…"
              rows={5}
              maxLength={2000}
              className={`${inputClass} resize-none leading-relaxed`}
            />
          </div>

          {/* Feedback state messages */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2.5 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || Boolean(successMsg) || !isOnline}
            className="w-full py-3.5 rounded-xl text-sm font-extrabold tracking-wide transition-all cursor-pointer
              bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950
              shadow-md dark:shadow-[0_0_24px_rgba(250,204,21,0.25)] hover:brightness-105
              disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-[0.98]"
          >
            {isSubmitting ? 'Sending…' : successMsg ? 'Sent ✓' : 'Send Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
};
