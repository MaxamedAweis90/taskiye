import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Flame,
  CheckCircle2,
  Save,
  Volume2,
  Clock,
  ShieldAlert,
  Send,
  Sparkles,
} from 'lucide-react';
import { useTaskiyeStore } from '../../store/useTaskiyeStore';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationPrefs {
  dailyReminders: boolean;
  streakAlerts: boolean;
  dailyCadenceDigest: boolean;
  completionChimes: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  dailyReminders: true,
  streakAlerts: true,
  dailyCadenceDigest: true,
  completionChimes: true,
};

const STORAGE_KEY = 'taskiye_notification_preferences';

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { showToast } = useTaskiyeStore();
  const {
    isSupported,
    permission,
    isSubscribed,
    subscribe,
    sendTestAlert,
    playCelebrationChime,
  } = usePushNotifications();

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [initialPrefs, setInitialPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSuccessMsg('');
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPrefs(parsed);
        setInitialPrefs(parsed);
      } else {
        setPrefs(DEFAULT_PREFS);
        setInitialPrefs(DEFAULT_PREFS);
      }
    } catch {
      setPrefs(DEFAULT_PREFS);
      setInitialPrefs(DEFAULT_PREFS);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasChanges = JSON.stringify(prefs) !== JSON.stringify(initialPrefs);

  const handleToggle = (key: keyof NotificationPrefs) => {
    const nextVal = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: nextVal }));

    // Preview chime when audio toggle is turned ON
    if (key === 'completionChimes' && nextVal) {
      playCelebrationChime();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMsg('');

    try {
      // 1. Save local preferences
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setInitialPrefs(prefs);

      // 2. If any push alert is active and push is supported, ensure device is registered
      const hasAnyPush = prefs.dailyReminders || prefs.streakAlerts || prefs.dailyCadenceDigest;
      if (hasAnyPush && isSupported) {
        await subscribe({
          dailyReminders: prefs.dailyReminders,
          streakAlerts: prefs.streakAlerts,
          dailyCadenceDigest: prefs.dailyCadenceDigest,
        });
      }

      setSuccessMsg('Notification preferences updated and synced!');
      showToast('Preferences Saved', 'Your alert preferences and push subscription have been saved.', 'success');

      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 600);
    } catch {
      setIsSaving(false);
      setSuccessMsg('Preferences saved locally.');
      setTimeout(() => onClose(), 600);
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      // Ensure subscription first
      if (!isSubscribed) {
        const ok = await subscribe({
          dailyReminders: prefs.dailyReminders,
          streakAlerts: prefs.streakAlerts,
          dailyCadenceDigest: prefs.dailyCadenceDigest,
        });
        if (!ok) {
          showToast('Permission Needed', 'Please allow notifications in your browser prompt.', 'info');
          setIsTesting(false);
          return;
        }
      }

      const delivered = await sendTestAlert();
      if (delivered) {
        showToast('Alert Sent! 🔥', 'Check your device lock screen or notification center.', 'success');
      } else {
        // Fallback local notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Taskiye Connected! 🔥', {
            body: 'Push notifications are active on this device.',
            icon: '/logo.png',
          });
          showToast('Alert Sent! 🔥', 'Check your device notification center.', 'success');
        } else {
          showToast('Notice', 'Notification permissions are currently blocked or pending in your browser.', 'info');
        }
      }
    } catch (err) {
      console.warn('Test alert failed:', err);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B132B] text-slate-100 flex flex-col justify-between select-none overflow-y-auto animate-in fade-in duration-200">
      {/* Top Bar matching ProfileSettingsModal */}
      <div className="w-full flex items-center justify-between p-6 sm:px-10 pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Close Preferences"
        >
          <X className="w-6 h-6 stroke-[2.5]" />
        </button>

        <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
          Notification Preferences
        </div>
      </div>

      {/* Centered Main Content Area */}
      <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center">
        {/* Header Icon & Title */}
        <div className="w-16 h-16 rounded-3xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_20px_rgba(250,204,21,0.2)]">
          <Bell className="w-8 h-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2 text-center">
          Notification Alerts
        </h1>
        <p className="text-xs text-slate-400 text-center mb-6 max-w-xs">
          Customize when and how Taskiye reminds you of your daily routines, tasks, and streaks.
        </p>

        {successMsg && (
          <div className="w-full mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Preference Settings Cards */}
        <div className="w-full flex flex-col gap-3">
          {/* Setting 1: Daily Habit Reminders */}
          <div className="p-4 rounded-2xl bg-[#10192D] border border-white/[0.08] hover:border-white/[0.15] transition-all flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Daily Habit Reminders</span>
                <span className="text-xs text-slate-400 mt-0.5">
                  Morning alerts for habits scheduled on today's cadence
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('dailyReminders')}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                prefs.dailyReminders ? 'bg-[#FACC15]' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-slate-950 transition-transform ${
                  prefs.dailyReminders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Setting 2: Streak Protection Warning */}
          <div className="p-4 rounded-2xl bg-[#10192D] border border-white/[0.08] hover:border-white/[0.15] transition-all flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                <Flame className="w-4 h-4 fill-rose-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Streak Society Alerts</span>
                <span className="text-xs text-slate-400 mt-0.5">
                  High-priority warning when your active streak is at risk
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('streakAlerts')}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                prefs.streakAlerts ? 'bg-[#FACC15]' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-slate-950 transition-transform ${
                  prefs.streakAlerts ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Setting 3: Evening Cadence Digest */}
          <div className="p-4 rounded-2xl bg-[#10192D] border border-white/[0.08] hover:border-white/[0.15] transition-all flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Evening Cadence Digest</span>
                <span className="text-xs text-slate-400 mt-0.5">
                  Summary review of remaining tasks before midnight rollover
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('dailyCadenceDigest')}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                prefs.dailyCadenceDigest ? 'bg-[#FACC15]' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-slate-950 transition-transform ${
                  prefs.dailyCadenceDigest ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Setting 4: Audio Completion Chimes */}
          <div className="p-4 rounded-2xl bg-[#10192D] border border-white/[0.08] hover:border-white/[0.15] transition-all flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <Volume2 className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Audio & Haptic Feedback</span>
                <span className="text-xs text-slate-400 mt-0.5">
                  Play celebration chime when completing items
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('completionChimes')}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                prefs.completionChimes ? 'bg-[#FACC15]' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-slate-950 transition-transform ${
                  prefs.completionChimes ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Send Instant Test Notification Action */}
        <div className="w-full mt-5">
          <button
            type="button"
            disabled={isTesting}
            onClick={handleTestNotification}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-400/10 hover:bg-amber-400/15 border border-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            {isTesting ? (
              <span>Sending test alert...</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send Test Alert to This Device</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </>
            )}
          </button>
          {permission === 'denied' && (
            <p className="text-[11px] text-rose-400 text-center mt-2">
              Notifications are currently blocked in your browser settings. Click your browser lock icon to allow.
            </p>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar matching ProfileSettingsModal */}
      <div className="w-full border-t border-white/[0.08] p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-[#0B132B]/80 backdrop-blur-xl">
        <div className="w-full max-w-md mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!hasChanges || isSaving}
            onClick={handleSave}
            className={`w-full py-3.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !hasChanges || isSaving
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/[0.04]'
                : 'bg-[#FACC15] hover:bg-[#EAB308] text-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:scale-[1.01] active:scale-[0.99]'
            }`}
          >
            <Save className="w-4 h-4 stroke-[2.5]" />
            <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
