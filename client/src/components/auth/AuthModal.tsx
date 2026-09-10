import React, { useState } from 'react';
import { X, Lock, Mail, KeyRound, Sparkles } from 'lucide-react';
import { useTaskiyeStore } from '../../store/useTaskiyeStore';
import { signIn, signUp } from '../../lib/auth-client';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalTriggerReason, closeAuthModal } = useTaskiyeStore();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  // Reason description mapping per specifications
  const getReasonMessage = () => {
    switch (authModalTriggerReason) {
      case 'item_limit_reached':
        return 'You have reached the 100-item guest limit. Create an account to unlock unlimited tasks and habits!';
      case 'delete_forbidden':
        return 'To protect your daily streak and progress, deleting items requires a free account.';
      case 'save_global_habits':
        return 'Saving global habit templates to cloud sync requires an authenticated account.';
      default:
        return 'Sign in or create your free account to sync habits, tasks, and streaks across all your devices.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (isRegister) {
        await signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split('@')[0],
        });
      } else {
        await signIn.email({
          email: email.trim(),
          password,
        });
      }
      closeAuthModal();
      window.location.reload(); // Refresh session state
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please check credentials.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: window.location.origin,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google OAuth failed';
      setErrorMsg(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#1E293B] border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-slate-100">
        {/* Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mb-3 shadow-[0_0_20px_-2px_rgba(250,204,21,0.3)]">
            <Lock className="w-5 h-5 stroke-[2.2]" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isRegister ? 'Create Your Account' : 'Welcome to Taskiye'}
          </h2>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-xs">
            {getReasonMessage()}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
            {errorMsg}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegister && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="w-full bg-[#162032] border border-[#334155] focus:border-amber-400/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/30 transition-colors"
                required={isRegister}
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#162032] border border-[#334155] focus:border-amber-400/60 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/30 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#162032] border border-[#334155] focus:border-amber-400/60 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/30 transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-[0_0_20px_-3px_rgba(250,204,21,0.4)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5 flex items-center justify-center">
          <div className="w-full border-t border-white/[0.08]" />
          <span className="bg-[#1E293B] px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            or
          </span>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full py-2.5 rounded-full bg-[#162032] hover:bg-[#243248] border border-white/[0.08] hover:border-white/20 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Continue with Google</span>
        </button>

        {/* Toggle Mode */}
        <div className="mt-5 text-center text-xs text-slate-400">
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg('');
            }}
            className="text-amber-400 hover:text-amber-300 font-bold underline transition-colors"
          >
            {isRegister ? 'Sign In' : 'Sign Up Free'}
          </button>
        </div>
      </div>
    </div>
  );
};
