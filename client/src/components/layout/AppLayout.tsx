import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  CheckSquare,
  Repeat,
  Sparkles,
  Trophy,
  Search,
  Bell,
  User as UserIcon,
  LogOut,
  ShieldAlert,
  MessageSquare,
  ChevronDown,
  Moon,
  Flame,
  Check,
  Snowflake,
  CheckCheck,
  ArrowRight,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession, signOut } from '../../lib/auth-client';
import { useTaskiyeStore, GUEST_ITEM_LIMIT } from '../../store/useTaskiyeStore';
import { ProfileSettingsModal } from '../profile/ProfileSettingsModal';
import { NotificationPreferencesModal } from '../profile/NotificationPreferencesModal';
import { PwaInstallOnboarding } from '../pwa/PwaInstallOnboarding';
import { PwaPermissionPrompt } from '../pwa/PwaPermissionPrompt';
import { useMidnightRollover } from '../../hooks/useMidnightRollover';

interface InAppNotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'morning' | 'planning' | 'streak' | 'achievement' | 'trash' | 'system' | 'habit' | 'rank';
  url?: string;
  createdAt?: string;
}

function formatNotificationTime(dateStr?: string): string {
  if (!dateStr) return 'Just now';
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return 'Just now';
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays}d ago`;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'OVERVIEW', icon: LayoutGrid },
  { to: '/habits', label: 'HABITS', icon: Repeat },
  { to: '/tasks', label: 'TASKS', icon: CheckSquare },
  { to: '/rank', label: 'RANK', icon: Trophy },
];

export const AppLayout: React.FC = () => {
  // Automated background midnight date rollover listener
  useMidnightRollover();

  const { data: session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const {
    getGuestItemCount,
    openAuthModal,
    todayChecklistCompletedCount,
    setBaseStreakDays,
    setIsTrashOpen,
    habits: guestHabits,
    tasks: guestTasks,
    getGuestActivityMap,
    currentDateStr,
    triggerLogoutSplash,
    syncHabitsToTodayTasks,
  } = useTaskiyeStore();

  const { data: serverActivity = {} } = useQuery({
    queryKey: ['tasks', 'activity'],
    queryFn: async () => {
      const res = await fetch('/api/tasks/activity', { credentials: 'include' });
      const json = await res.json();
      return (json.data || {}) as Record<string, { completedCount: number; totalCount: number }>;
    },
    enabled: Boolean(session?.user),
    staleTime: 30000,
  });

  const localTodayStr = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const utcTodayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayStr = currentDateStr || localTodayStr;

  const activityLogs = useMemo(() => {
    if (session?.user) {
      return serverActivity;
    }
    if (!guestTasks && !guestHabits) return {};
    return getGuestActivityMap();
  }, [session?.user, serverActivity, getGuestActivityMap, guestTasks, guestHabits]);

  const pastConsecutiveDays = useMemo(() => {
    if (!activityLogs) return 0;
    let count = 0;
    const d = new Date();
    d.setDate(d.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const localStr = d.toLocaleDateString('en-CA');
      const utcStr = d.toISOString().slice(0, 10);
      const log = activityLogs[localStr] || activityLogs[utcStr];
      if (log && log.completedCount > 0) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [activityLogs]);

  // Effective base streak prior to today, strictly matching calendar activity logs
  const effectiveBaseStreak = pastConsecutiveDays;

  useEffect(() => {
    setBaseStreakDays(effectiveBaseStreak);
  }, [effectiveBaseStreak, setBaseStreakDays]);

  const [activeDropdown, setActiveDropdown] = useState<
    'streak' | 'notifications' | 'profile' | null
  >(null);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const pillMeasureRef = useRef<HTMLDivElement>(null);
  const [pillWidth, setPillWidth] = useState<number>(215);
  const streakMeasureRef = useRef<HTMLDivElement>(null);
  const [streakPillWidth, setStreakPillWidth] = useState<number>(64);
  const bellMeasureRef = useRef<HTMLDivElement>(null);
  const [bellPillWidth, setBellPillWidth] = useState<number>(64);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isTaskDoneToday = useMemo(() => {
    return (
      todayChecklistCompletedCount > 0 ||
      (activityLogs[todayStr]?.completedCount || 0) > 0 ||
      (activityLogs[localTodayStr]?.completedCount || 0) > 0 ||
      (activityLogs[utcTodayStr]?.completedCount || 0) > 0
    );
  }, [todayChecklistCompletedCount, activityLogs, todayStr, localTodayStr, utcTodayStr]);

  const [notifications, setNotifications] = useState<InAppNotificationItem[]>(() => {
    try {
      const cached = localStorage.getItem('taskiye_notifications_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const hasUnreadNotifications = useMemo(() => notifications.some((n) => !n.read), [notifications]);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Sync with /api/notifications when user is logged in or when window focuses
  const fetchNotifications = useCallback(async () => {
    try {
      let endpoint = '';
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub?.endpoint) {
          endpoint = sub.endpoint;
        }
      }

      const queryUrl = endpoint
        ? `/api/notifications?endpoint=${encodeURIComponent(endpoint)}`
        : '/api/notifications';

      const res = await fetch(queryUrl, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data?.notifications) {
        interface RawNotificationDoc {
          _id?: string;
          id?: string;
          title?: string;
          body?: string;
          isRead?: boolean;
          type?: string;
          data?: { url?: string };
          createdAt?: string;
        }
        const serverItems: InAppNotificationItem[] = json.data.notifications.map(
          (n: RawNotificationDoc) => ({
            id: n._id || n.id || `notif_${Date.now()}`,
            title: n.title || 'Notification',
            description: n.body || '',
            time: formatNotificationTime(n.createdAt),
            read: Boolean(n.isRead),
            type: (n.type as InAppNotificationItem['type']) || 'system',
            url: n.data?.url || '/',
            createdAt: n.createdAt,
          })
        );

        setNotifications((prev) => {
          // Merge server items with any existing local migration/guest items
          const map = new Map<string, InAppNotificationItem>();
          serverItems.forEach((item) => map.set(item.id, item));
          prev.forEach((item) => {
            if (!map.has(item.id)) map.set(item.id, item);
          });
          const merged = Array.from(map.values()).slice(0, 30);
          try {
            localStorage.setItem('taskiye_notifications_cache', JSON.stringify(merged));
          } catch {
            // ignore
          }
          return merged;
        });
      }
    } catch {
      // Network failure, use cache
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    const onFocus = () => fetchNotifications();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };

    const handleCustomRefresh = (event: Event) => {
      const ce = event as CustomEvent<InAppNotificationItem>;
      if (ce?.detail) {
        setNotifications((prev) => {
          const filtered = prev.filter((item) => item.id !== ce.detail.id);
          const updated = [ce.detail, ...filtered].slice(0, 30);
          try {
            localStorage.setItem('taskiye_notifications_cache', JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
      }
      fetchNotifications();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('taskiye_refresh_notifications', handleCustomRefresh);

    // Dynamic background polling every 20 seconds while app is active so bell counter stays real-time
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    }, 20000);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('taskiye_refresh_notifications', handleCustomRefresh);
      clearInterval(pollInterval);
    };
  }, [fetchNotifications, session?.user]);

  // Listen for live Service Worker push broadcasts
  useEffect(() => {
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
        const payload = event.data.payload;
        const newItem: InAppNotificationItem = {
          id: payload.tag || `notif_${Date.now()}`,
          title: payload.title,
          description: payload.body,
          time: 'Just now',
          read: false,
          type: payload.type || 'system',
          url: payload.url || '/',
          createdAt: new Date().toISOString(),
        };

        setNotifications((prev) => {
          const filtered = prev.filter((item) => item.id !== newItem.id);
          const updated = [newItem, ...filtered].slice(0, 30);
          try {
            localStorage.setItem('taskiye_notifications_cache', JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });

        // Trigger network re-sync to guarantee consistency
        fetchNotifications();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, [fetchNotifications]);

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      try {
        localStorage.setItem('taskiye_notifications_cache', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    try {
      let endpoint = '';
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub?.endpoint) endpoint = sub.endpoint;
      }

      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = (item: InAppNotificationItem) => {
    // 1. Mark as read
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === item.id ? { ...n, read: true } : n));
      try {
        localStorage.setItem('taskiye_notifications_cache', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    if (item.id && !item.id.startsWith('notif_migration_')) {
      fetch(`/api/notifications/${item.id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      }).catch(() => null);
    }

    // 2. Navigate and close dropdown
    setActiveDropdown(null);
    if (item.url) {
      navigate(item.url);
    }
  };

  // Check if a guest data migration just occurred to add to notification drawer
  useEffect(() => {
    try {
      const pendingCount = sessionStorage.getItem('taskiye_migration_notification');
      if (pendingCount) {
        sessionStorage.removeItem('taskiye_migration_notification');
        const count = parseInt(pendingCount, 10) || 0;
        setNotifications((prev) => [
          {
            id: `notif_migration_${Date.now()}`,
            title: 'Guest Data Migrated',
            description: `Successfully imported ${count} habit and task item${count === 1 ? '' : 's'} to your cloud account. Local cache was safely cleared.`,
            time: 'Just now',
            read: false,
            type: 'habit',
            url: '/habits',
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.warn('Could not read migration notification from sessionStorage:', err);
    }
  }, []);

  // Monthly Calendar Navigation & Data for Duolingo-style Streak Popover
  const [streakCalendarDate, setStreakCalendarDate] = useState(() => new Date());

  const canGoNextMonth = useMemo(() => {
    const now = new Date();
    return (
      streakCalendarDate.getFullYear() < now.getFullYear() ||
      (streakCalendarDate.getFullYear() === now.getFullYear() &&
        streakCalendarDate.getMonth() < now.getMonth())
    );
  }, [streakCalendarDate]);

  const handlePrevMonth = () => {
    setStreakCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    if (!canGoNextMonth) return;
    setStreakCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const calendarMonthData = useMemo(() => {
    const year = streakCalendarDate.getFullYear();
    const month = streakCalendarDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateStr: string;
      isToday: boolean;
      isFuture: boolean;
      isCompleted: boolean;
      dayOfWeek: number;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const dayOfWeek = (firstDayIndex + d - 1) % 7;

      const isToday =
        dateStr === todayStr || dateStr === localTodayStr || dateStr === utcTodayStr;
      const isFuture =
        dateStr > todayStr && dateStr > localTodayStr && dateStr > utcTodayStr;

      let isCompleted = false;
      if (isToday) {
        isCompleted = isTaskDoneToday;
      } else if (!isFuture) {
        const log = activityLogs[dateStr];
        isCompleted = Boolean(log && log.completedCount > 0);
      }

      days.push({
        dayNumber: d,
        dateStr,
        isToday,
        isFuture,
        isCompleted,
        dayOfWeek,
      });
    }

    return {
      firstDayIndex,
      monthName: streakCalendarDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
      days,
    };
  }, [
    streakCalendarDate,
    todayStr,
    localTodayStr,
    utcTodayStr,
    isTaskDoneToday,
    activityLogs,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeDropdown]);

  useEffect(() => {
    if (pillMeasureRef.current) {
      const measured = pillMeasureRef.current.offsetWidth;
      if (measured > 0) {
        setPillWidth(measured);
      }
    }
  }, [session?.user]);

  const guestItemCount = getGuestItemCount();
  const usagePercentage = Math.min(100, Math.round((guestItemCount / GUEST_ITEM_LIMIT) * 100));

  // Global Daily Streak: Base consecutive days prior to today + (1 if active today)
  const maxStreak = effectiveBaseStreak + (isTaskDoneToday ? 1 : 0);

  useEffect(() => {
    if (streakMeasureRef.current) {
      const measured = streakMeasureRef.current.offsetWidth;
      if (measured > 0) {
        setStreakPillWidth(measured);
      }
    }
  }, [maxStreak, isTaskDoneToday]);

  useEffect(() => {
    if (bellMeasureRef.current) {
      const measured = bellMeasureRef.current.offsetWidth;
      if (measured > 0) {
        setBellPillWidth(measured);
      }
    }
  }, [unreadCount]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleSignOut = async () => {
    try {
      const userIdentifier =
        user?.name || user?.username || user?.email?.split('@')[0] || 'account';
      triggerLogoutSplash(`Signing out ${userIdentifier}...`);
      await signOut();
      queryClient.removeQueries({ queryKey: ['tasks'] });
      queryClient.removeQueries({ queryKey: ['habits'] });
      syncHabitsToTodayTasks();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const defaultAvatar =
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80';

  const user = session?.user as
    | {
        name?: string;
        username?: string;
        email?: string;
        avatarUrl?: string;
        image?: string | null;
      }
    | undefined;

  const displayName = user?.name || user?.username || user?.email?.split('@')[0] || 'User';
  const firstName = displayName.split(' ')[0] || 'User';
  const email = user?.email || '';
  const avatarSrc = user?.avatarUrl || user?.image || defaultAvatar;

  return (
    <div className="w-full max-w-full h-screen h-[100dvh] overflow-hidden bg-[#070D19] text-slate-100 flex flex-col md:flex-row font-sans antialiased selection:bg-amber-400/30 selection:text-amber-200">
      {/* 1. Left Sidebar Navigation - Desktop only */}
      <aside className="hidden md:flex w-[84px] sm:w-[92px] shrink-0 flex-col items-center py-4 sm:py-5 justify-between z-20">
        {/* Top: Taskiye Brand Logo (Standalone with no circled round box) */}
        <div className="h-12 flex items-center justify-center">
          <NavLink
            to="/"
            className="group relative flex items-center justify-center transition-transform duration-200 hover:scale-105"
            title="Taskiye Home"
          >
            <img
              src="/logo.png"
              alt="Taskiye Logo"
              className="w-20 h-20 sm:w-21 sm:h-21 object-contain drop-shadow-[0_0_14px_rgba(250,204,21,0.3)]"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML =
                    '<span class="text-amber-400 font-extrabold text-2xl">⚡</span>';
                }
              }}
            />
          </NavLink>
        </div>

        {/* Center: Vertical Navigation Items */}
        <nav className="flex flex-col items-center gap-4 sm:gap-5 my-auto py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="group flex flex-col items-center justify-center transition-all duration-200"
                title={item.label}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'bg-[#232115] border border-[#544310] shadow-[0_0_16px_rgba(250,204,21,0.15)]'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 transition-transform group-hover:scale-105 ${
                      isActive
                        ? 'text-[#FACC15] stroke-[2.2]'
                        : 'text-slate-400 group-hover:text-slate-200 stroke-[1.8]'
                    }`}
                  />
                </div>
                <span
                  className={`text-[9px] tracking-wider font-extrabold mt-1.5 uppercase transition-colors ${
                    isActive ? 'text-[#FACC15]' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom: Guest Usage Badge & Chat/Feedback Icon */}
        <div className="flex flex-col items-center gap-3">
          {/* Guest Storage Counter Pill */}
          {!session?.user && (
            <button
              type="button"
              onClick={() => openAuthModal('manual')}
              className="flex flex-col items-center bg-[#10192D] hover:bg-[#162032] border border-white/[0.08] hover:border-amber-400/40 rounded-xl p-1.5 transition-all text-center w-14"
              title={`Guest mode: ${guestItemCount}/${GUEST_ITEM_LIMIT} items stored locally. Click to sign in.`}
            >
              <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-300">
                <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                <span>
                  {guestItemCount}/{GUEST_ITEM_LIMIT}
                </span>
              </div>
              <div className="w-10 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden border border-white/5">
                <div
                  className={`h-full transition-all duration-300 ${
                    usagePercentage > 85 ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
              <span className="text-[7.5px] text-slate-400 mt-0.5 tracking-tight uppercase font-medium">
                Guest
              </span>
            </button>
          )}

          {/* Bottom Chat / Feedback Icon Button matching reference design */}
          <button
            type="button"
            className="w-11 h-11 rounded-2xl bg-[#10192D] border border-white/[0.08] hover:border-amber-400/40 text-amber-400 hover:text-amber-300 flex items-center justify-center transition-all shadow-sm"
            title="Feedback & Support"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* 2. Right Side: Topbar + Main Elevated Workspace */}
      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full h-full overflow-hidden">
        {/* Topbar - Respects iOS notch/status bar with safe-area-inset-top */}
        <header className="relative h-[calc(4rem+env(safe-area-inset-top,0px))] sm:h-20 pt-[env(safe-area-inset-top,0px)] sm:pt-0 shrink-0 px-3 sm:px-8 pr-3 sm:pr-8 flex items-center justify-between gap-2 sm:gap-4 z-50 w-full max-w-full">
          {/* Mobile Brand Logo (< md) */}
          <div className="flex md:hidden items-center shrink-0">
            <NavLink to="/" className="flex items-center gap-2 group select-none">
              <div className="w-10 h-10 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src="/logo.png"
                  alt="Taskiye Logo"
                  className="w-full h-full scale-[1.38] object-contain drop-shadow-[0_0_10px_rgba(250,204,21,0.3)] transition-transform duration-200 group-hover:scale-[1.45] active:scale-125"
                  onError={(e) => {
                    const target = e.currentTarget;
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML =
                        '<span class="text-amber-400 font-extrabold text-2xl">⚡</span>';
                    }
                  }}
                />
              </div>
              <span className="text-[1.35rem] font-black text-white tracking-tight leading-none flex items-center">
                Task<span className="text-amber-400">iye</span>
              </span>
            </NavLink>
          </div>

          {/* Search Input - Desktop & Tablet */}
          <div className="w-full max-w-sm sm:max-w-md relative hidden sm:block">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search habits, tasks, streaks..."
                className="w-full bg-[#10192D] border border-white/[0.08] hover:border-white/[0.15] focus:border-amber-400/60 rounded-2xl py-2.5 pl-11 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all duration-150"
              />
            </div>
          </div>

          {/* Right Controls: Streak Button, Notifications Bell & User Profile Dropdown Widget */}
          <div className="flex items-center gap-2.5 sm:gap-3" ref={controlsRef}>
            {/* 1. Streak Widget (Morphs from unlit/lit flame pill to Duolingo monthly calendar streak card) */}
            <div
              className="relative transition-[width] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0"
              style={{
                width: isMobile ? 52 : activeDropdown === 'streak' ? 340 : streakPillWidth,
                height: 40,
              }}
            >
              {/* Offscreen invisible element to accurately track natural streak pill width */}
              <div
                ref={streakMeasureRef}
                className="absolute opacity-0 pointer-events-none invisible whitespace-nowrap px-3 sm:px-3.5 py-1.5 flex items-center gap-1.5 border border-transparent"
              >
                <div className="w-4 h-4" />
                <span className="text-xs font-semibold">{maxStreak}</span>
              </div>

              {/* Mobile Fixed Trigger in Topbar (Never moves, always in place) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDropdown((prev) => (prev === 'streak' ? null : 'streak'));
                }}
                className={`sm:hidden absolute left-0 top-0 w-full h-10 rounded-full border px-2 flex items-center justify-center select-none cursor-pointer transition-all ${
                  activeDropdown === 'streak'
                    ? 'bg-[#151D33] border-amber-400 shadow-[0_0_14px_rgba(250,204,21,0.3)] ring-1 ring-amber-400/50'
                    : isTaskDoneToday
                      ? 'bg-[#151D33] border-amber-400/40 shadow-[0_0_14px_rgba(250,204,21,0.18)]'
                      : 'bg-[#10192D] border-white/[0.08]'
                }`}
                title={`Streak: ${maxStreak}`}
              >
                <Flame
                  className={`w-4 h-4 transition-all duration-300 shrink-0 ${
                    isTaskDoneToday || activeDropdown === 'streak'
                      ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.7)]'
                      : 'text-slate-500 fill-slate-500/20 opacity-50'
                  }`}
                />
                <span
                  className={`text-xs ml-1.5 transition-all duration-300 ${
                    isTaskDoneToday || activeDropdown === 'streak'
                      ? 'text-[#FACC15] font-extrabold drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]'
                      : 'text-slate-400 font-semibold'
                  }`}
                >
                  {maxStreak}
                </span>
              </div>

              <div
                onClick={
                  activeDropdown !== 'streak' ? () => setActiveDropdown('streak') : undefined
                }
                className={`transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 overflow-hidden cursor-pointer ${
                  activeDropdown === 'streak'
                    ? 'fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:absolute sm:inset-auto sm:right-0 sm:top-0 sm:w-[340px] rounded-3xl bg-[#10192D]/98 backdrop-blur-xl border border-[#FACC15] shadow-[0_0_32px_rgba(250,204,21,0.28),0_25px_60px_rgba(0,0,0,0.92)] p-4'
                    : `hidden sm:flex absolute left-0 top-0 w-full h-10 rounded-full border px-2 sm:px-3.5 items-center justify-center select-none transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isTaskDoneToday
                          ? 'bg-[#151D33] border-amber-400/40 shadow-[0_0_14px_rgba(250,204,21,0.18)] hover:border-amber-400/70'
                          : 'bg-[#10192D] border-white/[0.08] hover:border-white/[0.2]'
                      }`
                }`}
              >
                {/* Trigger Button Row (Only Fire & Number, lit up if task/habit done today) */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown((prev) => (prev === 'streak' ? null : 'streak'));
                  }}
                  className={`flex items-center cursor-pointer select-none group ${
                    activeDropdown === 'streak'
                      ? 'justify-between w-full gap-2'
                      : 'justify-center gap-1.5 w-full h-full'
                  }`}
                  title={`Streak: ${maxStreak} (${isTaskDoneToday ? 'Active today!' : 'Pending today - complete a task/habit to light up'})`}
                >
                  <div className="flex items-center gap-1.5">
                    <Flame
                      className={`w-4 h-4 transition-all duration-300 shrink-0 ${
                        isTaskDoneToday
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.7)] group-hover:scale-110'
                          : 'text-slate-500 fill-slate-500/20 opacity-50'
                      }`}
                    />
                    <span
                      className={`text-xs transition-all duration-300 ${
                        isTaskDoneToday
                          ? 'text-[#FACC15] font-extrabold drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]'
                          : 'text-slate-400 font-semibold'
                      }`}
                    >
                      {maxStreak}
                    </span>
                  </div>

                  {activeDropdown === 'streak' && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-400/15 text-[#FACC15] transition-all">
                      <ChevronDown className="w-3.5 h-3.5 rotate-180 stroke-[2.5]" />
                    </div>
                  )}
                </div>

                {/* Morphed Duolingo Streak Body */}
                <div
                  className={`grid transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    activeDropdown === 'streak'
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="overflow-hidden flex flex-col gap-3 text-left pt-2.5">
                    {/* Divider */}
                    <div className="border-t border-white/[0.08]" />

                    {/* Top Tag & Title + Big Flame Illustration */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="bg-gradient-to-r from-amber-400/20 to-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wider uppercase flex items-center gap-1 shadow-sm w-fit mb-1.5">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>STREAK SOCIETY</span>
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">
                          {maxStreak} {maxStreak === 1 ? 'day streak' : 'day streak'}
                        </h3>
                        <p className="text-xs text-slate-300 font-medium mt-1 leading-snug">
                          {isTaskDoneToday ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              You're on fire! Streak protected today.
                            </span>
                          ) : (
                            <span className="text-amber-300 font-medium">
                              Complete today's habits to protect your streak!
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="relative shrink-0">
                        <div
                          className={`w-13 h-13 rounded-2xl flex items-center justify-center ${
                            isTaskDoneToday
                              ? 'bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-400/35 shadow-[0_0_20px_rgba(250,204,21,0.35)]'
                              : 'bg-white/5 border border-white/10'
                          }`}
                        >
                          <Flame
                            className={`w-8 h-8 transition-all ${
                              isTaskDoneToday
                                ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]'
                                : 'text-slate-500 fill-slate-500/30'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Monthly Inset Calendar (Duolingo style: < Month Year > with full month grid) */}
                    <div className="bg-[#090E1B] border border-white/[0.08] rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2 shadow-inner">
                      {/* Month Header Switcher */}
                      <div className="flex items-center justify-between px-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrevMonth();
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                          title="Previous month"
                        >
                          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                        </button>

                        <div className="flex items-center gap-1.5 text-xs font-black tracking-wide text-white uppercase select-none">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>{calendarMonthData.monthName}</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNextMonth();
                          }}
                          disabled={!canGoNextMonth}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            canGoNextMonth
                              ? 'text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 cursor-pointer'
                              : 'text-slate-600 opacity-30 cursor-not-allowed'
                          }`}
                          title={canGoNextMonth ? 'Next month' : 'Current month'}
                        >
                          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>

                      {/* Day of Week Labels */}
                      <div className="grid grid-cols-7 gap-1 text-center py-1 border-b border-white/[0.06]">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-bold text-slate-400 uppercase select-none"
                          >
                            {day}
                          </span>
                        ))}
                      </div>

                      {/* Month Days Grid with Morph Transition */}
                      <div
                        key={calendarMonthData.monthName}
                        className="grid grid-cols-7 gap-y-1.5 gap-x-1 py-1 animate-in fade-in zoom-in-95 duration-200"
                      >
                        {/* Leading empty placeholder cells */}
                        {Array.from({ length: calendarMonthData.firstDayIndex }).map((_, i) => (
                          <div key={`empty-${i}`} className="w-7 h-7 sm:w-7.5 sm:h-7.5 mx-auto" />
                        ))}

                        {/* Actual Month Days */}
                        {calendarMonthData.days.map((day) => (
                          <div
                            key={day.dateStr}
                            className="relative flex items-center justify-center"
                          >
                            <div
                              className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full flex items-center justify-center text-[10.5px] font-bold transition-all select-none ${
                                day.isCompleted
                                  ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 shadow-[0_0_10px_rgba(250,204,21,0.4)] ring-1 ring-amber-300'
                                  : day.isToday
                                    ? 'bg-sky-500/15 border-2 border-sky-400 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.35)]'
                                    : day.isFuture
                                      ? 'text-slate-600'
                                      : 'text-slate-400 hover:bg-white/[0.04]'
                              }`}
                              title={`${day.dateStr}: ${
                                day.isCompleted
                                  ? 'Streak day completed! 🔥'
                                  : day.isToday
                                    ? 'Active today - complete your habits to keep streak alive!'
                                    : day.isFuture
                                      ? 'Upcoming'
                                      : 'Missed'
                              }`}
                            >
                              {day.isCompleted ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : day.isToday ? (
                                <Snowflake className="w-3 h-3 stroke-[2.5]" />
                              ) : (
                                <span>{day.dayNumber}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Button: View Streak */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        navigate('/habits');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-[0_0_16px_rgba(250,204,21,0.25)] hover:shadow-[0_0_24px_rgba(250,204,21,0.45)] transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <Zap className="w-3.5 h-3.5 fill-slate-950" />
                      <span>View Streak</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5] ml-auto" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Notification Bell (Morphs into Notification Center card) */}
            <div
              className="relative transition-[width] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0"
              style={{
                width: isMobile ? 48 : activeDropdown === 'notifications' ? 320 : bellPillWidth,
                height: 40,
              }}
            >
              {/* Off-screen measure element for natural pill width */}
              <div
                ref={bellMeasureRef}
                className="absolute opacity-0 pointer-events-none invisible whitespace-nowrap px-3 sm:px-3.5 py-1.5 flex items-center gap-1.5 border border-transparent"
              >
                <div className="w-4 h-4" />
                <span className="text-xs font-semibold">{unreadCount}</span>
              </div>

              {/* Mobile Fixed Trigger in Topbar (Never moves, always in place) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDropdown((prev) => (prev === 'notifications' ? null : 'notifications'));
                }}
                className={`sm:hidden absolute right-0 top-0 w-full h-10 rounded-full border px-2 flex items-center justify-center select-none cursor-pointer transition-all ${
                  activeDropdown === 'notifications'
                    ? 'bg-[#151D33] border-amber-400 shadow-[0_0_14px_rgba(250,204,21,0.25)] ring-1 ring-amber-400/50'
                    : 'bg-[#10192D] border-white/[0.08]'
                }`}
                title={`Notifications (${unreadCount} unread)`}
              >
                <Bell
                  className={`w-4 h-4 transition-all duration-300 shrink-0 ${
                    unreadCount > 0 || activeDropdown === 'notifications'
                      ? 'text-amber-400 fill-amber-400/20'
                      : 'text-slate-500 fill-slate-500/20 opacity-50'
                  }`}
                />
                <span
                  className={`text-xs ml-1.5 transition-all duration-300 ${
                    unreadCount > 0 || activeDropdown === 'notifications'
                      ? 'text-[#FACC15] font-semibold'
                      : 'text-slate-400 font-semibold'
                  }`}
                >
                  {unreadCount}
                </span>
              </div>

              <div
                onClick={
                  activeDropdown !== 'notifications'
                    ? () => setActiveDropdown('notifications')
                    : undefined
                }
                className={`transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 overflow-hidden cursor-pointer ${
                  activeDropdown === 'notifications'
                    ? 'fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:absolute sm:inset-auto sm:right-0 sm:top-0 sm:w-80 rounded-3xl bg-[#10192D]/98 backdrop-blur-xl border border-[#FACC15] shadow-[0_0_32px_rgba(250,204,21,0.28),0_25px_60px_rgba(0,0,0,0.92)] p-4'
                    : 'hidden sm:flex absolute right-0 top-0 w-full h-10 rounded-full border px-2 sm:px-3.5 items-center justify-center select-none bg-[#10192D] border-white/[0.08] hover:border-white/[0.2] transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]'
                }`}
              >
                {/* Trigger Row */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown((prev) =>
                      prev === 'notifications' ? null : 'notifications'
                    );
                  }}
                  className={`flex items-center cursor-pointer select-none group ${
                    activeDropdown === 'notifications'
                      ? 'justify-between w-full gap-2'
                      : 'justify-center gap-1.5 w-full h-full'
                  }`}
                  title={`Notifications (${unreadCount} unread)`}
                >
                  {activeDropdown === 'notifications' ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-white">Notifications</span>
                        {hasUnreadNotifications && (
                          <span className="bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full">
                            New
                          </span>
                        )}
                      </div>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-400/15 text-[#FACC15] transition-all">
                        <ChevronDown className="w-3.5 h-3.5 rotate-180 stroke-[2.5]" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Bell
                        className={`w-4 h-4 transition-all duration-300 shrink-0 ${
                          unreadCount > 0
                            ? 'text-amber-400 fill-amber-400/20'
                            : 'text-slate-500 fill-slate-500/20 opacity-50'
                        }`}
                      />
                      <span
                        className={`text-xs transition-all duration-300 ${
                          unreadCount > 0
                            ? 'text-[#FACC15] font-semibold'
                            : 'text-slate-400 font-semibold'
                        }`}
                      >
                        {unreadCount}
                      </span>
                    </div>
                  )}
                </div>

                {/* Morphed Notification List Body */}
                <div
                  className={`grid transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] w-full ${
                    activeDropdown === 'notifications'
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="overflow-hidden flex flex-col gap-2.5 text-left pt-2.5">
                    {/* Header action bar */}
                    <div className="border-t border-white/[0.08] pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Recent Activity
                      </span>
                      {hasUnreadNotifications && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>

                    {/* Notifications list */}
                    <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-0.5">
                      {notifications.length === 0 ? (
                        <div className="py-6 px-3 text-center flex flex-col items-center justify-center gap-1.5 text-slate-500">
                          <Bell className="w-5 h-5 opacity-40 text-slate-400" />
                          <span className="text-xs font-medium text-slate-400">
                            No new notifications
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Activity and reminders will appear here
                          </span>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                              n.read
                                ? 'bg-white/[0.02] border-white/[0.05] text-slate-400 hover:bg-white/[0.05]'
                                : 'bg-amber-400/[0.07] border-amber-400/25 text-slate-200 hover:bg-amber-400/[0.12] shadow-[0_0_12px_rgba(250,204,21,0.08)]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs shrink-0">
                                  {n.type === 'planning'
                                    ? '🎯'
                                    : n.type === 'morning'
                                      ? '☀️'
                                      : n.type === 'streak'
                                        ? '🔥'
                                        : n.type === 'achievement'
                                          ? '🏆'
                                          : n.type === 'trash'
                                            ? '🗑️'
                                            : n.type === 'habit'
                                              ? '⏰'
                                              : '🔔'}
                                </span>
                                <span className="text-xs font-bold text-white truncate">
                                  {n.title}
                                </span>
                                {!n.read && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                {n.time}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-1 leading-normal pl-5">
                              {n.description}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Unified Conversion Driver Pill (Logged Out) OR Morphing User Profile Dropdown (Logged In) */}
            {!session?.user ? (
              <button
                type="button"
                onClick={() => openAuthModal('manual', 'signup')}
                className="group h-10 rounded-full bg-[#10192D] border border-white/[0.08] hover:border-amber-400/50 shadow-sm px-3 sm:px-4 flex items-center gap-2 transition-all hover:bg-[#141F33] hover:shadow-[0_0_20px_rgba(250,204,21,0.18)] cursor-pointer select-none shrink-0"
                title={`Guest mode: ${guestItemCount}/${GUEST_ITEM_LIMIT} items stored. Click to sign in and save progress.`}
              >
                <div className="w-5 h-5 rounded-full bg-amber-400/15 flex items-center justify-center text-amber-400 shrink-0">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </div>
                <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                  <span className="hidden xs:inline">Save progress </span>
                  <span className="text-[#FACC15] font-bold">Sign In</span>
                </span>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.5 rounded-full shrink-0">
                  {guestItemCount}/{GUEST_ITEM_LIMIT}
                </span>
              </button>
            ) : (
              <>
                {/* Mobile Only: Standalone Circular Avatar (Fixed in place, never moves or shifts) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown((prev) => (prev === 'profile' ? null : 'profile'));
                  }}
                  className={`sm:hidden relative w-10 h-10 rounded-full focus:outline-none transition-all active:scale-95 cursor-pointer shrink-0 ${
                    activeDropdown === 'profile'
                      ? 'ring-2 ring-amber-400 shadow-[0_0_14px_rgba(250,204,21,0.35)]'
                      : ''
                  }`}
                  title={`${displayName} (${email})`}
                >
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    className="w-full h-full rounded-full object-cover border border-white/15 hover:border-amber-400 transition-colors shadow-sm"
                    onError={(e) => {
                      e.currentTarget.src = defaultAvatar;
                    }}
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#10192D]" />
                </button>

                {/* Desktop Morphing Pill (sm:block) & Opened Dropdown Card on Mobile/Desktop */}
                <div
                  className={`relative transition-[width] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0 ${
                    activeDropdown === 'profile'
                      ? isMobile
                        ? 'static'
                        : 'block'
                      : 'hidden sm:block'
                  }`}
                  style={{
                    width: isMobile ? 0 : activeDropdown === 'profile' ? 320 : pillWidth,
                    height: isMobile ? 0 : 40,
                  }}
                >
                  {/* Offscreen invisible element to accurately track natural pill width */}
                  <div
                    ref={pillMeasureRef}
                    className="absolute opacity-0 pointer-events-none invisible whitespace-nowrap px-3.5 sm:px-4 py-1.5 flex items-center gap-2.5 border border-transparent"
                  >
                    <span className="text-xs font-semibold">
                      {getGreeting()}, <span className="font-bold">{firstName}</span> 👏
                    </span>
                    <div className="w-7 h-7" />
                    <div className="w-5 h-5" />
                  </div>

                  {/* Unified Morphing Border Card */}
                  <div
                    onClick={
                      activeDropdown !== 'profile' ? () => setActiveDropdown('profile') : undefined
                    }
                    className={`bg-[#10192D]/98 backdrop-blur-xl border transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 overflow-hidden cursor-pointer ${
                      activeDropdown === 'profile'
                        ? 'fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:absolute sm:inset-auto sm:right-0 sm:top-0 sm:w-80 rounded-3xl border-[#FACC15] shadow-[0_0_32px_rgba(250,204,21,0.28),0_25px_60px_rgba(0,0,0,0.92)] p-4'
                        : 'absolute right-0 top-0 w-full h-10 rounded-full border-white/[0.08] hover:border-white/[0.2] shadow-sm px-4 flex items-center justify-between hover:bg-[#141F33]'
                    }`}
                  >
                    {/* Top Bar Trigger Row */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown((prev) => (prev === 'profile' ? null : 'profile'));
                      }}
                      className="flex items-center justify-between gap-2.5 cursor-pointer select-none group w-full h-full"
                    >
                      <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                        {getGreeting()},{' '}
                        <span className="text-[#FACC15] font-bold">{firstName}</span> 👏
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative">
                          <img
                            src={avatarSrc}
                            alt={displayName}
                            className="w-7 h-7 rounded-full object-cover border border-white/10"
                            onError={(e) => {
                              e.currentTarget.src = defaultAvatar;
                            }}
                          />
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#10192D]" />
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                            activeDropdown === 'profile'
                              ? 'bg-amber-400/15 text-[#FACC15]'
                              : 'text-slate-400 group-hover:text-[#FACC15]'
                          }`}
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                              activeDropdown === 'profile' ? 'rotate-180' : 'rotate-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Morphing Dropdown Body (smoothly unfurls using CSS Grid row expansion) */}
                    <div
                      className={`grid transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        activeDropdown === 'profile'
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                      }`}
                    >
                      <div className="overflow-hidden flex flex-col gap-3 text-left">
                        {/* Divider below trigger row */}
                        <div className="border-t border-white/[0.08] mt-3" />

                        {/* User Profile Header */}
                        <div className="flex items-center justify-between pb-1">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <img
                                src={avatarSrc}
                                alt={displayName}
                                className="w-11 h-11 rounded-xl object-cover border border-white/10"
                                onError={(e) => {
                                  e.currentTarget.src = defaultAvatar;
                                }}
                              />
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#10192D]" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-white truncate">
                                {displayName}
                              </span>
                              <span className="text-xs text-slate-400 truncate">{email}</span>
                            </div>
                          </div>

                          <span className="bg-amber-400/10 border border-amber-400/30 text-amber-400 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase shrink-0">
                            PRO ACTIVE
                          </span>
                        </div>

                        {/* Section 1: Main Profile Actions */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDropdown(null);
                              setIsProfileSettingsOpen(true);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <UserIcon className="w-4 h-4 text-slate-400" />
                              <span>Profile Settings</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                              ⌘P
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveDropdown(null);
                              setIsTrashOpen(true);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer group/trash"
                          >
                            <div className="flex items-center gap-2.5">
                              <Trash2 className="w-4 h-4 text-slate-400 group-hover/trash:text-rose-400 transition-colors" />
                              <span>Trash & Recovery (30 Days)</span>
                            </div>
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                              30d TTL
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveDropdown(null);
                              setIsNotificationModalOpen(true);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <Bell className="w-4 h-4 text-slate-400" />
                              <span>Notification Preferences</span>
                            </div>
                          </button>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-white/[0.06]" />

                        {/* Section 2: Appearance & Preferences */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => setActiveDropdown(null)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <Moon className="w-4 h-4 text-slate-400" />
                              <span>Appearance</span>
                            </div>
                            <span className="text-xs font-semibold text-amber-400">Dark Slate</span>
                          </button>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-white/[0.06]" />

                        {/* Section 3: Session Actions */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDropdown(null);
                              handleSignOut();
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <LogOut className="w-4 h-4 text-rose-400" />
                              <span>Sign Out</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* 3. Main Workspace Container - Full height touching bottom 0 aligned with topbar */}
        <main
          id="main-workspace"
          className="flex-1 bg-[#0E1628] border-t md:border-l border-white/[0.06] rounded-t-3xl md:rounded-tr-none md:rounded-tl-3xl sm:md:rounded-tl-[2.5rem] overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0 px-3 sm:px-8 py-4 sm:py-6 pb-24 md:pb-6 relative custom-scrollbar"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Visible only on screens < md) */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B132B]/95 backdrop-blur-xl border-t border-white/[0.08] px-3 py-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] items-center justify-around shadow-[0_-4px_24px_rgba(0,0,0,0.6)] select-none">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-[#FACC15]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-[#232115] border border-[#544310] shadow-[0_0_12px_rgba(250,204,21,0.2)]'
                    : 'hover:bg-white/[0.04]'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'text-[#FACC15] stroke-[2.2]' : 'stroke-[1.8]'
                  }`}
                />
              </div>
              <span className="text-[9px] tracking-wider font-extrabold mt-1 uppercase">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={isProfileSettingsOpen}
        onClose={() => setIsProfileSettingsOpen(false)}
      />

      {/* Notification Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />

      {/* Smart Mobile PWA Installation Onboarding */}
      <PwaInstallOnboarding />

      {/* Post-Install Native Notification Permission Onboarding */}
      <PwaPermissionPrompt />
    </div>
  );
};
