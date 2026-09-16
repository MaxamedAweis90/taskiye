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
  Target,
} from 'lucide-react';
import { useTaskiyeStore } from '../../store/useTaskiyeStore';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationPrefs {
  dailyReminders: boolean;
  morningReminderTime: string;
  taskPlanningReminder: boolean;
  taskPlanningTime: string;
  streakAlerts: boolean;
  dailyCadenceDigest: boolean;
  completionChimes: boolean;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dailyReminders: true,
  morningReminderTime: '08:00',
  taskPlanningReminder: true,
  taskPlanningTime: '09:00',
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

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [initialPrefs, setInitialPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
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
        const merged: NotificationPrefs = {
          ...DEFAULT_NOTIFICATION_PREFS,
          ...parsed,
        };
        setPrefs(merged);
        setInitialPrefs(merged);
      } else {
        setPrefs(DEFAULT_NOTIFICATION_PREFS);
        setInitialPrefs(DEFAULT_NOTIFICATION_PREFS);
      }
    } catch {
      setPrefs(DEFAULT_NOTIFICATION_PREFS);
      setInitialPrefs(DEFAULT_NOTIFICATION_PREFS);
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

  const handleTimeChange = (key: 'morningReminderTime' | 'taskPlanningTime', value: string) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMsg('');

    try {
      // 1. Save local preferences
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setInitialPrefs(prefs);

      // 2. If any push alert is active and push is supported, ensure device is registered
      const hasAnyPush =
        prefs.dailyReminders ||
        prefs.taskPlanningReminder ||
        prefs.streakAlerts ||
        prefs.dailyCadenceDigest;

      if (hasAnyPush && isSupported) {
        await subscribe({
          dailyReminders: prefs.dailyReminders,
          morningReminderTime: prefs.morningReminderTime,
          taskPlanningReminder: prefs.taskPlanningReminder,
          taskPlanningTime: prefs.taskPlanningTime,
          streakAlerts: prefs.streakAlerts,
          dailyCadenceDigest: prefs.dailyCadenceDigest,
          completionChimes: prefs.completionChimes,
        });
      }

      setSuccessMsg('Notification preferences updated and synced!');
      showToast(
        'Preferences Saved',
        'Your alert preferences and push subscription have been saved.',
        'success'
      );

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
          morningReminderTime: prefs.morningReminderTime,
          taskPlanningReminder: prefs.taskPlanningReminder,
          taskPlanningTime: prefs.taskPlanningTime,
          streakAlerts: prefs.streakAlerts,
          dailyCadenceDigest: prefs.dailyCadenceDigest,
          completionChimes: prefs.completionChimes,
        });
        if (!ok) {
          showToast('Permission Needed', 'Please allow notifications in your browser prompt.', 'info');
          setIsTesting(false);
          return;
        }
      }

      const delivered = await sendTestAlert();
      if (delivered) {
        showToast('Alert Sent! 🔥', 'Check your device lock screen and in-app notification bell.', 'success');
      } else {
        // Fallback local notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Taskiye Connected! 🔥', {
            body: 'Push notifications are active on this device.',
            icon: '/logo-tight.png',
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
          {/* Setting 1: Plan Today's Priorities (NEW - User Requested) */}
          <div className="p-4 rounded-2xl bg-[#10192D] border border-amber-400/30 hover:border-amber-400/50 transition-all flex flex-col gap-3 shadow-[0_0_16px_rgba(250,204,21,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 shadow-sm">
                  <Target className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Plan Today's Priorities</span>
                    <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                      New
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-0.5">
                    Timely reminder to plan and organize your daily focus tasks
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggle('taskPlanningReminder')}
                className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                  prefs.taskPlanningReminder ? 'bg-[#FACC15]' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full bg-slate-950 transition-transform ${
                    prefs.taskPlanningReminder ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Time Selector Dropdown */}
            {prefs.taskPlanningReminder && (
              <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between">
                <span className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Preferred Reminder Time
                </span>
                <select
                  value={prefs.taskPlanningTime}
                  onChange={(e) => handleTimeChange('taskPlanningTime', e.target.value)}
                  className="bg-[#151D33] border border-white/[0.12] hover:border-amber-400/50 focus:border-amber-400 rounded-xl px-2.5 py-1 text-xs font-semibold text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                >
                  <option value="07:00">07:00 AM</option>
                  <option value="08:00">08:00 AM</option>
                  <option value="09:00">09:00 AM (Recommended)</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="13:00">01:00 PM</option>
                  <option value="18:00">06:00 PM (Tomorrow prep)</option>
                  <option value="20:00">08:00 PM</option>
                </select>
              </div>
            )}
          </div>

          {/* Setting 2: Daily Habit Reminders */}
          <div className="p-4 rounded-2xl bg-[#10192D] border border-white/[0.08] hover:border-white/[0.15] transition-all flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
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

            {/* Time Selector Dropdown */}
            {prefs.dailyReminders && (
              <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between">
                <span className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Morning Cadence Time
                </span>
                <select
                  value={prefs.morningReminderTime}
                  onChange={(e) => handleTimeChange('morningReminderTime', e.target.value)}
                  className="bg-[#151D33] border border-white/[0.12] hover:border-amber-400/50 focus:border-amber-400 rounded-xl px-2.5 py-1 text-xs font-semibold text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                >
                  <option value="06:00">06:00 AM (Early bird)</option>
                  <option value="07:00">07:00 AM</option>
                  <option value="08:00">08:00 AM (Default)</option>
                  <option value="09:00">09:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                </select>
              </div>
            )}
          </div>

          {/* Setting 3: Streak Protection Warning */}
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

          {/* Setting 4: Evening Cadence Digest */}
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

          {/* Setting 5: Audio Completion Chimes */}
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
