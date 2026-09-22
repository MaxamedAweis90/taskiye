import React, { useState, useEffect } from 'react';
import { X, Flag, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSession } from '../../lib/auth-client';

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

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<FeedbackType | ''>('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSuccessMsg('');
    setErrorMsg('');
    setMessage('');
    setType('');

    if (session?.user) {
      setName(session.user.name || '');
      setEmail(session.user.email || '');
    } else {
      setName('');
      setEmail('');
    }
  }, [isOpen, session]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

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
    'focus:border-slate-400 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-300/40 dark:focus:ring-white/[0.08]';

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
          title="Close"
        >
          <X className="w-6 h-6 stroke-[2.5]" />
        </button>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
          Send Feedback
        </div>
      </div>

      {/* Centered form content */}
      <div className="w-full max-w-md mx-auto px-4 pb-16 flex flex-col">
        {/* Icon + heading */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.10] flex items-center justify-center mb-4">
            <Flag className="w-6 h-6 text-slate-500 dark:text-slate-400" />
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

          {/* Type dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Type of Feedback
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FeedbackType)}
              className={`${inputClass} appearance-none`}
            >
              <option value="" disabled>Select a type…</option>
              {FEEDBACK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
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
            disabled={isSubmitting || Boolean(successMsg)}
            className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all cursor-pointer
              bg-slate-900 dark:bg-white text-white dark:text-slate-900
              hover:bg-slate-700 dark:hover:bg-slate-100
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
