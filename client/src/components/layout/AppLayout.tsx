import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  CheckSquare,
  Sparkles,
  Target,
  Search,
  Bell,
  User as UserIcon,
  LogOut,
  ShieldAlert,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Moon,
  ShieldCheck,
  Keyboard,
  ArrowLeftRight,
  Sliders,
} from 'lucide-react';
import { useSession, signOut } from '../../lib/auth-client';
import { useTaskiyeStore, GUEST_ITEM_LIMIT } from '../../store/useTaskiyeStore';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'OVERVIEW', icon: LayoutGrid },
  { to: '/habits', label: 'HABITS', icon: Sparkles },
  { to: '/tasks', label: 'TASKS', icon: CheckSquare },
  { to: '/goals', label: 'GOALS', icon: Target },
];

export const AppLayout: React.FC = () => {
  const { data: session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const { getGuestItemCount, openAuthModal, habits } = useTaskiyeStore();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const guestItemCount = getGuestItemCount();
  const usagePercentage = Math.min(100, Math.round((guestItemCount / GUEST_ITEM_LIMIT) * 100));

  const maxStreak = useMemo(() => {
    if (habits && habits.length > 0) {
      return Math.max(...habits.map((h) => h.streakDays || 0), 14);
    }
    return 14;
  }, [habits]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleSignOut = async () => {
    try {
      await signOut();
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

  const displayName = user?.name || user?.username || 'Alex Morgan';
  const firstName = displayName.split(' ')[0] || 'Alex';
  const email = user?.email || 'alex.design@taskiye.app';
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
        <header className="h-16 sm:h-20 shrink-0 px-6 sm:px-8 pr-6 sm:pr-8 flex items-center justify-between gap-4 z-10">
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
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* 1. Streak Button (with Fire Icon, to the left of Notification Bell) */}
            <button
              type="button"
              onClick={() => navigate('/habits')}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-[#10192D] hover:bg-[#162035] border border-white/[0.08] hover:border-amber-400/40 text-xs font-bold text-slate-200 transition-all cursor-pointer shadow-sm group select-none"
              title={`Current Habit Streak: ${maxStreak} Days`}
            >
              <span className="text-sm group-hover:scale-110 transition-transform">🔥</span>
              <span className="text-[#FACC15] font-extrabold">{maxStreak}</span>
              <span className="text-slate-400 font-semibold text-[11px] hidden sm:inline">Days</span>
            </button>

            {/* 2. Notification Bell */}
            <button
              type="button"
              className="w-10 h-10 rounded-2xl bg-[#10192D] border border-white/[0.08] hover:border-white/[0.15] text-slate-300 hover:text-white flex items-center justify-center transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#10192D]" />
            </button>

            {/* 3. User Avatar / Greeting Pill & Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-2.5 bg-[#10192D] hover:bg-[#141F33] border rounded-full pl-3.5 sm:pl-4 pr-2.5 py-1.5 transition-all cursor-pointer select-none ${
                  isDropdownOpen
                    ? 'border-[#FACC15] shadow-[0_0_16px_rgba(250,204,21,0.35)]'
                    : 'border-white/[0.08] hover:border-white/[0.15]'
                }`}
              >
                <span className="text-xs font-semibold text-slate-200 hidden sm:inline">
                  {getGreeting()},{' '}
                  <span className="text-[#FACC15] font-bold">{firstName}</span> 👏
                </span>

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

                {isDropdownOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-[#FACC15] stroke-[2.5]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#FACC15] stroke-[2.5]" />
                )}
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-2.5 w-72 sm:w-80 bg-[#10192D] border border-white/10 rounded-2xl p-4 shadow-[0_25px_60px_rgba(0,0,0,0.85)] z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3 text-left select-none">
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
                        <span className="text-sm font-bold text-white truncate">{displayName}</span>
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
                      onClick={() => setIsDropdownOpen(false)}
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
                      onClick={() => setIsDropdownOpen(false)}
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
                        setIsDropdownOpen(false);
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
                      onClick={() => setIsDropdownOpen(false)}
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
                      onClick={() => setIsDropdownOpen(false)}
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
                      onClick={() => setIsDropdownOpen(false)}
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
                      onClick={() => setIsDropdownOpen(false)}
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
                        setIsDropdownOpen(false);
                        if (session?.user) {
                          handleSignOut();
                        } else {
                          openAuthModal('manual');
                        }
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <LogOut className="w-4 h-4 text-rose-400" />
                        <span>{session?.user ? 'Sign Out' : 'Sign In / Account'}</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 3. Main Workspace Container - Full height touching bottom 0 aligned with topbar */}
        <main id="main-workspace" className="flex-1 bg-[#0E1628] border-t border-l border-white/[0.06] rounded-tl-3xl sm:rounded-tl-[2.5rem] overflow-y-auto px-6 sm:px-8 py-6 relative custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
