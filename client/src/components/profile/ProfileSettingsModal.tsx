import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Camera,
  CheckCircle2,
  Save,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Bell,
  Sun,
  Moon,
  Monitor,
  Mail,
  WifiOff,
} from 'lucide-react';
import { useSession } from '../../lib/auth-client';
import { useThemeStore } from '../../store/useThemeStore';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNotificationPreferences?: () => void;
}

interface ProfileData {
  name: string;
  username: string;
  avatarUrl: string;
}

const initialProfile: ProfileData = {
  name: '',
  username: '',
  avatarUrl: '',
};

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenNotificationPreferences,
}) => {
  const { data: session } = useSession();
  const { theme, setTheme } = useThemeStore();
  const { isOnline } = useOnlineStatus();

  const [initialData, setInitialData] = useState<ProfileData>(initialProfile);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Unsaved changes confirmation dialog
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  // Email verification & Security states
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [hasPassword, setHasPassword] = useState<boolean>(true);
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  // Email change modal states
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPasswordForEmailChange, setCurrentPasswordForEmailChange] = useState('');
  const [isSubmittingEmailChange, setIsSubmittingEmailChange] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState('');
  const [emailChangeSuccess, setEmailChangeSuccess] = useState('');



  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate data when modal opens (from session and directly from MongoDB)
  useEffect(() => {
    if (!isOpen || !session?.user) {
      setShowUnsavedPrompt(false);
      setShowChangeEmailModal(false);
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setShowUnsavedPrompt(false);
    setShowChangeEmailModal(false);
    setEmailChangeError('');
    setEmailChangeSuccess('');

    // Fallback initial values from session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userAny = session?.user as any;
    const baseData: ProfileData = {
      name: userAny?.name || '',
      username: userAny?.username || '',
      avatarUrl: userAny?.avatarUrl || userAny?.image || '',
    };
    setName(baseData.name);
    setUsername(baseData.username);
    setAvatarUrl(baseData.avatarUrl);
    setInitialData(baseData);
    setEmailVerified(Boolean(userAny?.emailVerified));

    // Fetch live data directly from MongoDB backend
    fetch('/api/users/profile', {
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((json) => {
        if (json?.data?.user) {
          const u = json.data.user;
          const liveData: ProfileData = {
            name: u.name || '',
            username: u.username || '',
            avatarUrl: u.avatarUrl || u.image || '',
          };
          setName(liveData.name);
          setUsername(liveData.username);
          setAvatarUrl(liveData.avatarUrl);
          setInitialData(liveData);
          setEmailVerified(Boolean(u.emailVerified));
          setHasPassword(u.hasPassword !== false);
        }
      })
      .catch((err) => {
        console.warn('Failed to load profile directly from server:', err);
      });
  }, [isOpen, session]);

  const handleSendVerificationEmail = async () => {
    setIsSendingVerification(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/users/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to send verification email');
      }
      setSuccessMsg(`Verification email sent to ${session?.user?.email || 'your email'}! Please check your inbox.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send verification email';
      setErrorMsg(msg);
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleSubmitEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailChangeError('Please enter a valid new email address.');
      return;
    }
    if (hasPassword && !currentPasswordForEmailChange) {
      setEmailChangeError('Please enter your current password to confirm.');
      return;
    }

    setEmailChangeError('');
    setEmailChangeSuccess('');
    setIsSubmittingEmailChange(true);

    try {
      const res = await fetch('/api/users/change-email-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          newEmail: newEmail.trim(),
          currentPassword: currentPasswordForEmailChange,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to request email change');
      }
      setEmailChangeSuccess(json.message || `Confirmation link sent to ${newEmail.trim()}!`);
      setTimeout(() => {
        setShowChangeEmailModal(false);
        setNewEmail('');
        setCurrentPasswordForEmailChange('');
        setEmailChangeSuccess('');
        setEmailChangeError('');
        setSuccessMsg(`Confirmation email sent to ${newEmail.trim()}! Please click the link to finalize.`);
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request email change';
      setEmailChangeError(msg);
    } finally {
      setIsSubmittingEmailChange(false);
    }
  };

  // Track if any modifications occurred
  const hasChanges = useMemo(() => {
    return (
      name.trim() !== initialData.name.trim() ||
      username.trim() !== initialData.username.trim() ||
      avatarUrl !== initialData.avatarUrl
    );
  }, [name, username, avatarUrl, initialData]);

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

      const res = await fetch('/api/users/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

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
      const res = await fetch('/api/users/avatar', {
        method: 'DELETE',
        credentials: 'include',
      });

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

  const executeSaveProfile = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSaving(true);

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          avatarUrl: avatarUrl.trim(),
        }),
        credentials: 'include',
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to save profile settings');
      }

      setInitialData({
        name: name.trim(),
        username: username.trim(),
        avatarUrl: avatarUrl.trim(),
      });
      setSuccessMsg('Profile updated successfully!');
      if (session?.user?.id) {
        try {
          localStorage.setItem(`taskiye_profile_completed_${session.user.id}`, 'true');
        } catch {
          // ignore
        }
      }
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
    setAvatarUrl(initialData.avatarUrl);
    setShowUnsavedPrompt(false);
    onClose();
  };

  // Save changes from prompt
  const handleConfirmSaveFromPrompt = async () => {
    setShowUnsavedPrompt(false);
    await executeSaveProfile();
  };

  const isSaveDisabled = !hasChanges || isSaving || !name.trim() || !isOnline;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-[#0B132B] text-slate-900 dark:text-slate-100 flex flex-col justify-between select-none overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom,0px))] animate-in fade-in duration-200">
      {/* Top Bar with Duolingo-style top-left X button */}
      <div className="w-full flex items-center justify-between p-6 sm:px-10 pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={handleAttemptClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Close Settings"
        >
          <X className="w-6 h-6 stroke-[2.5]" />
        </button>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
          Profile Settings
        </div>
      </div>

      {/* Offline Status Warning Banner */}
      {!isOnline && (
        <div className="w-full max-w-md mx-auto px-4 -mt-2 mb-2">
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-medium">
            <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>No Internet Available. Settings changes cannot be saved until you reconnect.</span>
          </div>
        </div>
      )}

      {/* Centered Main Content Area */}
      <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center">
        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-6 text-center">
          Profile Settings
        </h1>

        {/* User Avatar Circle */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="relative group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-4 border-amber-500/30 dark:border-amber-400/40 shadow-sm dark:shadow-[0_0_24px_rgba(250,204,21,0.25)]"
                onError={() => setAvatarUrl('')}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-3xl flex items-center justify-center border-4 border-amber-500/30 dark:border-amber-400/40 shadow-sm dark:shadow-[0_0_24px_rgba(250,204,21,0.25)] select-none">
                {(name || session?.user?.name || username || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all">
              <Camera className="w-6 h-6 text-amber-400 mb-1" />
              <span className="text-[10px] font-bold text-white">
                {avatarUrl ? 'Change' : 'Upload'}
              </span>
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
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {name || session?.user?.name || 'User'}
            </h2>
            <div className="flex items-center gap-3 justify-center mt-1">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors uppercase tracking-wider cursor-pointer"
              >
                {isUploading ? 'Optimizing...' : avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleRemoveAvatar}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="w-full mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs text-center">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="w-full mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* User Info Form */}
        <form onSubmit={handleFormSubmit} className="w-full space-y-4">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.12] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all shadow-sm"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Username (@handle)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.12] focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all shadow-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Email Address
              </label>
              <div className="flex items-center gap-2">
                {emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Verified
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      Unverified
                    </span>
                    <button
                      type="button"
                      disabled={isSendingVerification}
                      onClick={handleSendVerificationEmail}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      {isSendingVerification ? 'Sending...' : 'Verify via Email'}
                    </button>
                  </div>
                )}
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeEmailModal(!showChangeEmailModal);
                    setNewEmail('');
                    setCurrentPasswordForEmailChange('');
                    setEmailChangeError('');
                    setEmailChangeSuccess('');
                  }}
                  className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Change Email
                </button>
              </div>
            </div>
            <input
              type="email"
              disabled
              value={session?.user?.email || ''}
              className="w-full bg-slate-100 dark:bg-[#10192D]/60 border border-slate-200 dark:border-white/[0.06] rounded-2xl px-4 py-3 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
          </div>

          {/* Change Email Drawer Card with Password Confirmation */}
          {showChangeEmailModal && (
            <div className="p-4 rounded-2xl bg-amber-500/[0.06] dark:bg-amber-400/[0.06] border border-amber-500/25 dark:border-amber-400/25 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Change Email Address</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChangeEmailModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                Enter your new email address. To secure your account, please enter your current password to confirm the change.
              </p>

              {emailChangeError && (
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-300 text-xs text-center">
                  {emailChangeError}
                </div>
              )}
              {emailChangeSuccess && (
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-300 text-xs text-center">
                  {emailChangeSuccess}
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new.email@example.com"
                    className="w-full bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.12] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                {hasPassword && (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Current Password (Confirmation)
                    </label>
                    <input
                      type="password"
                      value={currentPasswordForEmailChange}
                      onChange={(e) => setCurrentPasswordForEmailChange(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.12] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowChangeEmailModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingEmailChange || !newEmail.trim()}
                  onClick={handleSubmitEmailChange}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  {isSubmittingEmailChange ? 'Sending Link...' : 'Send Confirmation Email'}
                </button>
              </div>
            </div>
          )}

          {/* Theme / Appearance Selection */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Appearance Theme
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.08] rounded-2xl">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-slate-800 text-white shadow-sm border border-white/10 font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-amber-400" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  theme === 'system'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/10 font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5 text-sky-500" />
                <span>Auto</span>
              </button>
            </div>
          </div>



          {/* Quick Notification Simulator Shortcut */}
          {onOpenNotificationPreferences && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenNotificationPreferences}
                className="w-full p-3.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] hover:border-amber-500/40 dark:hover:border-amber-400/40 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all flex items-center justify-between gap-3 text-left cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-950 dark:group-hover:text-white flex items-center gap-1.5">
                      <span>Test & Simulate Notifications</span>
                      <span className="bg-amber-500/15 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                        TEST LAB
                      </span>
                    </span>
                    <span className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Simulate morning, streak, task, achievement & trash alerts
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors shrink-0" />
              </button>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaveDisabled}
              className={`w-full py-3.5 rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 uppercase tracking-wider ${
                isSaveDisabled
                  ? 'bg-amber-400/20 text-amber-600/40 dark:text-amber-400/40 border border-amber-400/20 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-md dark:shadow-[0_0_24px_rgba(250,204,21,0.3)] hover:brightness-105 cursor-pointer'
              }`}
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
            {hasChanges && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400/80 text-center mt-2 font-medium">
                Unsaved changes detected. Click save to apply.
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Unsaved Changes Confirmation Dialog Modal */}
      {showUnsavedPrompt && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-amber-400/30 p-6 shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(250,204,21,0.15)] flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-400/15 border border-amber-500/20 dark:border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-300 mb-3.5">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Unsaved Changes
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-2 font-normal">
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
                className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 dark:border-rose-500/30 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard Changes</span>
              </button>

              <button
                type="button"
                onClick={() => setShowUnsavedPrompt(false)}
                className="w-full py-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
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
