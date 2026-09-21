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
  Sparkles,
  Target,
  ChevronDown,
  Sun,
  Trophy,
  Trash2,
  Loader2,
  Play,
} from 'lucide-react';
import { useTaskiyeStore } from '../../store/useTaskiyeStore';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationSimulationItem {
  id: 'morning' | 'planning' | 'streak' | 'achievement' | 'trash' | 'system';
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
}

const NOTIFICATION_SIMULATION_LIST: NotificationSimulationItem[] = [
  {
    id: 'morning',
    label: 'Morning Cadence',
    desc: 'Daily focus & habits kick-off',
    icon: Sun,
    color: 'text-amber-400',
    badgeBg: 'bg-amber-400/10 border-amber-400/25',
  },
  {
    id: 'planning',
    label: 'Task Planning',
    desc: 'Mid-day check-in & task review',
    icon: Target,
    color: 'text-sky-400',
    badgeBg: 'bg-sky-400/10 border-sky-400/25',
  },
  {
    id: 'streak',
    label: 'Streak at Risk',
    desc: 'Urgent streak protection alert',
    icon: Flame,
    color: 'text-orange-400',
    badgeBg: 'bg-orange-400/10 border-orange-400/25',
  },
  {
    id: 'achievement',
    label: 'Daily Milestone',
    desc: 'All habits completed celebration',
    icon: Trophy,
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-400/10 border-emerald-400/25',
  },
  {
    id: 'trash',
    label: 'Trash Expiration',
    desc: '48h soft-delete purge warning',
    icon: Trash2,
    color: 'text-rose-400',
    badgeBg: 'bg-rose-400/10 border-rose-400/25',
  },
  {
    id: 'system',
    label: 'System & Sync',
    desc: 'Device connectivity test alert',
    icon: Sparkles,
    color: 'text-indigo-400',
    badgeBg: 'bg-indigo-400/10 border-indigo-400/25',
  },
];

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
  const [testingType, setTestingType] = useState<string | null>(null);
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

    // Asynchronously fetch latest preferences from server to ensure multi-device consistency
    fetch('/api/notifications/preferences', { credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (json?.data?.preferences) {
          const remotePrefs: NotificationPrefs = {
            ...DEFAULT_NOTIFICATION_PREFS,
            ...json.data.preferences,
          };
          setPrefs(remotePrefs);
          setInitialPrefs(remotePrefs);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remotePrefs));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => null);
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
      // 1. Save local preferences immediately
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setInitialPrefs(prefs);

      // 2. Persist directly to MongoDB via dedicated preferences endpoint
      const prefPromise = fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: prefs }),
      }).catch(() => null);

      // 3. If any push alert is active and push is supported, ensure device push subscription is updated
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

      await prefPromise;

      // Broadcast global event so any active mobile component re-syncs dynamically
      window.dispatchEvent(
        new CustomEvent('taskiye_preferences_updated', {
          detail: prefs,
        })
      );

      setSuccessMsg('Notification preferences updated and synced!');
      showToast(
        'Preferences Saved',
        'Your alert preferences and scheduled times have been updated.',
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

  const handleSimulateNotification = async (
    type: 'morning' | 'planning' | 'streak' | 'achievement' | 'trash' | 'system'
  ) => {
    setTestingType(type);
    try {
      // 1. Ensure subscription if supported and permitted
      if (!isSubscribed && isSupported && permission !== 'denied') {
        try {
          await subscribe({
            dailyReminders: prefs.dailyReminders,
            morningReminderTime: prefs.morningReminderTime,
            taskPlanningReminder: prefs.taskPlanningReminder,
            taskPlanningTime: prefs.taskPlanningTime,
            streakAlerts: prefs.streakAlerts,
            dailyCadenceDigest: prefs.dailyCadenceDigest,
            completionChimes: prefs.completionChimes,
          });
        } catch {
          // ignore
        }
      }

      // 2. Dispatch simulated notification
      await sendTestAlert(type);
      setSuccessMsg('Simulated alert dispatched to device and notification bell!');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.warn('Simulation test failed:', err);
    } finally {
      setTestingType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-[#0B132B] text-slate-900 dark:text-slate-100 flex flex-col justify-between select-none overflow-y-auto animate-in fade-in duration-200">
      {/* Top Bar matching ProfileSettingsModal */}
      <div className="w-full flex items-center justify-between p-6 sm:px-10 pt-[calc(1.5rem+env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.08] transition-all cursor-pointer"
          title="Close Preferences"
        >
          <X className="w-6 h-6 stroke-[2.5]" />
        </button>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
          Notification Preferences
        </div>
      </div>

      {/* Centered Main Content Area */}
      <div className="w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center">
        {/* Header Icon & Title */}
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:bg-amber-400/10 dark:border-amber-400/30 dark:text-amber-400 mb-4 shadow-sm dark:shadow-[0_0_20px_rgba(250,204,21,0.2)] flex items-center justify-center">
          <Bell className="w-8 h-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2 text-center">
          Notification Alerts
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-6 max-w-xs">
          Customize when and how Taskiye reminds you of your daily routines, tasks, and streaks.
        </p>

        {successMsg && (
          <div className="w-full mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Preference Settings Cards */}
        <div className="w-full flex flex-col gap-3">
          {/* Setting 1: Plan Today's Priorities (NEW - User Requested) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#10192D] border border-amber-500/40 dark:border-amber-400/30 hover:border-amber-500/60 dark:hover:border-amber-400/50 transition-all flex flex-col gap-3 shadow-sm dark:shadow-[0_0_16px_rgba(250,204,21,0.06)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:bg-amber-400/20 dark:border-amber-400/40 dark:text-amber-300 shrink-0 mt-0.5 shadow-sm">
                  <Target className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Plan Today's Priorities</span>
                    <span className="bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-500/30 dark:border-amber-400/40 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                      New
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Timely reminder to plan and organize your daily focus tasks
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggle('taskPlanningReminder')}
                className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                  prefs.taskPlanningReminder ? 'bg-amber-500 dark:bg-[#FACC15]' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full bg-white dark:bg-slate-950 shadow-sm transition-transform ${
                    prefs.taskPlanningReminder ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Time Selector Dropdown */}
            {prefs.taskPlanningReminder && (
              <div className="pt-2.5 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Preferred Reminder Time
                </span>
                <div className="relative flex items-center">
                  <select
                    value={prefs.taskPlanningTime}
                    onChange={(e) => handleTimeChange('taskPlanningTime', e.target.value)}
                    className="appearance-none bg-slate-50 dark:bg-[#151D33] border border-amber-500/40 dark:border-amber-400/40 hover:border-amber-500 dark:hover:border-amber-400 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl pl-3 pr-7 py-1 text-xs font-bold text-amber-700 dark:text-[#FACC15] focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-400 shadow-sm dark:shadow-[0_0_12px_rgba(250,204,21,0.15)] cursor-pointer"
                  >
                    <option value="07:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">07:00 AM</option>
                    <option value="08:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">08:00 AM</option>
                    <option value="09:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">09:00 AM (Recommended)</option>
                    <option value="10:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">10:00 AM</option>
                    <option value="11:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">11:00 AM</option>
                    <option value="12:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">12:00 PM</option>
                    <option value="13:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">01:00 PM</option>
                    <option value="18:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">06:00 PM (Tomorrow prep)</option>
                    <option value="20:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">08:00 PM</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 absolute right-2 pointer-events-none stroke-[2.5]" />
                </div>
              </div>
            )}
          </div>

          {/* Setting 2: Daily Habit Reminders */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all flex flex-col gap-3 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:bg-amber-400/15 dark:border-amber-400/30 dark:text-amber-400 shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Daily Habit Reminders</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Morning alerts for habits scheduled on today's cadence
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggle('dailyReminders')}
                className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                  prefs.dailyReminders ? 'bg-amber-500 dark:bg-[#FACC15]' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full bg-white dark:bg-slate-950 shadow-sm transition-transform ${
                    prefs.dailyReminders ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Time Selector Dropdown */}
            {prefs.dailyReminders && (
              <div className="pt-2.5 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Morning Cadence Time
                </span>
                <div className="relative flex items-center">
                  <select
                    value={prefs.morningReminderTime}
                    onChange={(e) => handleTimeChange('morningReminderTime', e.target.value)}
                    className="appearance-none bg-slate-50 dark:bg-[#151D33] border border-amber-500/40 dark:border-amber-400/40 hover:border-amber-500 dark:hover:border-amber-400 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl pl-3 pr-7 py-1 text-xs font-bold text-amber-700 dark:text-[#FACC15] focus:outline-none focus:ring-1 focus:ring-amber-500 dark:focus:ring-amber-400 shadow-sm dark:shadow-[0_0_12px_rgba(250,204,21,0.15)] cursor-pointer"
                  >
                    <option value="06:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">06:00 AM (Early bird)</option>
                    <option value="07:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">07:00 AM</option>
                    <option value="08:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">08:00 AM (Default)</option>
                    <option value="09:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">09:00 AM</option>
                    <option value="10:00" className="bg-white dark:bg-[#151D33] text-slate-800 dark:text-slate-200">10:00 AM</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 absolute right-2 pointer-events-none stroke-[2.5]" />
                </div>
              </div>
            )}
          </div>

          {/* Setting 3: Streak Protection Warning */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all flex items-center justify-between gap-4 shadow-sm dark:shadow-none">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400 shrink-0 mt-0.5">
                <Flame className="w-4 h-4 fill-rose-600 dark:fill-rose-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Streak Society Alerts</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  High-priority warning when your active streak is at risk
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('streakAlerts')}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                prefs.streakAlerts ? 'bg-amber-500 dark:bg-[#FACC15]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white dark:bg-slate-950 shadow-sm transition-transform ${
                  prefs.streakAlerts ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Setting 4: Evening Cadence Digest */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all flex items-center justify-between gap-4 shadow-sm dark:shadow-none">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:bg-blue-500/15 dark:border-blue-500/30 dark:text-blue-400 shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Evening Cadence Digest</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Summary review of remaining tasks before midnight rollover
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('dailyCadenceDigest')}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                prefs.dailyCadenceDigest ? 'bg-amber-500 dark:bg-[#FACC15]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white dark:bg-slate-950 shadow-sm transition-transform ${
                  prefs.dailyCadenceDigest ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Setting 5: Audio Completion Chimes */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] transition-all flex items-center justify-between gap-4 shadow-sm dark:shadow-none">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400 shrink-0 mt-0.5">
                <Volume2 className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Audio & Haptic Feedback</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Play celebration chime when completing items
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleToggle('completionChimes')}
              className={`w-12 h-7 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                prefs.completionChimes ? 'bg-amber-500 dark:bg-[#FACC15]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white dark:bg-slate-950 shadow-sm transition-transform ${
                  prefs.completionChimes ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Notification Type Simulator Matrix */}
        <div className="w-full mt-6 flex flex-col gap-3">
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/[0.08] pt-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Notification Type Simulator
              </span>
            </div>
            <span className="text-[10.5px] text-slate-500 dark:text-slate-400 hidden sm:inline">
              Click to test trigger & delivery
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {NOTIFICATION_SIMULATION_LIST.map((sim) => {
              const Icon = sim.icon;
              const isItemTesting = testingType === sim.id;
              return (
                <button
                  key={sim.id}
                  type="button"
                  disabled={testingType !== null}
                  onClick={() => handleSimulateNotification(sim.id)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.98] ${
                    isItemTesting
                      ? 'bg-amber-500/15 border-amber-500/60 dark:bg-amber-400/15 dark:border-amber-400 shadow-sm dark:shadow-[0_0_15px_rgba(250,204,21,0.2)]'
                      : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.18] shadow-sm dark:shadow-none'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${sim.badgeBg} ${sim.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {sim.label}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {sim.desc}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isItemTesting ? (
                      <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" />
                    ) : (
                      <div className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-amber-500/15 dark:hover:bg-amber-400/20 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30 dark:border-amber-400/30 flex items-center gap-1 transition-all">
                        <Play className="w-2.5 h-2.5 fill-amber-600 dark:fill-amber-400 text-amber-600 dark:text-amber-400" />
                        <span>Test</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {permission === 'denied' && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 text-center mt-1">
              Push permissions are currently blocked in your browser. Simulated alerts will still appear in your in-app notification bell.
            </p>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar matching ProfileSettingsModal */}
      <div className="w-full border-t border-slate-200 dark:border-white/[0.08] p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-white/90 dark:bg-[#0B132B]/80 backdrop-blur-xl">
        <div className="w-full max-w-md mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200/70 dark:hover:bg-white/[0.1] transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!hasChanges || isSaving}
            onClick={handleSave}
            className={`w-full py-3.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !hasChanges || isSaving
                ? 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-white/[0.04] cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md hover:scale-[1.01] active:scale-[0.99] dark:bg-[#FACC15] dark:hover:bg-[#EAB308] dark:shadow-[0_0_20px_rgba(250,204,21,0.3)]'
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
