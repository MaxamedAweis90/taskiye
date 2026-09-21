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
  Sun,
  Laptop,
  Flame,
  Check,
  Snowflake,
  CheckCheck,
  ArrowRight,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Loader2,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession, signOut } from '../../lib/auth-client';
import { useTaskiyeStore, GUEST_ITEM_LIMIT } from '../../store/useTaskiyeStore';
import { useThemeStore } from '../../store/useThemeStore';
import { ProfileSettingsModal } from '../profile/ProfileSettingsModal';
import { NotificationPreferencesModal } from '../profile/NotificationPreferencesModal';
import { PwaInstallOnboarding } from '../pwa/PwaInstallOnboarding';
import { PwaPermissionPrompt } from '../pwa/PwaPermissionPrompt';
import { useMidnightRollover } from '../../hooks/useMidnightRollover';
import { TaskiyeChatModal } from '../chat/TaskiyeChatModal';
import { WelcomeSpeechBubble } from '../chat/WelcomeSpeechBubble';
import { migrateGuestChatMessages } from '../chat/chatStorage';

interface InAppNotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'morning' | 'planning' | 'streak' | 'achievement' | 'trash' | 'system' | 'habit' | 'rank';
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
  createdAt?: string;
  deletedAt?: string | null;
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
    showToast,
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

  // Live profile query to track verification status (silent 401 handling, no retries)
  const { data: userProfileData } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: async () => {
      const res = await fetch('/api/users/profile', { credentials: 'include' });
      if (!res.ok) {
        return null;
      }
      const json = await res.json();
      return json?.data?.user || null;
    },
    enabled: Boolean(session?.user),
    staleTime: 30000,
    retry: false,
  });

  const user = session?.user as
    | {
        name?: string;
        username?: string;
        email?: string;
        avatarUrl?: string;
        image?: string | null;
      }
    | undefined;

  const displayName =
    userProfileData?.name ||
    user?.name ||
    userProfileData?.username ||
    user?.username ||
    user?.email?.split('@')[0] ||
    'User';
  const firstName = displayName.split(' ')[0] || 'User';
  const email = userProfileData?.email || user?.email || '';
  const avatarSrc = userProfileData?.avatarUrl || user?.avatarUrl || user?.image || '';
  const userInitial = (displayName || 'U').charAt(0).toUpperCase();

  const isEmailUnverified = Boolean(
    session?.user &&
      (userProfileData ? !userProfileData.emailVerified : session.user.emailVerified === false)
  );

  const hasCustomUsername = Boolean(
    userProfileData?.username?.trim() || user?.username?.trim()
  );
  const isProfileCompleted = Boolean(
    session?.user?.id &&
      localStorage.getItem(`taskiye_profile_completed_${session.user.id}`) === 'true'
  );

  // Avatar is optional. Banner disappears once username is set or profile is completed.
  const isProfileIncomplete = Boolean(
    session?.user && !hasCustomUsername && !isProfileCompleted
  );

  const [isSendingVerifyEmail, setIsSendingVerifyEmail] = useState(false);
  const [hasSentVerifyEmail, setHasSentVerifyEmail] = useState(false);
  const [isVerifyBannerDismissed, setIsVerifyBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('taskiye_verify_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const [isFinishProfileDismissed, setIsFinishProfileDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('taskiye_finish_profile_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const handleTriggerVerifyEmail = async () => {
    setIsSendingVerifyEmail(true);
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
      setHasSentVerifyEmail(true);
      showToast(
        'Verification Email Sent! 📩',
        `We sent a confirmation link to ${session?.user?.email || 'your email'}. Check your inbox!`,
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send verification email';
      showToast('Could not send email', msg, 'error');
    } finally {
      setIsSendingVerifyEmail(false);
    }
  };

  const handleDismissVerifyBanner = () => {
    setIsVerifyBannerDismissed(true);
    try {
      sessionStorage.setItem('taskiye_verify_banner_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const handleDismissFinishProfile = () => {
    setIsFinishProfileDismissed(true);
    try {
      sessionStorage.setItem('taskiye_finish_profile_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const [activeDropdown, setActiveDropdown] = useState<
    'streak' | 'notifications' | 'profile' | null
  >(null);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialPrompt, setChatInitialPrompt] = useState<string | undefined>(undefined);
  const [chatInitialLanguage, setChatInitialLanguage] = useState<'en' | 'so'>('en');
  const [isWelcomeBubbleVisible, setIsWelcomeBubbleVisible] = useState(false);

  // Delay greeting bubble by 10 seconds on first mount (strictly once per browser session)
  useEffect(() => {
    try {
      if (sessionStorage.getItem('taskiye_welcome_bubble_shown') === 'true') {
        return;
      }
    } catch {
      // ignore
    }

    const timer = setTimeout(() => {
      setIsWelcomeBubbleVisible(true);
      try {
        sessionStorage.setItem('taskiye_welcome_bubble_shown', 'true');
      } catch {
        // ignore
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismissWelcomeBubble = () => {
    setIsWelcomeBubbleVisible(false);
    try {
      sessionStorage.setItem('taskiye_welcome_bubble_shown', 'true');
    } catch {
      // ignore
    }
  };

  const [respondingNotifFriendId, setRespondingNotifFriendId] = useState<string | null>(null);

  const handleRespondFriendFromNotification = async (
    notification: InAppNotificationItem,
    action: 'ACCEPT' | 'REJECT',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setRespondingNotifFriendId(notification.id);

    // Extract friendshipId from tag or notification data
    const notifAny = notification as unknown as {
      tag?: string;
      data?: { friendshipId?: unknown };
    };
    const rawFId = notifAny.data?.friendshipId;
    const friendshipId =
      (typeof rawFId === 'string'
        ? rawFId
        : rawFId
          ? String(rawFId)
          : null) ||
      (notifAny.tag?.startsWith('friend-request-')
        ? notifAny.tag.replace('friend-request-', '')
        : null) ||
      (notification.id?.startsWith('friend-request-')
        ? notification.id.replace('friend-request-', '')
        : null);

    try {
      if (friendshipId) {
        const res = await fetch('/api/friends/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ friendshipId, action }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message || 'Failed to respond to request');
        }
      }

      // Mark notification as read
      await fetch(`/api/notifications/${notification.id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );

      await queryClient.invalidateQueries({ queryKey: ['friends'] });
      await queryClient.invalidateQueries({ queryKey: ['rankings'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });

      try {
        const bc = new BroadcastChannel('taskiye_social_sync');
        bc.postMessage({ type: 'FRIENDS_UPDATED' });
        bc.close();
      } catch {
        // ignore
      }

      if (action === 'ACCEPT') {
        showToast('Friend Connected! ⚡', 'Challenge accepted! Check your new rank in Friends League.', 'success');
      } else {
        showToast('Request Ignored', 'Friend request declined.', 'info');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not respond to request';
      showToast('Error', msg, 'error');
    } finally {
      setRespondingNotifFriendId(null);
    }
  };

  const chatUser = useMemo(() => {
    if (!session?.user) return undefined;
    return {
      id: session.user.id,
      name: displayName,
      username: userProfileData?.username || user?.username,
      email: email,
      avatarUrl: avatarSrc,
      image: user?.image,
    };
  }, [session?.user, displayName, userProfileData?.username, user?.username, email, avatarSrc, user?.image]);

  const handleClearInitialPrompt = useCallback(() => {
    setChatInitialPrompt(undefined);
  }, []);

  // Automatically migrate guest chat history to cloud account when user logs in or registers
  useEffect(() => {
    if (session?.user?.id) {
      migrateGuestChatMessages(session.user.id);
    }
  }, [session?.user?.id]);

  const handleOpenChatWithPrompt = (initialPrompt?: string, language?: 'en' | 'so') => {
    handleDismissWelcomeBubble();
    setChatInitialPrompt(initialPrompt);
    if (language) setChatInitialLanguage(language);
    setIsChatOpen(true);
  };
  const controlsRef = useRef<HTMLDivElement>(null);
  const pillMeasureRef = useRef<HTMLDivElement>(null);
  const [pillWidth, setPillWidth] = useState<number>(215);
  const streakMeasureRef = useRef<HTMLDivElement>(null);
  const [streakPillWidth, setStreakPillWidth] = useState<number>(64);
  const bellMeasureRef = useRef<HTMLDivElement>(null);
  const [bellPillWidth, setBellPillWidth] = useState<number>(64);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleRateLimit = (e: Event) => {
      const customEvent = e as CustomEvent<{ retryAfterSeconds?: number }>;
      const seconds = customEvent.detail?.retryAfterSeconds || 10;
      showToast(
        'Rate limit reached',
        `Please wait ${seconds} second${seconds === 1 ? '' : 's'} before trying again.`,
        'info'
      );
    };

    window.addEventListener('taskiye:rate-limit', handleRateLimit);
    return () => window.removeEventListener('taskiye:rate-limit', handleRateLimit);
  }, [showToast]);

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
          data?: { url?: string; tag?: string; friendshipId?: unknown; [key: string]: unknown };
          createdAt?: string;
          deletedAt?: string | null;
        }
        const serverItems: InAppNotificationItem[] = json.data.notifications.map(
          (n: RawNotificationDoc) => {
            const rawFriendshipId = n.data?.friendshipId ? String(n.data.friendshipId) : undefined;
            const computedTag =
              (n.data?.tag as string) ||
              (rawFriendshipId ? `friend-request-${rawFriendshipId}` : undefined);
            return {
              id: n._id || n.id || `notif_${Date.now()}`,
              title: n.title || 'Notification',
              description: n.body || '',
              time: formatNotificationTime(n.createdAt),
              read: Boolean(n.isRead),
              type: (n.type as InAppNotificationItem['type']) || 'system',
              url: n.data?.url || '/',
              tag: computedTag,
              data: {
                ...(n.data || {}),
                ...(rawFriendshipId ? { friendshipId: rawFriendshipId } : {}),
              },
              createdAt: n.createdAt,
              deletedAt: n.deletedAt || null,
            };
          }
        );

        setNotifications((prev) => {
          // Keep active local migration items that haven't been cleared
          const localMigrations = prev.filter(
            (item) => item.id.startsWith('notif_migration_') && !item.deletedAt
          );
          const map = new Map<string, InAppNotificationItem>();
          serverItems.forEach((item) => map.set(item.id, item));
          localMigrations.forEach((item) => {
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

    // Dynamic background polling every 8 seconds while app is active so bell counter & friend updates stay real-time
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    }, 8000);

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
          tag: payload.tag,
          data: payload.data || {},
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

        // Instant query invalidations for real-time reactivity
        queryClient.invalidateQueries({ queryKey: ['friends'] });
        queryClient.invalidateQueries({ queryKey: ['rankings'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });

        // Show live in-app banner toast if a new friend request arrives
        if (payload.title?.toLowerCase().includes('friend')) {
          showToast(payload.title, payload.body || 'You received a new friend rivalry challenge!', 'info');
        }

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
  }, [fetchNotifications, queryClient, showToast]);

  // Live multi-tab and social state synchronization via BroadcastChannel
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('taskiye_social_sync');
      channel.onmessage = (e) => {
        if (e.data?.type === 'FRIENDS_UPDATED') {
          queryClient.invalidateQueries({ queryKey: ['friends'] });
          queryClient.invalidateQueries({ queryKey: ['rankings'] });
          fetchNotifications();
        }
      };
    } catch {
      // BroadcastChannel not supported in legacy environments
    }
    return () => {
      channel?.close();
    };
  }, [queryClient, fetchNotifications]);

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

  const [notificationTab, setNotificationTab] = useState<'inbox' | 'trash'>('inbox');
  const [trashedNotifications, setTrashedNotifications] = useState<InAppNotificationItem[]>([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);

  const fetchTrashedNotifications = useCallback(async () => {
    try {
      setIsLoadingTrash(true);
      let endpoint = '';
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub?.endpoint) endpoint = sub.endpoint;
      }

      const queryUrl = endpoint
        ? `/api/notifications/trash?endpoint=${encodeURIComponent(endpoint)}`
        : '/api/notifications/trash';

      const res = await fetch(queryUrl, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data?.notifications) {
        interface RawTrashedDoc {
          _id?: string;
          id?: string;
          title?: string;
          body?: string;
          isRead?: boolean;
          type?: string;
          data?: { url?: string };
          createdAt?: string;
          deletedAt?: string;
        }
        const items: InAppNotificationItem[] = json.data.notifications.map((n: RawTrashedDoc) => ({
          id: n._id || n.id || `trashed_${Date.now()}`,
          title: n.title || 'Notification',
          description: n.body || '',
          time: formatNotificationTime(n.createdAt),
          read: Boolean(n.isRead),
          type: (n.type as InAppNotificationItem['type']) || 'system',
          url: n.data?.url || '/',
          createdAt: n.createdAt,
          deletedAt: n.deletedAt,
        }));
        setTrashedNotifications(items);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingTrash(false);
    }
  }, []);

  const trashNotification = useCallback(
    async (item: InAppNotificationItem, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      // Optimistically remove from inbox
      setNotifications((prev) => {
        const updated = prev.filter((n) => n.id !== item.id);
        try {
          localStorage.setItem('taskiye_notifications_cache', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      // Add to trashed
      setTrashedNotifications((prev) => [
        { ...item, deletedAt: new Date().toISOString() },
        ...prev.filter((n) => n.id !== item.id),
      ]);

      showToast('Moved to Trash', 'Notification moved to trash junk container', 'info');

      if (item.id && !item.id.startsWith('notif_migration_')) {
        try {
          await fetch(`/api/notifications/${item.id}/trash`, {
            method: 'PATCH',
            credentials: 'include',
          });
        } catch {
          // ignore
        }
      }
    },
    [showToast]
  );

  const clearBellAll = useCallback(async () => {
    if (notifications.length === 0) return;

    const itemsToTrash = [...notifications];
    setNotifications([]);
    try {
      localStorage.setItem('taskiye_notifications_cache', JSON.stringify([]));
    } catch {
      // ignore
    }

    setTrashedNotifications((prev) => [
      ...itemsToTrash.map((n) => ({ ...n, deletedAt: new Date().toISOString(), read: true })),
      ...prev,
    ]);

    if ('clearAppBadge' in navigator) {
      try {
        navigator.clearAppBadge().catch(() => null);
      } catch {
        // ignore
      }
    }

    showToast(
      'Bell Cleared',
      `${itemsToTrash.length} notification${itemsToTrash.length === 1 ? '' : 's'} moved to Trash`,
      'info'
    );

    try {
      let endpoint = '';
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub?.endpoint) endpoint = sub.endpoint;
      }

      await fetch('/api/notifications/clear-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      // ignore
    }
  }, [notifications, showToast]);

  const restoreNotification = useCallback(
    async (item: InAppNotificationItem, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      // Optimistically remove from trash
      setTrashedNotifications((prev) => prev.filter((n) => n.id !== item.id));

      // Restore to inbox
      const restoredItem = { ...item, deletedAt: null };
      setNotifications((prev) => {
        const updated = [restoredItem, ...prev.filter((n) => n.id !== item.id)].slice(0, 30);
        try {
          localStorage.setItem('taskiye_notifications_cache', JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      showToast('Notification Restored', 'Moved back to active notifications', 'success');

      if (item.id && !item.id.startsWith('notif_migration_')) {
        try {
          await fetch(`/api/notifications/${item.id}/restore`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch {
          // ignore
        }
      }
    },
    [showToast]
  );

  const emptyNotificationTrash = useCallback(async () => {
    if (trashedNotifications.length === 0) return;

    const count = trashedNotifications.length;
    setTrashedNotifications([]);

    showToast(
      'Trash Emptied',
      `Permanently deleted ${count} trashed notification${count === 1 ? '' : 's'}`,
      'info'
    );

    try {
      let endpoint = '';
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub?.endpoint) endpoint = sub.endpoint;
      }

      await fetch('/api/notifications/trash/empty', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      // ignore
    }
  }, [trashedNotifications.length, showToast]);

  const permanentlyDeleteNotification = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      setTrashedNotifications((prev) => prev.filter((n) => n.id !== id));
      showToast('Deleted', 'Notification permanently removed', 'info');

      if (id && !id.startsWith('notif_migration_')) {
        try {
          await fetch(`/api/notifications/${id}?permanent=true`, {
            method: 'DELETE',
            credentials: 'include',
          });
        } catch {
          // ignore
        }
      }
    },
    [showToast]
  );

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

  const { theme, resolvedTheme, setTheme } = useThemeStore();

  return (
    <div className="w-full max-w-full h-screen h-[100dvh] overflow-hidden bg-[#f8fafc] text-slate-900 dark:bg-[#070D19] dark:text-slate-100 flex flex-col md:flex-row font-sans antialiased selection:bg-amber-400/30 selection:text-amber-800 dark:selection:text-amber-200">
      {/* 1. Left Sidebar Navigation - Desktop only */}
      <aside className="hidden md:flex w-[84px] sm:w-[92px] shrink-0 flex-col items-center py-4 sm:py-5 justify-between z-20 border-r border-slate-200/80 dark:border-white/[0.04]">
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
                    '<span class="text-amber-500 dark:text-amber-400 font-extrabold text-2xl">⚡</span>';
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
                      ? 'bg-amber-100 border border-amber-300 shadow-[0_0_12px_rgba(217,119,6,0.15)] dark:bg-[#232115] dark:border-[#544310] dark:shadow-[0_0_16px_rgba(250,204,21,0.15)]'
                      : 'hover:bg-slate-200/60 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 transition-transform group-hover:scale-105 ${
                      isActive
                        ? 'text-amber-600 dark:text-[#FACC15] stroke-[2.2]'
                        : 'text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 stroke-[1.8]'
                    }`}
                  />
                </div>
                <span
                  className={`text-[9px] tracking-wider font-extrabold mt-1.5 uppercase transition-colors ${
                    isActive
                      ? 'text-amber-600 dark:text-[#FACC15]'
                      : 'text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200'
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
              className="flex flex-col items-center bg-white dark:bg-[#10192D] hover:bg-slate-50 dark:hover:bg-[#162032] border border-slate-200 dark:border-white/[0.08] hover:border-amber-400/40 rounded-xl p-1.5 transition-all text-center w-14 shadow-sm"
              title={`Guest mode: ${guestItemCount}/${GUEST_ITEM_LIMIT} items stored locally. Click to sign in.`}
            >
              <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                <ShieldAlert className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
                <span>
                  {guestItemCount}/{GUEST_ITEM_LIMIT}
                </span>
              </div>
              <div className="w-10 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mt-1 overflow-hidden border border-slate-200/50 dark:border-white/5">
                <div
                  className={`h-full transition-all duration-300 ${
                    usagePercentage > 85 ? 'bg-rose-500' : 'bg-amber-500 dark:bg-amber-400'
                  }`}
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
              <span className="text-[7.5px] text-slate-500 dark:text-slate-400 mt-0.5 tracking-tight uppercase font-medium">
                Guest
              </span>
            </button>
          )}

          {/* Bottom Chat / Feedback Icon Button matching reference design */}
          <div className="relative">
            <button
              type="button"
              data-chat-toggle="true"
              onClick={() => {
                handleDismissWelcomeBubble();
                setIsChatOpen((prev) => !prev);
              }}
              className={`w-11 h-11 rounded-2xl border transition-all shadow-sm relative group cursor-pointer flex items-center justify-center ${
                isChatOpen
                  ? 'bg-amber-500 dark:bg-amber-400 border-amber-600 dark:border-amber-300 text-white dark:text-slate-950 shadow-[0_0_16px_rgba(245,158,11,0.45)]'
                  : 'bg-white dark:bg-[#10192D] border-slate-200 dark:border-white/[0.08] hover:border-amber-400/40 text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300'
              }`}
              title={isChatOpen ? 'Close Taskiye AI' : 'Taskiye AI Assistant & Support'}
              aria-label={isChatOpen ? 'Close Taskiye AI' : 'Open Taskiye AI Assistant'}
            >
              {isChatOpen ? (
                <X className="w-5 h-5 transition-transform duration-200 hover:scale-110" />
              ) : (
                <>
                  <MessageSquare className="w-5 h-5 transition-transform duration-200" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#10192D] animate-pulse" />
                </>
              )}
            </button>

            {/* Desktop Welcome Speech Bubble attached to sidebar chat trigger */}
            {isWelcomeBubbleVisible && !isChatOpen && !isMobile && (
              <WelcomeSpeechBubble
                position="desktop"
                onOpenChat={handleOpenChatWithPrompt}
                onDismiss={handleDismissWelcomeBubble}
                user={chatUser}
              />
            )}
          </div>
        </div>
      </aside>

      {/* 2. Right Side: Topbar + Main Elevated Workspace */}
      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full h-full overflow-hidden">
        {/* Global Email Verification Banner */}
        {session?.user && isEmailUnverified && !isVerifyBannerDismissed && (
          <div className="w-full bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 dark:from-amber-400/15 dark:via-amber-300/10 dark:to-amber-400/15 border-b border-amber-500/30 dark:border-amber-400/30 px-3 sm:px-8 py-2.5 flex items-center justify-between gap-3 text-xs z-50 shrink-0 select-none animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-base shrink-0 leading-none">⚠️</span>
              <p className="text-amber-950 dark:text-amber-200 font-medium text-[11.5px] sm:text-xs truncate sm:text-clip">
                Please verify your email address to secure your account and ensure you don't lose your progress.
              </p>
              <button
                type="button"
                disabled={isSendingVerifyEmail || hasSentVerifyEmail}
                onClick={handleTriggerVerifyEmail}
                className="ml-1 shrink-0 text-amber-900 dark:text-amber-300 font-extrabold underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isSendingVerifyEmail
                  ? 'Sending Link...'
                  : hasSentVerifyEmail
                    ? 'Link Sent! Check Inbox'
                    : 'Verify Now'}
              </button>
            </div>
            <button
              type="button"
              onClick={handleDismissVerifyBanner}
              className="text-amber-800/70 hover:text-amber-950 dark:text-amber-400/70 dark:hover:text-amber-200 shrink-0 p-1 rounded-lg hover:bg-amber-500/10 transition-colors cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Global Finish Your Profile Banner (Displays for new/verified users who haven't set their username) */}
        {session?.user && !isEmailUnverified && isProfileIncomplete && !isFinishProfileDismissed && (
          <div className="w-full bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 dark:from-amber-400/15 dark:via-amber-300/10 dark:to-amber-400/15 border-b border-amber-500/30 dark:border-amber-400/30 px-3 sm:px-8 py-2.5 flex items-center justify-between gap-3 text-xs z-50 shrink-0 select-none animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-base shrink-0 leading-none">✨</span>
              <p className="text-amber-950 dark:text-amber-200 font-medium text-[11.5px] sm:text-xs truncate sm:text-clip">
                Welcome to Taskiye! Finish setting up your profile to choose your username and customize your account.
              </p>
              <button
                type="button"
                onClick={() => setIsProfileSettingsOpen(true)}
                className="ml-1 shrink-0 inline-flex items-center gap-1 text-amber-900 dark:text-amber-300 font-extrabold underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100 transition-colors cursor-pointer"
              >
                Finish Profile <span aria-hidden="true">&rarr;</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleDismissFinishProfile}
              className="text-amber-800/70 hover:text-amber-950 dark:text-amber-400/70 dark:hover:text-amber-200 shrink-0 p-1 rounded-lg hover:bg-amber-500/10 transition-colors cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
                        '<span class="text-amber-500 dark:text-amber-400 font-extrabold text-2xl">⚡</span>';
                    }
                  }}
                />
              </div>
              <span className="text-[1.35rem] font-black text-slate-900 dark:text-white tracking-tight leading-none flex items-center">
                Task<span className="text-amber-500 dark:text-amber-400">iye</span>
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
                className="w-full bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] focus:border-amber-500/60 dark:focus:border-amber-400/60 rounded-2xl py-2.5 pl-11 pr-4 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 transition-all duration-150 shadow-sm"
              />
            </div>
          </div>

          {/* Right Controls: Streak Button, Notifications Bell & User Profile Dropdown Widget */}
          <div className="flex items-center gap-2.5 sm:gap-3" ref={controlsRef} data-topbar-controls="true">
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
                    ? 'bg-amber-500/10 border-amber-500 dark:bg-[#151D33] dark:border-amber-400 shadow-[0_0_14px_rgba(250,204,21,0.3)] ring-1 ring-amber-400/50'
                    : isTaskDoneToday
                      ? 'bg-amber-50 border-amber-300 dark:bg-[#151D33] dark:border-amber-400/40 shadow-[0_0_14px_rgba(250,204,21,0.18)]'
                      : 'bg-white border-slate-200 dark:bg-[#10192D] dark:border-white/[0.08]'
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
                    ? 'fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:absolute sm:inset-auto sm:right-0 sm:top-0 sm:w-[340px] rounded-3xl bg-white dark:bg-[#10192D] backdrop-blur-xl border border-amber-500/80 dark:border-[#FACC15] shadow-2xl dark:shadow-[0_0_32px_rgba(250,204,21,0.28),0_25px_60px_rgba(0,0,0,0.92)] p-4'
                    : `hidden sm:flex absolute left-0 top-0 w-full h-10 rounded-full border px-2 sm:px-3.5 items-center justify-center select-none transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isTaskDoneToday
                          ? 'bg-amber-50 dark:bg-[#151D33] border-amber-300 dark:border-amber-400/40 shadow-sm dark:shadow-[0_0_14px_rgba(250,204,21,0.18)] hover:border-amber-400'
                          : 'bg-white dark:bg-[#10192D] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.2]'
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
                          ? 'text-amber-500 fill-amber-500 dark:text-amber-400 dark:fill-amber-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.7)] group-hover:scale-110'
                          : 'text-slate-400 fill-slate-400/20 dark:text-slate-500 dark:fill-slate-500/20 opacity-50'
                      }`}
                    />
                    <span
                      className={`text-xs transition-all duration-300 ${
                        isTaskDoneToday
                          ? 'text-amber-600 dark:text-[#FACC15] font-extrabold drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]'
                          : 'text-slate-600 dark:text-slate-400 font-semibold'
                      }`}
                    >
                      {maxStreak}
                    </span>
                  </div>

                  {activeDropdown === 'streak' && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-500/15 dark:bg-amber-400/15 text-amber-600 dark:text-[#FACC15] transition-all">
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
                  <div className="overflow-hidden flex flex-col gap-3 text-left">
                    {/* Divider below trigger row */}
                    <div className="border-t border-slate-200 dark:border-white/[0.08] mt-3" />

                    {/* Streak Header Info */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                            {maxStreak}
                          </span>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                            Day Streak
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5">
                          {isTaskDoneToday ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              You've practiced today! Streak is protected.
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-300 font-medium">
                              Complete today's habits to protect your streak!
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="relative shrink-0">
                        <div
                          className={`w-13 h-13 rounded-2xl flex items-center justify-center ${
                            isTaskDoneToday
                              ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-400/35 shadow-[0_0_20px_rgba(250,204,21,0.25)]'
                              : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10'
                          }`}
                        >
                          <Flame
                            className={`w-8 h-8 transition-all ${
                              isTaskDoneToday
                                ? 'text-amber-500 fill-amber-500 dark:text-amber-400 dark:fill-amber-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]'
                                : 'text-slate-400 fill-slate-400/30 dark:text-slate-500 dark:fill-slate-500/30'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Monthly Inset Calendar */}
                    <div className="bg-slate-50 dark:bg-[#090E1B] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-2.5 sm:p-3 flex flex-col gap-2 shadow-inner">
                      {/* Month Header Switcher */}
                      <div className="flex items-center justify-between px-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrevMonth();
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                          title="Previous month"
                        >
                          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                        </button>

                        <div className="flex items-center gap-1.5 text-xs font-black tracking-wide text-slate-900 dark:text-white uppercase select-none">
                          <Calendar className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
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
                              ? 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 active:scale-90 cursor-pointer'
                              : 'text-slate-400 dark:text-slate-600 opacity-30 cursor-not-allowed'
                          }`}
                          title={canGoNextMonth ? 'Next month' : 'Current month'}
                        >
                          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>

                      {/* Day of Week Labels */}
                      <div className="grid grid-cols-7 gap-1 text-center py-1 border-b border-slate-200 dark:border-white/[0.06]">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase select-none"
                          >
                            {day}
                          </span>
                        ))}
                      </div>

                      {/* Month Days Grid */}
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
                                    ? 'bg-sky-500/15 border-2 border-sky-500 dark:border-sky-400 text-sky-600 dark:text-sky-300 shadow-sm'
                                    : day.isFuture
                                      ? 'text-slate-400 dark:text-slate-600'
                                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.04]'
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
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white dark:bg-[#FACC15] dark:hover:bg-amber-300 dark:text-slate-950 text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                    >
                      <span>Manage Habits & Streaks</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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
                  setActiveDropdown((prev) => {
                    const next = prev === 'notifications' ? null : 'notifications';
                    if (next === 'notifications') fetchTrashedNotifications();
                    return next;
                  });
                }}
                className={`sm:hidden absolute right-0 top-0 w-full h-10 rounded-full border px-2 flex items-center justify-center select-none cursor-pointer transition-all ${
                  activeDropdown === 'notifications'
                    ? 'bg-amber-500/10 border-amber-500 dark:bg-[#151D33] dark:border-amber-400 shadow-[0_0_14px_rgba(250,204,21,0.25)] ring-1 ring-amber-400/50'
                    : 'bg-white border-slate-200 dark:bg-[#10192D] dark:border-white/[0.08]'
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
                    ? () => {
                        setActiveDropdown('notifications');
                        fetchTrashedNotifications();
                      }
                    : undefined
                }
                className={`transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 overflow-hidden cursor-pointer ${
                  activeDropdown === 'notifications'
                    ? 'fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:absolute sm:inset-auto sm:right-0 sm:top-0 sm:w-80 rounded-3xl bg-white dark:bg-[#10192D] backdrop-blur-xl border border-amber-500/80 dark:border-[#FACC15] shadow-2xl dark:shadow-[0_0_32px_rgba(250,204,21,0.28),0_25px_60px_rgba(0,0,0,0.92)] p-4'
                    : 'hidden sm:flex absolute right-0 top-0 w-full h-10 rounded-full border px-2 sm:px-3.5 items-center justify-center select-none bg-white dark:bg-[#10192D] border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.2] transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]'
                }`}
              >
                {/* Trigger Row */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown((prev) => {
                      const next = prev === 'notifications' ? null : 'notifications';
                      if (next === 'notifications') fetchTrashedNotifications();
                      return next;
                    });
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
                        <Bell className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Notifications</span>
                        {hasUnreadNotifications && (
                          <span className="bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-400/20 dark:border-amber-400/40 dark:text-amber-300 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full">
                            New
                          </span>
                        )}
                      </div>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-500/15 dark:bg-amber-400/15 text-amber-600 dark:text-[#FACC15] transition-all">
                        <ChevronDown className="w-3.5 h-3.5 rotate-180 stroke-[2.5]" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Bell
                        className={`w-4 h-4 transition-all duration-300 shrink-0 ${
                          unreadCount > 0
                            ? 'text-amber-500 fill-amber-500/20 dark:text-amber-400 dark:fill-amber-400/20'
                            : 'text-slate-400 fill-slate-400/20 dark:text-slate-500 dark:fill-slate-500/20 opacity-50'
                        }`}
                      />
                      <span
                        className={`text-xs transition-all duration-300 ${
                          unreadCount > 0
                            ? 'text-amber-600 dark:text-[#FACC15] font-semibold'
                            : 'text-slate-500 dark:text-slate-400 font-semibold'
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
                    {/* Header action bar with Tab Switcher */}
                    <div className="border-t border-slate-200 dark:border-white/[0.08] pt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-[11px]">
                        <button
                          type="button"
                          onClick={() => setNotificationTab('inbox')}
                          className={`px-2 py-0.5 rounded-md font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                            notificationTab === 'inbox'
                              ? 'bg-white text-amber-700 border border-slate-200 shadow-sm dark:bg-amber-400/20 dark:text-amber-300 dark:border-amber-400/30'
                              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <Bell className="w-3 h-3" />
                          <span>Inbox</span>
                          {unreadCount > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-400/30 text-[9px] font-bold dark:text-amber-300">
                              {unreadCount}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotificationTab('trash');
                            fetchTrashedNotifications();
                          }}
                          className={`px-2 py-0.5 rounded-md font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                            notificationTab === 'trash'
                              ? 'bg-white text-rose-600 border border-slate-200 shadow-sm dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Trash</span>
                          {trashedNotifications.length > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/30 text-[9px] font-bold dark:text-rose-300">
                              {trashedNotifications.length}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Header Actions for Inbox vs Trash */}
                      {notificationTab === 'inbox' ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasUnreadNotifications && (
                            <button
                              type="button"
                              onClick={markAllNotificationsRead}
                              className="text-[10.5px] font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-0.5 cursor-pointer transition-colors"
                              title="Mark all notifications as read"
                            >
                              <CheckCheck className="w-3 h-3" />
                              <span className="hidden xs:inline">Read</span>
                            </button>
                          )}
                          {notifications.length > 0 && (
                            <button
                              type="button"
                              onClick={clearBellAll}
                              className="text-[10.5px] font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 flex items-center gap-0.5 cursor-pointer transition-colors"
                              title="Clear bell: move all notifications to trash"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Clear All</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        trashedNotifications.length > 0 && (
                          <button
                            type="button"
                            onClick={emptyNotificationTrash}
                            className="text-[10.5px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/20"
                            title="Permanently remove all junk notifications"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Empty Junk</span>
                          </button>
                        )
                      )}
                    </div>

                    {/* Notifications list: Inbox vs Trash */}
                    {notificationTab === 'inbox' ? (
                      <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-0.5">
                        {notifications.length === 0 ? (
                          <div className="py-6 px-3 text-center flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Bell className="w-5 h-5 opacity-40 text-slate-400" />
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              No new notifications
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              Activity and reminders will appear here
                            </span>
                          </div>
                        ) : (
                          notifications.map((n) => {
                            const isFriendReq = Boolean(
                              n.title?.toLowerCase().includes('friend') ||
                              n.tag?.startsWith('friend-request-') ||
                              (n as unknown as { data?: { friendshipId?: string } }).data?.friendshipId ||
                              n.id?.startsWith('friend-request-')
                            );
                            const isResponding = respondingNotifFriendId === n.id;

                            return (
                              <div
                                key={n.id}
                                onClick={() => handleNotificationClick(n)}
                                className={`group p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                                  n.read
                                    ? 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 dark:bg-white/[0.02] dark:border-white/[0.05] dark:text-slate-400 dark:hover:bg-white/[0.05]'
                                    : 'bg-amber-50/80 border-amber-300/80 text-slate-800 hover:bg-amber-100/80 dark:bg-amber-400/[0.07] dark:border-amber-400/25 dark:text-slate-200 dark:hover:bg-amber-400/[0.12] shadow-sm'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs shrink-0">
                                      {isFriendReq
                                        ? '🤝'
                                        : n.type === 'planning'
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
                                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {n.title}
                                    </span>
                                    {!n.read && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                      {n.time}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => trashNotification(n, e)}
                                      className="opacity-0 group-hover:opacity-100 hover:bg-rose-100 dark:hover:bg-rose-500/20 p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                                      title="Move to trash"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-normal pl-5">
                                  {n.description}
                                </p>

                                {/* Inline LinkedIn-style Accept / Ignore buttons for friend requests */}
                                {isFriendReq && !n.read && (
                                  <div className="mt-2.5 pl-5 flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={isResponding}
                                      onClick={(e) => handleRespondFriendFromNotification(n, 'ACCEPT', e)}
                                      className="px-3 py-1 text-[11px] font-bold rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm hover:shadow flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                                    >
                                      {isResponding ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Check className="w-3 h-3" />
                                      )}
                                      <span>Accept</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isResponding}
                                      onClick={(e) => handleRespondFriendFromNotification(n, 'REJECT', e)}
                                      className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all disabled:opacity-50"
                                    >
                                      Ignore
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-0.5">
                        {isLoadingTrash ? (
                          <div className="py-6 px-3 text-center text-xs text-slate-400">
                            Loading trash items...
                          </div>
                        ) : trashedNotifications.length === 0 ? (
                          <div className="py-6 px-3 text-center flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
                            <Trash2 className="w-5 h-5 opacity-40 text-slate-400" />
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Trash is empty</span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              Cleared notifications are kept here for 30 days
                            </span>
                          </div>
                        ) : (
                          trashedNotifications.map((n) => (
                            <div
                              key={n.id}
                              className="group p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100/80 dark:hover:bg-white/[0.04] transition-all select-none"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs shrink-0 opacity-60">🗑️</span>
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-300 truncate">
                                    {n.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => restoreNotification(n, e)}
                                    className="p-1 rounded-md text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 transition-all cursor-pointer"
                                    title="Restore to active inbox"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => permanentlyDeleteNotification(n.id, e)}
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-all cursor-pointer"
                                    title="Delete forever"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-normal pl-5">
                                {n.description}
                              </p>
                              <div className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 pl-5 font-mono">
                                Trashed • Auto-purges in 30 days
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Unified Conversion Driver Pill (Logged Out) OR Morphing User Profile Dropdown (Logged In) */}
            {!session?.user ? (
              <button
                type="button"
                onClick={() => openAuthModal('manual', 'signup')}
                className="group h-10 rounded-full bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.08] hover:border-amber-400/50 shadow-sm px-3 sm:px-4 flex items-center gap-2 transition-all hover:bg-slate-50 dark:hover:bg-[#141F33] hover:shadow-[0_0_20px_rgba(250,204,21,0.18)] cursor-pointer select-none shrink-0"
                title={`Guest mode: ${guestItemCount}/${GUEST_ITEM_LIMIT} items stored. Click to sign in and save progress.`}
              >
                <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-400/15 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  <span className="hidden xs:inline">Save progress </span>
                  <span className="text-amber-600 dark:text-[#FACC15] font-bold">Sign In</span>
                </span>
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-400/15 border border-amber-300 dark:border-amber-400/30 px-1.5 py-0.5 rounded-full shrink-0">
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
                  className={`sm:hidden relative w-10 h-10 rounded-full focus:outline-none transition-all active:scale-95 cursor-pointer shrink-0 flex items-center justify-center ${
                    activeDropdown === 'profile'
                      ? 'ring-2 ring-amber-400 shadow-[0_0_14px_rgba(250,204,21,0.35)]'
                      : ''
                  }`}
                  title={`${displayName} (${email})`}
                >
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={displayName}
                      className="w-full h-full rounded-full object-cover border border-white/15 hover:border-amber-400 transition-colors shadow-sm"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    style={{ display: avatarSrc ? 'none' : 'flex' }}
                    className="w-full h-full rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-sm items-center justify-center border border-white/15 shadow-sm select-none"
                  >
                    {userInitial}
                  </div>
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
                    className={`bg-white dark:bg-[#10192D] backdrop-blur-xl border transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 overflow-hidden cursor-pointer ${
                      activeDropdown === 'profile'
                        ? 'fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top,0px))] sm:absolute sm:inset-auto sm:right-0 sm:top-0 sm:w-80 rounded-3xl border-amber-500 dark:border-[#FACC15] shadow-2xl dark:shadow-[0_0_32px_rgba(250,204,21,0.28),0_25px_60px_rgba(0,0,0,0.92)] p-4'
                        : 'absolute right-0 top-0 w-full h-10 rounded-full border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.2] shadow-sm px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#141F33]'
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
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {getGreeting()},{' '}
                        <span className="text-amber-600 dark:text-[#FACC15] font-bold">{firstName}</span> 👏
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative flex items-center justify-center">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={displayName}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-white/10"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            style={{ display: avatarSrc ? 'none' : 'flex' }}
                            className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-[11px] items-center justify-center border border-slate-200 dark:border-white/10 select-none"
                          >
                            {userInitial}
                          </div>
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 ring-2 ring-white dark:ring-[#10192D]" />
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                            activeDropdown === 'profile'
                              ? 'bg-amber-500/15 dark:bg-amber-400/15 text-amber-600 dark:text-[#FACC15]'
                              : 'text-slate-400 group-hover:text-amber-600 dark:group-hover:text-[#FACC15]'
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
                        <div className="border-t border-slate-200 dark:border-white/[0.08] mt-3" />

                        {/* User Profile Header */}
                        <div className="flex items-center justify-between pb-1">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0 flex items-center justify-center">
                              {avatarSrc ? (
                                <img
                                  src={avatarSrc}
                                  alt={displayName}
                                  className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-white/10"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div
                                style={{ display: avatarSrc ? 'none' : 'flex' }}
                                className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-base items-center justify-center border border-slate-200 dark:border-white/10 select-none"
                              >
                                {userInitial}
                              </div>
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 ring-2 ring-white dark:ring-[#10192D]" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {displayName}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</span>
                            </div>
                          </div>

                          <span className="bg-amber-100 dark:bg-amber-400/10 border border-amber-300 dark:border-amber-400/30 text-amber-700 dark:text-amber-400 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase shrink-0">
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
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <UserIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                              <span>Profile Settings</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded">
                              ⌘P
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveDropdown(null);
                              setIsTrashOpen(true);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer group/trash"
                          >
                            <div className="flex items-center gap-2.5">
                              <Trash2 className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover/trash:text-rose-500 dark:group-hover/trash:text-rose-400 transition-colors" />
                              <span>Trash & Recovery (30 Days)</span>
                            </div>
                            <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/10 border border-amber-300 dark:border-amber-400/20 px-1.5 py-0.5 rounded">
                              30d TTL
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveDropdown(null);
                              setIsNotificationModalOpen(true);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                              <span>Notification Preferences</span>
                            </div>
                          </button>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-slate-200 dark:border-white/[0.06]" />

                        {/* Section 2: Interactive Appearance Controller */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-2.5">
                              {resolvedTheme === 'dark' ? (
                                <Moon className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                              ) : (
                                <Sun className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              )}
                              <span className="font-semibold text-slate-900 dark:text-slate-100">Appearance</span>
                            </div>
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              {theme === 'system'
                                ? 'System Auto'
                                : resolvedTheme === 'dark'
                                  ? 'Dark Slate'
                                  : 'Daylight'}
                            </span>
                          </div>

                          {/* 3-Way Segmented Control */}
                          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-black/35 p-1 rounded-xl border border-slate-200 dark:border-white/[0.06] text-xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTheme('light');
                              }}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                theme === 'light'
                                  ? 'bg-white text-amber-700 shadow-sm border border-slate-200 dark:bg-amber-400/20 dark:text-amber-300 dark:border-amber-400/30'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title="Kinetic Daylight (Light Mode)"
                            >
                              <Sun className="w-3.5 h-3.5 text-amber-500" />
                              <span>Light</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTheme('dark');
                              }}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                theme === 'dark'
                                  ? 'bg-white text-amber-700 shadow-sm border border-slate-200 dark:bg-amber-400/20 dark:text-amber-300 dark:border-amber-400/30'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title="Kinetic Midnight (Dark Mode)"
                            >
                              <Moon className="w-3.5 h-3.5 text-amber-400" />
                              <span>Dark</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTheme('system');
                              }}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                theme === 'system'
                                  ? 'bg-white text-amber-700 shadow-sm border border-slate-200 dark:bg-amber-400/20 dark:text-amber-300 dark:border-amber-400/30'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title="System (Auto Match OS)"
                            >
                              <Laptop className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              <span>Auto</span>
                            </button>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-slate-200 dark:border-white/[0.06]" />

                        {/* Section 3: Session Actions */}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDropdown(null);
                              handleSignOut();
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400" />
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
          className="flex-1 bg-slate-50/70 dark:bg-[#0E1628] border-t md:border-l border-slate-200/80 dark:border-white/[0.06] rounded-t-3xl md:rounded-tr-none md:rounded-tl-3xl sm:md:rounded-tl-[2.5rem] overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0 px-3 sm:px-8 py-4 sm:py-6 pb-24 md:pb-6 relative custom-scrollbar"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile Floating Chat Trigger (< md) - Positioned safely above bottom navigation bar, respecting safe-area-inset-bottom */}
      <div className="md:hidden fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3.5 z-40 flex items-center">
        {isWelcomeBubbleVisible && !isChatOpen && isMobile && (
          <WelcomeSpeechBubble
            position="mobile"
            onOpenChat={handleOpenChatWithPrompt}
            onDismiss={handleDismissWelcomeBubble}
            user={chatUser}
          />
        )}

        <button
          type="button"
          data-chat-toggle="true"
          onClick={() => {
            handleDismissWelcomeBubble();
            setIsChatOpen((prev) => !prev);
          }}
          className={`flex items-center gap-1.5 py-2 transition-all cursor-pointer group shadow-lg active:scale-95 ${
            isChatOpen
              ? 'px-3 rounded-full bg-amber-500 dark:bg-amber-400 border border-amber-600 dark:border-amber-300 text-white dark:text-slate-950 shadow-[0_4px_20px_rgba(245,158,11,0.45)]'
              : 'pl-2.5 pr-3 rounded-full bg-white/95 dark:bg-[#10192D]/95 backdrop-blur-xl border border-amber-500/40 dark:border-amber-400/40 text-amber-600 dark:text-amber-400 shadow-[0_4px_20px_rgba(245,158,11,0.25)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)]'
          }`}
          title={isChatOpen ? 'Close Taskiye AI' : 'Taskiye AI Assistant'}
          aria-label={isChatOpen ? 'Close Taskiye AI' : 'Open Taskiye AI Chatbot'}
        >
          {isChatOpen ? (
            <div className="flex items-center gap-1">
              <X className="w-4 h-4 transition-transform duration-200" />
              <span className="text-xs font-black">Close</span>
            </div>
          ) : (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 transition-transform group-hover:-translate-x-0.5" />
              <div className="relative">
                <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#10192D] animate-ping" />
              </div>
              <span className="text-[11px] font-black tracking-wide bg-gradient-to-r from-amber-600 to-amber-500 dark:from-amber-400 dark:to-amber-300 bg-clip-text text-transparent">
                AI
              </span>
            </>
          )}
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar (Visible only on screens < md) */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B132B]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/[0.08] px-3 py-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] items-center justify-around shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.6)] select-none">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-amber-600 dark:text-[#FACC15]' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-amber-50 border border-amber-300 shadow-[0_0_12px_rgba(217,119,6,0.15)] dark:bg-[#232115] dark:border-[#544310] dark:shadow-[0_0_12px_rgba(250,204,21,0.2)]'
                    : 'hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'text-amber-600 dark:text-[#FACC15] stroke-[2.2]' : 'stroke-[1.8]'
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
        onOpenNotificationPreferences={() => {
          setIsProfileSettingsOpen(false);
          setIsNotificationModalOpen(true);
        }}
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

      {/* Taskiye AI Chatbot Modal (Responsive: Desktop floating card & Mobile full-screen) */}
      <TaskiyeChatModal
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setChatInitialPrompt(undefined);
        }}
        onClearInitialPrompt={handleClearInitialPrompt}
        initialPrompt={chatInitialPrompt}
        initialLanguage={chatInitialLanguage}
        user={chatUser}
      />
    </div>
  );
};
