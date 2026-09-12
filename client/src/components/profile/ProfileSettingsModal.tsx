import React, { useState, useRef } from 'react';
import { X, Camera, Phone, CheckCircle2, Shield, Save, ArrowRight, Hash } from 'lucide-react';
import { useSession, authClient } from '../../lib/auth-client';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const { data: session } = useSession();

  const [name, setName] = useState(session?.user?.name || '');
  const [username, setUsername] = useState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session?.user as any)?.username || ''
  );
  const [phoneNumber, setPhoneNumber] = useState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session?.user as any)?.phoneNumber || ''
  );
  const [avatarUrl, setAvatarUrl] = useState(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (session?.user as any)?.avatarUrl || session?.user?.image || ''
  );

  // OTP setup states
  const [otpStep, setOtpStep] = useState<'idle' | 'code_sent' | 'verified'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${session?.user?.id || 'User'}&backgroundColor=10192d`;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users/avatar`,
        {
          method: 'POST',
          body: formData,
          credentials: 'include',
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to upload avatar image');
      }

      setAvatarUrl(json.data.avatarUrl);
      setSuccessMsg('Avatar image updated!');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error uploading avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!phoneNumber.trim()) {
      setErrorMsg('Please enter a phone number first');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsSendingOtp(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = authClient as any;
      if (clientAny.phoneNumber?.sendOtp) {
        await clientAny.phoneNumber.sendOtp({
          phoneNumber: phoneNumber.trim(),
        });
      }
      setOtpStep('code_sent');
      setSuccessMsg(`Verification code sent to ${phoneNumber.trim()}!`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send OTP code');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!otpCode.trim()) {
      setErrorMsg('Please enter the 6-digit code');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsSendingOtp(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientAny = authClient as any;
      if (clientAny.phoneNumber?.verify) {
        await clientAny.phoneNumber.verify({
          phoneNumber: phoneNumber.trim(),
          code: otpCode.trim(),
        });
      }
      setOtpStep('verified');
      setSuccessMsg('Phone number verified & OTP security enabled!');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed. Please check the code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSaving(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users/profile`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            username: username.trim(),
            phoneNumber: phoneNumber.trim(),
          }),
          credentials: 'include',
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to save profile settings');
      }

      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B132B] text-slate-100 flex flex-col justify-between select-none overflow-y-auto animate-in fade-in duration-200">
      {/* Top Bar with Duolingo-style top-left X button */}
      <div className="w-full flex items-center justify-between p-6 sm:px-10">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Close Settings"
        >
          <X className="w-6 h-6 stroke-[2.5]" />
        </button>

        <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
          Profile Settings
        </div>
      </div>

      {/* Centered Main Content Area */}
      <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center">
        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-6 text-center">
          Profile Settings
        </h1>

        {/* User Avatar Circle */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <img
              src={avatarUrl || defaultAvatar}
              alt="Avatar"
              className="w-24 h-24 rounded-full object-cover border-4 border-amber-400/40 shadow-[0_0_24px_rgba(250,204,21,0.25)]"
              onError={(e) => {
                e.currentTarget.src = defaultAvatar;
              }}
            />
            <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all">
              <Camera className="w-6 h-6 text-amber-400 mb-1" />
              <span className="text-[10px] font-bold text-white">Change</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
          />

          <div className="mt-3 text-center">
            <h2 className="text-base font-bold text-white">
              {name || session?.user?.name || 'User'}
            </h2>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wider cursor-pointer"
            >
              {isUploading ? 'Uploading...' : 'Change Avatar'}
            </button>
          </div>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="w-full mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="w-full mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* User Info Form */}
        <form onSubmit={handleSaveProfile} className="w-full space-y-4">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-[#10192D] border border-white/[0.12] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Username (@handle)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full bg-[#10192D] border border-white/[0.12] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              disabled
              value={session?.user?.email || ''}
              className="w-full bg-[#10192D]/60 border border-white/[0.06] rounded-2xl px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
            />
          </div>

          {/* OTP Setup Section */}
          <div className="p-4 rounded-2xl bg-[#10192D] border border-white/[0.1] space-y-3 mt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Phone OTP Security</span>
              </div>
              {otpStep === 'verified' && (
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Enabled
                </span>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                Phone Number (for SMS OTP)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1 flex items-center">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-[#0A101D] border border-white/[0.08] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendPhoneOtp}
                  disabled={isSendingOtp}
                  className="px-4 py-2.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  {isSendingOtp ? 'Sending...' : otpStep === 'code_sent' ? 'Resend OTP' : 'Verify Phone'}
                </button>
              </div>
            </div>

            {otpStep === 'code_sent' && (
              <div className="space-y-1 pt-1">
                <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                  Enter 6-Digit OTP Code
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1 flex items-center">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3.5" />
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full bg-[#0A101D] border border-white/[0.08] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all font-mono tracking-widest"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyPhoneOtp}
                    disabled={isSendingOtp}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-xs font-bold transition-all cursor-pointer shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>Confirm</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm shadow-[0_0_24px_rgba(250,204,21,0.3)] hover:shadow-[0_0_32px_rgba(250,204,21,0.45)] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-wider"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Bottom spacer for balance */}
      <div className="p-4" />
    </div>
  );
};
