import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  CheckSquare,
  Repeat,
  Sparkles,
  Target,
  Search,
  Bell,
  User as UserIcon,
  LogOut,
  ShieldAlert,
  MessageSquare,
  ChevronDown,
  Moon,
  ShieldCheck,
  Keyboard,
  ArrowLeftRight,
  Sliders,
  Flame,
  Check,
  Snowflake,
  CheckCheck,
  ArrowRight,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession, signOut } from '../../lib/auth-client';
import { useTaskiyeStore, GUEST_ITEM_LIMIT } from '../../store/useTaskiyeStore';
import { ProfileSettingsModal } from '../profile/ProfileSettingsModal';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'OVERVIEW', icon: LayoutGrid },
  { to: '/habits', label: 'HABITS', icon: Repeat },
  { to: '/tasks', label: 'TASKS', icon: CheckSquare },
  { to: '/goals', label: 'GOALS', icon: Target },
];

export const AppLayout: React.FC = () => {
  const { data: session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const {
    getGuestItemCount,
    openAuthModal,
    todayChecklistCompletedCount,
    baseStreakDays,
    triggerLogoutSplash,
    syncHabitsToTodayTasks,
  } = useTaskiyeStore();

  const [activeDropdown, setActiveDropdown] = useState<
    'streak' | 'notifications' | 'profile' | null
  >(null);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const pillMeasureRef = useRef<HTMLDivElement>(null);
  const [pillWidth, setPillWidth] = useState<number>(215);
  const streakMeasureRef = useRef<HTMLDivElement>(null);
  const [streakPillWidth, setStreakPillWidth] = useState<number>(64);
  const bellMeasureRef = useRef<HTMLDivElement>(null);
  const [bellPillWidth, setBellPillWidth] = useState<number>(64);

  const isTaskDoneToday = useMemo(() => {
    return todayChecklistCompletedCount > 0;
  }, [todayChecklistCompletedCount]);

  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      time: string;
      read: boolean;
      type: 'streak' | 'habit' | 'goal';
    }>
  >([]);

  const hasUnreadNotifications = useMemo(() => notifications.some((n) => !n.read), [notifications]);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const weekDays = useMemo(() => {
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // Real streak: past days are only completed if the user actually had a streak covering them
    const effectiveBaseStreak = baseStreakDays ?? 0;

    return days.map((label, index) => {
      const isPast = index < currentDayOfWeek;
      const isToday = index === currentDayOfWeek;
      const isFuture = index > currentDayOfWeek;

      let isCompleted = false;
      if (isToday) {
        isCompleted = isTaskDoneToday;
      } else if (isPast) {
        // How many days ago was this day from today?
        const daysAgo = currentDayOfWeek - index;
        isCompleted = daysAgo <= effectiveBaseStreak;
      }

      return {
        label,
        isPast,
        isToday,
        isFuture,
        isCompleted,
      };
    });
  }, [isTaskDoneToday, baseStreakDays]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  // Real streak: Daily streak increases by +1 when the first task/habit is done that day.
  // If no task/habit is done today (or all are unchecked), streak stays at the base streak.
  const maxStreak = (baseStreakDays ?? 0) + (todayChecklistCompletedCount > 0 ? 1 : 0);

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
      const userIdentifier = user?.name || user?.username || user?.email?.split('@')[0] || 'account';
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
    <div className="w-screen h-screen overflow-hidden bg-[#070D19] text-slate-100 flex font-sans antialiased selection:bg-amber-400/30 selection:text-amber-200">
      {/* 1. Left Sidebar Navigation - Seamlessly merged into the dark canvas with NO border separation */}
      <aside className="w-[84px] sm:w-[92px] shrink-0 flex flex-col items-center py-4 sm:py-5 justify-between z-20">
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
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Topbar - Harmonized padding aligning searchbar with main workspace content */}
        <header className="h-16 sm:h-20 shrink-0 px-6 sm:px-8 pr-6 sm:pr-8 flex items-center justify-between gap-4 z-30">
          {/* Search Input matching design tokens and content alignment */}
          <div className="w-full max-w-sm sm:max-w-md relative">
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
            {/* 1. Streak Widget (Morphs from unlit/lit flame pill to Duolingo streak card) */}
            <div
              className="relative transition-[width] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0"
              style={{
                width:
                  activeDropdown === 'streak'
                    ? typeof window !== 'undefined' && window.innerWidth < 640
                      ? 288
                      : 320
                    : streakPillWidth,
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

              <div
                onClick={
                  activeDropdown !== 'streak' ? () => setActiveDropdown('streak') : undefined
                }
                className={`absolute left-0 top-0 transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 overflow-hidden cursor-pointer ${
                  activeDropdown === 'streak'
                    ? 'w-72 sm:w-80 rounded-3xl bg-[#10192D]/98 backdrop-blur-xl border border-[#FACC15] shadow-[0_0_32px_rgba(250,204,21,0.28),0_25px_60px_rgba(0,0,0,0.92)] p-4'
                    : `w-full h-10 rounded-full border px-3 sm:px-3.5 flex items-center justify-center select-none transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
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

                    {/* Weekly Inset Calendar (Duolingo style: S M T W T F S) */}
                    <div className="bg-[#090E1B] border border-white/[0.08] rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-1 shadow-inner">
                      {weekDays.map((day, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                          <span
                            className={`text-[10.5px] font-bold ${
                              day.isToday ? 'text-amber-400' : 'text-slate-400'
                            }`}
                          >
                            {day.label}
                          </span>
                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              day.isCompleted
                                ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 shadow-[0_0_10px_rgba(250,204,21,0.35)]'
                                : day.isToday
                                  ? 'bg-sky-500/20 border-2 border-sky-400 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                  : 'bg-white/[0.04] border border-white/[0.08] text-slate-500'
                            }`}
                          >
                            {day.isCompleted ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : day.isToday ? (
                              <Snowflake className="w-3.5 h-3.5 stroke-[2.5]" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdown(null);
                        navigate('/habits');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-[0_0_16px_rgba(250,204,21,0.25)] hover:shadow-[0_0_24px_rgba(250,204,21,0.45)] transition-all cursor-pointer"
                    >
                      <span>View Habit Streaks</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Notification Bell (Morphs into Notification Center card) */}
            <div
              className="relative transition-[width] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0"
              style={{
                width:
                  activeDropdown === 'notifications'
                    ? typeof window !== 'undefined' && window.innerWidth < 640
                      ? 288
                      : 320
                    : bellPillWidth,
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

              <div
                onClick={
                  activeDropdown !== 'notifications'
                    ? () => setActiveDropdown('notifications')
                    : undefined
                }
                className={`absolute right-0 top-0 transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 overflow-hidden cursor-pointer ${
                  activeDropdown === 'notifications'
                    ? 'w-72 sm:w-80 rounded-3xl bg-[#10192D]/98 backdrop-blur-xl border border-[#FACC15] shadow-[0_0_32px_rgba(250,204,21,0.28),0_25px_60px_rgba(0,0,0,0.92)] p-4'
                    : 'w-full h-10 rounded-full border px-3 sm:px-3.5 flex items-center justify-center select-none bg-[#10192D] border-white/[0.08] hover:border-white/[0.2] transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]'
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
                          <span className="text-xs font-medium text-slate-400">No new notifications</span>
                          <span className="text-[11px] text-slate-500">Activity and reminders will appear here</span>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-2.5 rounded-xl border transition-colors ${
                              n.read
                                ? 'bg-white/[0.02] border-white/[0.05] text-slate-400'
                                : 'bg-amber-400/[0.06] border-amber-400/20 text-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">
                                  {n.type === 'streak' ? '🔥' : n.type === 'habit' ? '⏰' : '🎯'}
                                </span>
                                <span className="text-xs font-bold text-white">{n.title}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                {n.time}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-normal">
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
                className="group h-10 rounded-full bg-[#10192D] border border-white/[0.08] hover:border-amber-400/50 shadow-sm px-3.5 sm:px-4 flex items-center gap-2 sm:gap-2.5 transition-all hover:bg-[#141F33] hover:shadow-[0_0_20px_rgba(250,204,21,0.18)] cursor-pointer select-none shrink-0"
                title="Create a free account or sign in to sync habits and tasks"
              >
                <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                  Save your progress <span className="text-[#FACC15] font-bold">Register</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ) : (
              <div
                className="relative transition-[width] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0"
                style={{
                  width:
                    activeDropdown === 'profile'
                      ? typeof window !== 'undefined' && window.innerWidth < 640
                        ? 288
                        : 320
                      : pillWidth,
                  height: 40,
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
                  className={`absolute right-0 top-0 w-full bg-[#10192D]/98 backdrop-blur-xl border transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] z-50 overflow-hidden cursor-pointer ${
                    activeDropdown === 'profile'
                      ? 'rounded-3xl border-[#FACC15] shadow-[0_0_32px_rgba(250,204,21,0.28),0_25px_60px_rgba(0,0,0,0.92)] p-4'
                      : 'h-10 rounded-full border-white/[0.08] hover:border-white/[0.2] shadow-sm px-3.5 sm:px-4 flex items-center hover:bg-[#141F33]'
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
                    <span className="text-xs font-semibold text-slate-200 hidden sm:inline whitespace-nowrap">
                      {getGreeting()}, <span className="text-[#FACC15] font-bold">{firstName}</span>{' '}
                      👏
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

                      {/* Section 1 */}
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
                          onClick={() => setActiveDropdown(null)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Bell className="w-4 h-4 text-slate-400" />
                            <span>Notification Preferences</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveDropdown(null);
                            navigate('/habits');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Sliders className="w-4 h-4 text-slate-400" />
                            <span>Habit & Goal Cadence</span>
                          </div>
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-white/[0.06]" />

                      {/* Section 2 */}
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

                        <button
                          type="button"
                          onClick={() => setActiveDropdown(null)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-slate-400" />
                            <span>Immutable Backup</span>
                          </div>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveDropdown(null)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Keyboard className="w-4 h-4 text-slate-400" />
                            <span>Shortcuts</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                            ?
                          </span>
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-white/[0.06]" />

                      {/* Section 3 */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveDropdown(null)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                            <span>Switch Workspace</span>
                          </div>
                          <span className="text-xs font-medium text-slate-400">Personal</span>
                        </button>

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
            )}
          </div>
        </header>

        {/* 3. Main Workspace Container - Full height touching bottom 0 aligned with topbar */}
        <main
          id="main-workspace"
          className="flex-1 bg-[#0E1628] border-t border-l border-white/[0.06] rounded-tl-3xl sm:rounded-tl-[2.5rem] overflow-y-auto px-6 sm:px-8 py-6 relative custom-scrollbar"
        >
          <Outlet />
        </main>
      </div>

      {/* User Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={isProfileSettingsOpen}
        onClose={() => setIsProfileSettingsOpen(false)}
      />
    </div>
  );
};
