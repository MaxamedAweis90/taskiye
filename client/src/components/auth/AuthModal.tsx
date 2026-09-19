import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Mail,
  KeyRound,
  User,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Send,
  AlertCircle,
} from 'lucide-react';
import { useTaskiyeStore } from '../../store/useTaskiyeStore';
import { signIn, signUp } from '../../lib/auth-client';
import { validateEmail } from '../../utils/emailValidation';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalTriggerReason,
    authModalInitialMode,
    closeAuthModal,
    tasks: guestTasks,
    habits: guestHabits,
    clearGuestData,
    showToast,
  } = useTaskiyeStore();

  const guestItemCount = (guestTasks?.length || 0) + (guestHabits?.length || 0);

  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPasswordMode, setIsResetPasswordMode] = useState(false);
  const [isAwaitingVerification, setIsAwaitingVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [shouldMigrateGuestData, setShouldMigrateGuestData] = useState(true);

  // Input states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unverifiedEmailForResend, setUnverifiedEmailForResend] = useState<string | null>(null);

  // Countdown timer for email resend cooldown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Check URL parameters for password reset, email verification, or email change callbacks
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const reset = params.get('reset_password');
      const verified = params.get('email_verified');
      const changed = params.get('email_changed');

      if (reset === 'true' && token) {
        setResetToken(token);
        setIsResetPasswordMode(true);
        setIsForgotPassword(false);
        setIsRegister(false);
        setIsAwaitingVerification(false);
        useTaskiyeStore.getState().openAuthModal('manual', 'signin');
      }

      if (verified === 'true') {
        showToast(
          'Email Verified! 🎉',
          'Your email address has been verified. Welcome to Taskiye!',
          'success'
        );
        setIsAwaitingVerification(false);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }

      if (changed === 'true') {
        showToast(
          'Email Changed! 🎉',
          'Your account email address has been updated successfully.',
          'success'
        );
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch (e) {
      console.warn('Could not parse URL query parameters:', e);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAuthModalOpen) {
      if (!isResetPasswordMode) {
        setIsRegister(authModalInitialMode === 'signup');
        setIsForgotPassword(false);
        setIsAwaitingVerification(false);
      }
      setErrorMsg('');
      setSuccessMsg('');
      setPassword('');
      setConfirmPassword('');
      setUnverifiedEmailForResend(null);
      setShouldMigrateGuestData(true);
    }
  }, [isAuthModalOpen, authModalInitialMode, isResetPasswordMode]);

  if (!isAuthModalOpen) return null;

  // Reason description mapping
  const getReasonMessage = () => {
    if (isAwaitingVerification) {
      return 'Activate your account by verifying your email address.';
    }
    if (isResetPasswordMode) {
      return 'Enter a strong new password to restore access to your Taskiye cloud account.';
    }
    if (isForgotPassword) {
      return 'Enter your email address and we will securely dispatch a reset link to your Gmail inbox.';
    }
    switch (authModalTriggerReason) {
      case 'item_limit_reached':
        return 'You have reached the 100-item guest limit. Create an account to unlock unlimited tasks and habits!';
      case 'delete_forbidden':
        return 'To protect your daily streak and progress, deleting items requires a free account.';
      case 'save_global_habits':
        return 'Saving global habit templates to cloud sync requires an authenticated account.';
      default:
        return 'Synchronize habits across devices, access advanced streak matrices, and protect your data.';
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateEmail(email);
    if (!validation.isValid) {
      setErrorMsg(validation.error || 'Please enter a valid email address.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/?reset_password=true`,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send password reset email');
      }

      setSuccessMsg(`Password reset link sent to ${email.trim()}! Please check your Gmail or email inbox.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send password reset email';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify your confirmation password.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: password,
          token: resetToken,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password. The link may have expired.');
      }

      showToast(
        'Password Reset Successfully!',
        'You can now sign in with your new password.',
        'success'
      );
      setIsResetPasswordMode(false);
      setIsForgotPassword(false);
      setIsRegister(false);
      setPassword('');
      setConfirmPassword('');
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationEmail = async (targetEmail: string) => {
    if (!targetEmail || resendCountdown > 0 || isResending) return;
    setIsResending(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail.trim().toLowerCase(),
          callbackURL: `${window.location.origin}/?email_verified=true`,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to resend verification email');
      }

      setSuccessMsg(`Fresh verification link dispatched to ${targetEmail}! Check your inbox.`);
      setResendCountdown(30);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend verification link';
      setErrorMsg(msg);
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isResetPasswordMode) {
      await handleResetPasswordSubmit(e);
      return;
    }

    if (isForgotPassword) {
      await handleForgotPasswordSubmit(e);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setUnverifiedEmailForResend(null);

    const cleanEmail = email.trim().toLowerCase();

    // Validate email syntax and block disposable / fake domains
    const emailValidation = validateEmail(cleanEmail);
    if (!emailValidation.isValid) {
      setErrorMsg(emailValidation.error || 'Please enter a valid, active email address.');
      return;
    }

    // ================= REGISTRATION FLOW =================
    if (isRegister) {
      if (!name.trim()) {
        setErrorMsg('Please enter your name.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify your confirmation password.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters long.');
        return;
      }

      setIsLoading(true);
      try {
        const signupRes = await signUp.email({
          email: cleanEmail,
          password,
          name: name.trim(),
          callbackURL: `${window.location.origin}/?email_verified=true`,
        });

        if (signupRes.error) {
          setErrorMsg(signupRes.error.message || 'Registration failed. Please check credentials.');
          setIsLoading(false);
          return;
        }

        // Migrate guest data if opted-in
        if (shouldMigrateGuestData && guestItemCount > 0) {
          try {
            await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                habits: guestHabits,
                tasks: guestTasks,
              }),
              credentials: 'include',
            });
            clearGuestData();
          } catch (syncErr) {
            console.warn('Could not sync guest data prior to email verification:', syncErr);
          }
        }

        // Transition immediately into dedicated "Verify Your Email" screen
        setRegisteredEmail(cleanEmail);
        setIsAwaitingVerification(true);
        setResendCountdown(30);
        setPassword('');
        setConfirmPassword('');
        setSuccessMsg(`We've dispatched an activation link to ${cleanEmail}!`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Registration failed. Please check credentials.';
        setErrorMsg(msg);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ================= SIGN IN FLOW =================
    setIsLoading(true);
    try {
      const res = await signIn.email({
        email: cleanEmail,
        password,
      });

      if (res?.error) {
        const errMsg = res.error.message || '';
        const isUnverified =
          res.error.code === 'EMAIL_NOT_VERIFIED' ||
          errMsg.toLowerCase().includes('verify') ||
          errMsg.toLowerCase().includes('not verified');

        if (isUnverified) {
          setUnverifiedEmailForResend(cleanEmail);
          setErrorMsg(
            'Your email address is not verified yet. Please check your inbox or click below to resend the verification link.'
          );
        } else {
          setErrorMsg(errMsg || 'Invalid email or password. Please verify credentials.');
        }
        setIsLoading(false);
        return;
      }

      closeAuthModal();
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMsg('');
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: window.location.origin,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google OAuth sign-in failed. Please verify credentials.';
      setErrorMsg(msg);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 dark:bg-[#070D19]/85 backdrop-blur-xl animate-in fade-in duration-200 select-none overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-[#10192D] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_35px_rgba(250,204,21,0.14)] text-slate-900 dark:text-slate-100 overflow-hidden my-auto">
        {/* Ambient gold glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-28 bg-amber-500/10 dark:bg-amber-400/10 blur-3xl pointer-events-none rounded-full" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.06] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ================= AWAITING EMAIL VERIFICATION VIEW ================= */}
        {isAwaitingVerification ? (
          <div className="relative z-10 text-center py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/15 dark:bg-amber-400/15 border border-amber-500/30 dark:border-amber-400/30 flex items-center justify-center text-amber-500 dark:text-amber-400 mb-4 shadow-lg dark:shadow-[0_0_30px_rgba(245,158,11,0.25)] relative">
              <Mail className="w-8 h-8 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-[#10192D]" />
            </div>

            <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 dark:border-amber-400/20 px-3 py-1 rounded-full mb-2">
              Action Required
            </span>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Verify Your Email Address
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-sm mx-auto">
              We've dispatched a secure activation link to:
            </p>

            <div className="my-3 p-3 rounded-2xl bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-white/[0.08] inline-block max-w-full">
              <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 break-all">
                {registeredEmail}
              </span>
            </div>

            <div className="mb-3">
              <button
                type="button"
                onClick={() => {
                  setIsAwaitingVerification(false);
                  setIsRegister(true);
                  setEmail(registeredEmail);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-[11.5px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:underline transition-all cursor-pointer inline-flex items-center gap-1"
              >
                <span>Wrong email? Click here to fix</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto mb-5">
              Please check your Gmail or email inbox and click the link to activate your Taskiye account.
            </p>

            {errorMsg && (
              <div className="mb-3.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs text-center">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mb-3.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs text-center">
                {successMsg}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={resendCountdown > 0 || isResending}
                onClick={() => handleResendVerificationEmail(registeredEmail)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-800 dark:text-white text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-white/[0.08] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isResending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Link...</span>
                  </>
                ) : resendCountdown > 0 ? (
                  <span>Resend link in {resendCountdown}s</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Resend Verification Email</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAwaitingVerification(false);
                  setIsRegister(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="w-full py-2.5 px-4 rounded-xl text-amber-700 dark:text-amber-400 hover:underline text-xs font-bold transition-all cursor-pointer"
              >
                ← Already verified? Sign in
              </button>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed">
              💡 Tip: Check your Spam or Junk folder if the link doesn't arrive within 2 minutes.
            </p>
          </div>
        ) : (
          <>
            {/* Header Icon & Title */}
            <div className="flex flex-col items-center text-center mb-5 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 dark:border-amber-400/25 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3 shadow-sm dark:shadow-[0_0_24px_rgba(250,204,21,0.25)]">
                <Lock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {isResetPasswordMode
                  ? 'Reset Your Password'
                  : isForgotPassword
                    ? 'Forgot Password'
                    : isRegister
                      ? 'Create Your Account'
                      : 'Unlock Taskiye Pro'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-xs">
                {getReasonMessage()}
              </p>
            </div>

            {/* Google OAuth Button */}
            {!isForgotPassword && !isResetPasswordMode && (
              <>
                <button
                  type="button"
                  disabled={isGoogleLoading || isLoading}
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-white dark:hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-slate-200 dark:border-transparent shadow-sm hover:shadow-md dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.15)] relative z-10 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.9l3.7-2.9c-.2-.7-.4-1.4-.4-2.4z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.6 7.5 23.5 12 23.5z"
                    />
                  </svg>
                  <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
                </button>

                {/* Divider */}
                <div className="relative my-4 flex items-center justify-center z-10">
                  <div className="w-full border-t border-slate-200 dark:border-white/[0.08]" />
                  <span className="bg-white dark:bg-[#10192D] px-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    or {isRegister ? 'register with details' : 'sign in with email'}
                  </span>
                </div>
              </>
            )}

            {/* Error Message with optional Resend link */}
            {errorMsg && (
              <div className="mb-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs text-left relative z-10 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="flex-1 leading-relaxed">{errorMsg}</span>
                </div>
                {unverifiedEmailForResend && (
                  <button
                    type="button"
                    disabled={resendCountdown > 0 || isResending}
                    onClick={() => handleResendVerificationEmail(unverifiedEmailForResend)}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-200 text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    <span>
                      {resendCountdown > 0
                        ? `Resend link available in ${resendCountdown}s`
                        : 'Resend Verification Link Now'}
                    </span>
                  </button>
                )}
              </div>
            )}

            {successMsg && (
              <div className="mb-3.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs text-center relative z-10">
                {successMsg}
              </div>
            )}

            {/* Form Inputs */}
            <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
              {/* ================= RESET PASSWORD FORM ================= */}
              {isResetPasswordMode ? (
                <>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      New Password
                    </label>
                    <div className="relative flex items-center">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-white/[0.08] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Confirm New Password
                    </label>
                    <div className="relative flex items-center">
                      <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-white/[0.08] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Updating Password...' : 'Save New Password & Sign In'}
                  </button>
                </>
              ) : isForgotPassword ? (
                /* ================= FORGOT PASSWORD FORM ================= */
                <>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Registered Email Address
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@gmail.com"
                        className="w-full bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-white/[0.08] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Sending Reset Email...' : 'Send Password Reset Link'}
                    <ArrowRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-xs text-amber-700 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </>
              ) : isRegister ? (
                /* ================= REGISTER FORM ================= */
                <>
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Full Name
                    </label>
                    <div className="relative flex items-center">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="w-full bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-white/[0.08] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Email Address (Real Gmail or Email)
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@gmail.com"
                        className="w-full bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-white/[0.08] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Password (min 8 characters)
                    </label>
                    <div className="relative flex items-center">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-white/[0.08] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Confirmation for Password */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <div className="relative flex items-center">
                      <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-white/[0.08] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* ================= SIGN IN FORM ================= */
                <>
                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@gmail.com"
                        className="w-full bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-white/[0.08] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                        className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-50 dark:bg-[#0A101D] border border-slate-200 dark:border-white/[0.08] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Guest Data Migration Option Card (Only during registration) */}
              {!isResetPasswordMode && !isForgotPassword && isRegister && guestItemCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/[0.08] dark:bg-amber-400/[0.08] border border-amber-500/25 dark:border-amber-400/25 space-y-2 mt-3 mb-1">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={shouldMigrateGuestData}
                      onChange={(e) => setShouldMigrateGuestData(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-amber-500/50 dark:border-amber-400/50 bg-white dark:bg-[#0A101D] text-amber-500 dark:text-amber-400 focus:ring-amber-500/30 dark:focus:ring-amber-400/30 accent-amber-500 dark:accent-amber-400 cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                          Import & back up guest data ({guestItemCount} item{guestItemCount === 1 ? '' : 's'})
                        </span>
                        <span className="text-[9px] bg-amber-500/20 dark:bg-amber-400/20 border border-amber-500/30 dark:border-amber-400/30 text-amber-800 dark:text-amber-300 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-normal font-normal">
                        Transfer your local habits, tasks, and streak history directly to your new cloud account.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              {!isResetPasswordMode && !isForgotPassword && (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 dark:from-amber-400 dark:to-amber-500 dark:hover:from-amber-300 dark:hover:to-amber-400 text-slate-950 font-black text-sm shadow-md hover:shadow-lg dark:shadow-[0_0_24px_rgba(250,204,21,0.35)] dark:hover:shadow-[0_0_32px_rgba(250,204,21,0.5)] transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <span>
                        {isRegister
                          ? 'Create Account & Verify Email'
                          : 'Sign In & Access Data'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                    </>
                  )}
                </button>
              )}
            </form>

            {/* Footer switch between Sign In & Register */}
            {!isResetPasswordMode && !isForgotPassword && (
              <div className="mt-4 text-center relative z-10">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isRegister ? 'Already registered?' : "Don't have an account yet?"}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(!isRegister);
                      setErrorMsg('');
                      setSuccessMsg('');
                      setPassword('');
                      setConfirmPassword('');
                    }}
                    className="text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold transition-colors cursor-pointer ml-1"
                  >
                    {isRegister ? 'Log in now' : 'Create account'}
                  </button>
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
                  By continuing, you agree to Taskiye's Terms and Privacy Standard.
                </p>
              </div>
            )}

            {/* Automatic Cloud Sync Note */}
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 relative z-10">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Guest habits & streak data sync automatically</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
