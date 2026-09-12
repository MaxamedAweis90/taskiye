import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, KeyRound, User, ArrowRight, CheckCircle2, Phone, Hash, ShieldCheck } from 'lucide-react';
import { useTaskiyeStore } from '../../store/useTaskiyeStore';
import { signIn, signUp, authClient } from '../../lib/auth-client';

type LoginMethod = 'email' | 'phone_otp';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalTriggerReason, authModalInitialMode, closeAuthModal } = useTaskiyeStore();

  const [isRegister, setIsRegister] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');

  // Input states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthModalOpen) {
      setIsRegister(authModalInitialMode === 'signup');
      setErrorMsg('');
      setSuccessMsg('');
      setOtpSent(false);
      setOtpCode('');
      setPassword('');
      setConfirmPassword('');
    }
  }, [isAuthModalOpen, authModalInitialMode]);

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
        return 'Synchronize habits across devices, access advanced streak matrices, and protect your data.';
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!phoneNumber.trim()) {
      setErrorMsg('Please enter your phone number first.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = authClient as any;
      if (clientAny.phoneNumber?.sendOtp) {
        await clientAny.phoneNumber.sendOtp({
          phoneNumber: phoneNumber.trim(),
        });
      }
      setOtpSent(true);
      setSuccessMsg(`6-digit passcode sent to ${phoneNumber.trim()}! Enter it below.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP passcode';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validation for Registration
    if (isRegister) {
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
        await signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.split('@')[0],
        });
        closeAuthModal();
        window.location.reload();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Registration failed. Please check credentials.';
        setErrorMsg(msg);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Login logic
    setIsLoading(true);
    try {
      if (loginMethod === 'email') {
        await signIn.email({
          email: email.trim(),
          password,
        });
      } else if (loginMethod === 'phone_otp') {
        if (!otpSent) {
          await handleSendPhoneOtp();
          return;
        }

        if (!otpCode.trim()) {
          setErrorMsg('Please enter the 6-digit passcode sent to your phone.');
          setIsLoading(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clientAny = authClient as any;
        if (clientAny.phoneNumber?.verify) {
          await clientAny.phoneNumber.verify({
            phoneNumber: phoneNumber.trim(),
            code: otpCode.trim(),
          });
        } else if (clientAny.signIn?.phoneNumber) {
          await clientAny.signIn.phoneNumber({
            phoneNumber: phoneNumber.trim(),
            code: otpCode.trim(),
          });
        }
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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070D19]/85 backdrop-blur-xl animate-in fade-in duration-200 select-none overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-[#10192D]/98 backdrop-blur-2xl border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_35px_rgba(250,204,21,0.14)] text-slate-100 overflow-hidden my-auto">
        {/* Ambient gold glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-28 bg-amber-400/10 blur-3xl pointer-events-none rounded-full" />

        {/* Close Button */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.06] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center mb-5 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 mb-3 shadow-[0_0_24px_rgba(250,204,21,0.25)]">
            <Lock className="w-5 h-5 stroke-[2.2]" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isRegister ? 'Create Your Account' : 'Unlock Taskiye Pro'}
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-xs">
            {getReasonMessage()}
          </p>
        </div>

        {/* 1. Google OAuth Button at TOP */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_16px_rgba(255,255,255,0.15)] relative z-10 hover:scale-[1.01] active:scale-[0.99]"
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
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center z-10">
          <div className="w-full border-t border-white/[0.08]" />
          <span className="bg-[#10192D] px-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            or {isRegister ? 'register with details' : 'sign in with'}
          </span>
        </div>

        {/* 2. Login Toggle: Email vs Passcode (OTP) */}
        {!isRegister && (
          <div className="p-1 rounded-2xl bg-[#0A101D] border border-white/[0.08] grid grid-cols-2 gap-1 mb-4 relative z-10">
            <button
              type="button"
              onClick={() => {
                setLoginMethod('email');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                loginMethod === 'email'
                  ? 'bg-[#152033] text-white shadow-sm border border-white/[0.1]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('phone_otp');
                setErrorMsg('');
                setSuccessMsg('');
                setOtpSent(false);
              }}
              className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                loginMethod === 'phone_otp'
                  ? 'bg-[#152033] text-white shadow-sm border border-white/[0.1]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Passcode (OTP)
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-3.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center relative z-10">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-3.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center relative z-10">
            {successMsg}
          </div>
        )}

        {/* 3. Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
          {/* ================= REGISTER FORM ================= */}
          {isRegister ? (
            <>
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  User Name
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full bg-[#0A101D] border border-white/[0.08] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex.rivera@example.com"
                    className="w-full bg-[#0A101D] border border-white/[0.08] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#0A101D] border border-white/[0.08] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              {/* Confirmation for Password */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative flex items-center">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#0A101D] border border-white/[0.08] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>
            </>
          ) : (
            /* ================= LOGIN FORM ================= */
            <>
              {loginMethod === 'email' ? (
                <>
                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex.rivera@example.com"
                        className="w-full bg-[#0A101D] border border-white/[0.08] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Secret Key / Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginMethod('phone_otp');
                          setErrorMsg('');
                        }}
                        className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        Use OTP instead?
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-[#0A101D] border border-white/[0.08] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Phone Number + 6-digit OTP passcode flow */
                <>
                  {!otpSent ? (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Phone Number
                      </label>
                      <div className="relative flex items-center">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5" />
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="w-full bg-[#0A101D] border border-white/[0.08] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        We'll send a 6-digit one-time passcode to this phone number.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-between text-xs">
                        <span className="text-slate-300">Code sent to: <b className="text-white">{phoneNumber}</b></span>
                        <button
                          type="button"
                          onClick={() => setOtpSent(false)}
                          className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                        >
                          Change
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            Enter 6-Digit Passcode
                          </label>
                          <button
                            type="button"
                            onClick={handleSendPhoneOtp}
                            disabled={isLoading}
                            className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            Resend Code
                          </button>
                        </div>
                        <div className="relative flex items-center">
                          <Hash className="w-4 h-4 text-slate-400 absolute left-3.5" />
                          <input
                            type="text"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            placeholder="123456"
                            className="w-full bg-[#0A101D] border border-white/[0.08] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all tracking-widest font-mono text-center text-lg"
                            required
                            autoFocus
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm shadow-[0_0_24px_rgba(250,204,21,0.35)] hover:shadow-[0_0_32px_rgba(250,204,21,0.5)] transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span>Processing...</span>
            ) : !isRegister && loginMethod === 'phone_otp' && !otpSent ? (
              <>
                <span>Send 6-Digit Passcode</span>
                <ArrowRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              </>
            ) : (
              <>
                <span>
                  {isRegister
                    ? 'Create Account & Sync Habits'
                    : 'Sign In & Access Data'}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Footer switch between Sign In & Register */}
        <div className="mt-4 text-center relative z-10">
          <p className="text-xs text-slate-400">
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
              className="text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer ml-1"
            >
              {isRegister ? 'Log in now' : 'Create account'}
            </button>
          </p>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            By continuing, you agree to Taskiye's Terms and Privacy Standard.
          </p>
        </div>

        {/* Automatic Cloud Sync Note */}
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-center gap-1.5 text-[11px] text-slate-400 relative z-10">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Guest habits & streak data sync automatically</span>
        </div>
      </div>
    </div>
  );
};
