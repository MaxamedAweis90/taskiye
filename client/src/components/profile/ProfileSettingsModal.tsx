import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Camera,
  Phone,
  CheckCircle2,
  Shield,
  Save,
  ArrowRight,
  Hash,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useSession, authClient } from '../../lib/auth-client';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileData {
  name: string;
  username: string;
  phoneNumber: string;
  avatarUrl: string;
}

const initialProfile: ProfileData = {
  name: '',
  username: '',
  phoneNumber: '',
  avatarUrl: '',
};

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const { data: session } = useSession();

  const [initialData, setInitialData] = useState<ProfileData>(initialProfile);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Unsaved changes confirmation dialog
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  // OTP setup states
  const [otpStep, setOtpStep] = useState<'idle' | 'code_sent' | 'verified'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate data when modal opens (from session and directly from MongoDB)
  useEffect(() => {
    if (!isOpen) {
      setShowUnsavedPrompt(false);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setShowUnsavedPrompt(false);
    setOtpStep('idle');
    setOtpCode('');

    // Fallback initial values from session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userAny = session?.user as any;
    const baseData: ProfileData = {
      name: userAny?.name || '',
      username: userAny?.username || '',
      phoneNumber: userAny?.phoneNumber || '',
      avatarUrl: userAny?.avatarUrl || userAny?.image || '',
    };
    setName(baseData.name);
    setUsername(baseData.username);
    setPhoneNumber(baseData.phoneNumber);
    setAvatarUrl(baseData.avatarUrl);
    setInitialData(baseData);

    // Fetch live data directly from MongoDB backend
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users/profile`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((json) => {
        if (json?.data?.user) {
          const u = json.data.user;
          const liveData: ProfileData = {
            name: u.name || '',
            username: u.username || '',
            phoneNumber: u.phoneNumber || '',
            avatarUrl: u.avatarUrl || u.image || '',
          };
          setName(liveData.name);
          setUsername(liveData.username);
          setPhoneNumber(liveData.phoneNumber);
          setAvatarUrl(liveData.avatarUrl);
          setInitialData(liveData);
        }
      })
      .catch((err) => {
        console.warn('Failed to load profile directly from server:', err);
      });
  }, [isOpen, session]);

  // Track if any modifications occurred
  const hasChanges = useMemo(() => {
    return (
      name.trim() !== initialData.name.trim() ||
      username.trim() !== initialData.username.trim() ||
      phoneNumber.trim() !== initialData.phoneNumber.trim() ||
      avatarUrl !== initialData.avatarUrl
    );
  }, [name, username, phoneNumber, avatarUrl, initialData]);

  // Handle ESC key to safely intercept close attempts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showUnsavedPrompt) {
          setShowUnsavedPrompt(false);
        } else if (hasChanges) {
          setShowUnsavedPrompt(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasChanges, showUnsavedPrompt, onClose]);

  if (!isOpen) return null;

  const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${
    session?.user?.id || 'User'
  }&backgroundColor=10192d`;

/**
 * Resize and compress user avatar image to a 400x400 WebP blob
 * using browser HTML5 canvas to optimize upload speed and Vercel storage bandwidth.
 */
function compressAvatarImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 400;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Center crop 1:1 aspect ratio
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/webp',
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');
    setIsUploading(true);

    try {
      // 1. Client-side canvas compression to 400x400 WebP (cuts payload from ~5MB to ~35KB)
      const compressedBlob = await compressAvatarImage(file);

      const formData = new FormData();
      formData.append('avatar', compressedBlob, 'avatar.webp');

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
      setSuccessMsg('Avatar image uploaded & compressed (WebP)!');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error uploading avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatarUrl) return;
    setErrorMsg('');
    setSuccessMsg('');
    setIsUploading(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users/avatar`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to remove avatar');
      }

      setAvatarUrl('');
      setSuccessMsg('Custom avatar removed');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error removing avatar');
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

  const executeSaveProfile = async () => {
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
            avatarUrl: avatarUrl.trim(),
          }),
          credentials: 'include',
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to save profile settings');
      }

      setInitialData({
        name: name.trim(),
        username: username.trim(),
        phoneNumber: phoneNumber.trim(),
        avatarUrl: avatarUrl.trim(),
      });
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || isSaving) return;
    await executeSaveProfile();
  };

  // Close attempt handler
  const handleAttemptClose = () => {
    if (hasChanges) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  };

  // Discard changes & force exit without saving
  const handleDiscardChanges = () => {
    setName(initialData.name);
    setUsername(initialData.username);
    setPhoneNumber(initialData.phoneNumber);
    setAvatarUrl(initialData.avatarUrl);
    setShowUnsavedPrompt(false);
    onClose();
  };

  // Save changes from prompt
  const handleConfirmSaveFromPrompt = async () => {
    setShowUnsavedPrompt(false);
    await executeSaveProfile();
  };

  const isSaveDisabled = !hasChanges || isSaving || !name.trim();

  return (
    <div className="fixed inset-0 z-50 bg-[#0B132B] text-slate-100 flex flex-col justify-between select-none overflow-y-auto animate-in fade-in duration-200">
      {/* Top Bar with Duolingo-style top-left X button */}
      <div className="w-full flex items-center justify-between p-6 sm:px-10">
        <button
          type="button"
          onClick={handleAttemptClose}
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
          <div
            className="relative group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
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
            <div className="flex items-center gap-3 justify-center mt-1">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wider cursor-pointer"
              >
                {isUploading ? 'Optimizing...' : 'Change Avatar'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleRemoveAvatar}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
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
        <form onSubmit={handleFormSubmit} className="w-full space-y-4">
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
              disabled={isSaveDisabled}
              className={`w-full py-3.5 rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
                isSaveDisabled
                  ? 'bg-amber-400/20 text-amber-400/40 border border-amber-400/20 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-[0_0_24px_rgba(250,204,21,0.3)] hover:shadow-[0_0_32px_rgba(250,204,21,0.45)] cursor-pointer'
              }`}
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
            {hasChanges && (
              <p className="text-[11px] text-amber-400/80 text-center mt-2 font-medium">
                Unsaved changes detected. Click save to apply.
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Unsaved Changes Confirmation Dialog Modal */}
      {showUnsavedPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-[#0F172A] border border-amber-400/30 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(250,204,21,0.15)] flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-300 mb-3.5">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-100 tracking-tight">
              Unsaved Changes
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mt-2 font-normal">
              You have unsaved modifications to your profile. Would you like to save your changes or discard them?
            </p>

            <div className="w-full mt-6 space-y-2">
              <button
                type="button"
                onClick={handleConfirmSaveFromPrompt}
                disabled={isSaving}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:brightness-110 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>

              <button
                type="button"
                onClick={handleDiscardChanges}
                className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard Changes</span>
              </button>

              <button
                type="button"
                onClick={() => setShowUnsavedPrompt(false)}
                className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacer for balance */}
      <div className="p-4" />
    </div>
  );
};
