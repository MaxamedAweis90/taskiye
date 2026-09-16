import React, { useState } from 'react';
import {
  Flame,
  Zap,
  Crown,
  ChevronUp,
} from 'lucide-react';
import { useSession } from '../lib/auth-client';
import { AddFriendModal } from '../components/rank/AddFriendModal';
import { LinkedInQrModal } from '../components/rank/LinkedInQrModal';

export interface LeaderboardMember {
  id: string;
  rank: number;
  name: string;
  handle: string;
  avatarUrl?: string;
  initials?: string;
  streakDays: number;
  consistency: number;
  isOnline: boolean;
  isCurrentUser?: boolean;
}

// Global leaderboard ranked purely by streak days
const GLOBAL_LEADERBOARD: LeaderboardMember[] = [
  {
    id: 'user_1',
    rank: 1,
    name: 'Elena Rostova',
    handle: '@elena_flow',
    initials: 'ER',
    streakDays: 48,
    consistency: 99.4,
    isOnline: true,
  },
  {
    id: 'user_2',
    rank: 2,
    name: 'Marcus Chen',
    handle: '@mchen_code',
    initials: 'MC',
    streakDays: 34,
    consistency: 97.8,
    isOnline: true,
  },
  {
    id: 'user_3',
    rank: 3,
    name: 'Sarah Jenkins',
    handle: '@sjenkins',
    initials: 'SJ',
    streakDays: 29,
    consistency: 96.5,
    isOnline: true,
  },
  {
    id: 'user_4',
    rank: 4,
    name: 'David Kim',
    handle: '@davidk',
    initials: 'DK',
    streakDays: 26,
    consistency: 95.0,
    isOnline: true,
  },
  {
    id: 'user_5',
    rank: 5,
    name: 'Maya Lin',
    handle: '@mayalin',
    initials: 'ML',
    streakDays: 22,
    consistency: 93.8,
    isOnline: true,
  },
  {
    id: 'user_6',
    rank: 6,
    name: 'Jonas Berg',
    handle: '@jberg',
    initials: 'JB',
    streakDays: 19,
    consistency: 91.4,
    isOnline: true,
  },
  {
    id: 'user_7',
    rank: 7,
    name: 'Sora Nakamura',
    handle: '@nakasora',
    initials: 'SN',
    streakDays: 18,
    consistency: 89.6,
    isOnline: false,
  },
  {
    id: 'user_current',
    rank: 14,
    name: 'Alex Morgan',
    handle: '@alexmorgan',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    streakDays: 12,
    consistency: 94.2,
    isOnline: true,
    isCurrentUser: true,
  },
];

const FRIENDS_LEADERBOARD: LeaderboardMember[] = [
  GLOBAL_LEADERBOARD[0],
  GLOBAL_LEADERBOARD[1],
  GLOBAL_LEADERBOARD[2],
  GLOBAL_LEADERBOARD[3],
  GLOBAL_LEADERBOARD[7], // Alex Morgan
];

export const Rank: React.FC = () => {
  const { data: session } = useSession();
  const [leagueType, setLeagueType] = useState<'friends' | 'global'>('friends');
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [isLinkedInQrModalOpen, setIsLinkedInQrModalOpen] = useState(false);

  const activeMembers = leagueType === 'friends' ? FRIENDS_LEADERBOARD : GLOBAL_LEADERBOARD;

  // Podium leaders (Top 3) sorted strictly by streak days
  const sortedByStreak = [...activeMembers].sort((a, b) => b.streakDays - a.streakDays);
  const top1 = sortedByStreak.find((m) => m.rank === 1) || sortedByStreak[0];
  const top2 = sortedByStreak.find((m) => m.rank === 2) || sortedByStreak[1];
  const top3 = sortedByStreak.find((m) => m.rank === 3) || sortedByStreak[2];

  // Table rows: Ranks #04 and below sorted strictly by streak days
  const tableRows = activeMembers
    .filter((m) => m.rank >= 4)
    .sort((a, b) => b.streakDays - a.streakDays);

  // Logged in user profile data
  const currentUser =
    activeMembers.find((m) => m.isCurrentUser) || {
      id: session?.user?.id || 'current_user',
      rank: 14,
      name: session?.user?.name || 'Alex Morgan',
      handle: '@alexmorgan',
      avatarUrl:
        session?.user?.image ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      streakDays: 12,
      consistency: 94.2,
      isOnline: true,
      isCurrentUser: true,
    };

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto pb-16 text-left">
      {/* 1. PAGE HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Leaderboard & Rank
            </h1>
            <span className="bg-amber-400/10 border border-amber-400/35 text-amber-300 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Weekly Sprint • Reset in 2d 14h</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
            Track peer accountability, consistency rates, and weekly habit velocity.
          </p>
        </div>

        {/* Top Right Controls: Segmented Pill Switch + Add Friend Button */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Segmented Switch: Friends Rank vs Global League */}
          <div className="bg-[#0B1322] border border-white/10 p-1 rounded-xl flex items-center shadow-inner">
            <button
              type="button"
              onClick={() => setLeagueType('friends')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                leagueType === 'friends'
                  ? 'bg-[#FACC15] text-slate-950 shadow-[0_0_12px_rgba(250,204,21,0.35)]'
                  : 'text-slate-400 hover:text-white font-semibold'
              }`}
            >
              Friends Rank
            </button>
            <button
              type="button"
              onClick={() => setLeagueType('global')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                leagueType === 'global'
                  ? 'bg-[#FACC15] text-slate-950 shadow-[0_0_12px_rgba(250,204,21,0.35)]'
                  : 'text-slate-400 hover:text-white font-semibold'
              }`}
            >
              Global League
            </button>
          </div>

          {/* Add Friend Button (Triggers AddFriendModal with searchbar & QR) */}
          <button
            type="button"
            onClick={() => setIsAddFriendModalOpen(true)}
            className="bg-[#FACC15] hover:bg-amber-300 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(250,204,21,0.25)] transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <span className="text-base font-bold leading-none">+</span>
            <span>+ Add Friend</span>
          </button>
        </div>
      </div>

      {/* 2. PINNED CURRENT-USER BANNER (Pure Streak & Consistency based, XP removed) */}
      <div className="bg-[#0B1322] border border-[#FACC15] rounded-2xl p-4 sm:p-5 shadow-[0_0_24px_rgba(250,204,21,0.12)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Section: Rank Badge, Avatar, Username, Tier, Streak & Velocity */}
        <div className="flex items-center gap-3.5">
          {/* Rank Badge */}
          <div className="border border-amber-400/40 bg-amber-400/10 rounded-xl px-2.5 py-1.5 text-center min-w-[50px] shadow-sm">
            <div className="text-[9px] font-bold text-amber-400/80 uppercase tracking-wider leading-none">
              RANK
            </div>
            <div className="text-base font-black text-[#FACC15] leading-tight mt-0.5">
              #{currentUser.rank}
            </div>
          </div>

          {/* User Avatar with YOU tag */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#FACC15] shadow-[0_0_10px_rgba(250,204,21,0.3)] bg-slate-800">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 bg-[#FACC15] text-slate-950 font-black text-[9px] px-1 py-0.2 rounded-full border border-slate-950 shadow-sm uppercase tracking-tight">
              YOU
            </span>
          </div>

          {/* User Details */}
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-black text-white leading-tight">
                {currentUser.name}
              </span>
              <span className="text-xs font-semibold text-slate-400">{currentUser.handle}</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-400/35 bg-amber-400/10 text-amber-300">
                Gold Tier
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <Zap className="w-3.5 h-3.5 fill-amber-400" />
                <span>{currentUser.streakDays} Days Streak</span>
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 font-medium">
                Daily Target Velocity:{' '}
                <span className="font-bold text-white">4/4 Habits Done</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Active Streak, Consistency %, Rank Delta (No XP) */}
        <div className="flex items-center gap-6 self-start lg:self-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-white/[0.08] w-full lg:w-auto justify-between lg:justify-end">
          {/* Active Streak */}
          <div className="text-left">
            <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">
              Active Streak
            </div>
            <div className="text-xl font-black text-[#FACC15] tracking-tight flex items-center gap-1.5">
              <Flame className="w-5 h-5 fill-amber-400 text-amber-400" />
              <span>{currentUser.streakDays} Days</span>
            </div>
          </div>

          {/* Consistency Percentage */}
          <div className="text-left">
            <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">
              Consistency
            </div>
            <div className="text-xl font-black text-emerald-400 tracking-tight">
              {currentUser.consistency}%
            </div>
          </div>

          {/* Rank Movement Indicator */}
          <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm shrink-0">
            <ChevronUp className="w-3.5 h-3.5 stroke-[3]" />
            <span>+3 this week</span>
          </div>
        </div>
      </div>

      {/* 3. TOP 3 PODIUM CARDS (Gold, Silver, Bronze - Pure Streak & Consistency) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2">
        {/* #2 SILVER MEDAL (Left card) */}
        {top2 && (
          <div className="bg-[#0B1322] border border-white/10 rounded-2xl p-5 flex flex-col justify-between min-h-[210px] shadow-lg order-2 md:order-1 transition-all hover:border-white/20">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-slate-200 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                    2
                  </div>
                  <span className="text-xs font-black text-slate-200 uppercase tracking-wider">
                    SILVER MEDAL
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-400">{top2.consistency}%</span>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-slate-700/60 border border-slate-500/40 text-slate-200 font-black text-sm flex items-center justify-center shrink-0">
                  {top2.initials}
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-black text-white leading-snug">{top2.name}</span>
                  <span className="text-xs font-medium text-slate-400">{top2.handle}</span>
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1 mt-1">
                    <Flame className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{top2.streakDays} Days Streak</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] mt-4">
              <span className="text-xs font-bold text-slate-400">Rank Factor</span>
              <span className="text-base font-black text-white tracking-tight flex items-center gap-1">
                <Flame className="w-4 h-4 text-slate-300 fill-slate-300" />
                <span>{top2.streakDays} Days</span>
              </span>
            </div>
          </div>
        )}

        {/* #1 GOLD LEADER (Center elevated card with CHAMPION pill & bright gold border) */}
        {top1 && (
          <div className="relative bg-[#0B1322] border-2 border-[#FACC15] rounded-2xl p-5 shadow-[0_0_32px_rgba(250,204,21,0.22)] flex flex-col justify-between min-h-[235px] order-1 md:order-2">
            {/* Elevated CHAMPION Pill Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FACC15] text-slate-950 text-[10px] font-black uppercase px-3 py-0.5 rounded-full flex items-center gap-1 shadow-md whitespace-nowrap">
              <Crown className="w-3 h-3 fill-slate-950" />
              <span>CHAMPION</span>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#FACC15] text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                    1
                  </div>
                  <span className="text-xs font-black text-[#FACC15] uppercase tracking-wider">
                    GOLD LEADER
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-400">{top1.consistency}%</span>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-amber-400/20 border-2 border-[#FACC15] text-[#FACC15] font-black text-sm flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(250,204,21,0.35)]">
                  {top1.initials}
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-black text-white leading-snug">{top1.name}</span>
                  <span className="text-xs font-medium text-slate-400">{top1.handle}</span>
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1 mt-1">
                    <Flame className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{top1.streakDays} Days Streak</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-amber-400/20 mt-4">
              <span className="text-xs font-bold text-slate-400">Rank Factor</span>
              <span className="text-base font-black text-[#FACC15] tracking-tight flex items-center gap-1">
                <Flame className="w-4 h-4 fill-amber-400" />
                <span>{top1.streakDays} Days</span>
              </span>
            </div>
          </div>
        )}

        {/* #3 BRONZE MEDAL (Right card) */}
        {top3 && (
          <div className="bg-[#0B1322] border border-white/10 rounded-2xl p-5 flex flex-col justify-between min-h-[210px] shadow-lg order-3 md:order-3 transition-all hover:border-white/20">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                    3
                  </div>
                  <span className="text-xs font-black text-amber-500 uppercase tracking-wider">
                    BRONZE MEDAL
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-400">{top3.consistency}%</span>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-amber-800/30 border border-amber-600/40 text-amber-400 font-black text-sm flex items-center justify-center shrink-0">
                  {top3.initials}
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-black text-white leading-snug">{top3.name}</span>
                  <span className="text-xs font-medium text-slate-400">{top3.handle}</span>
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1 mt-1">
                    <Flame className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{top3.streakDays} Days Streak</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] mt-4">
              <span className="text-xs font-bold text-slate-400">Rank Factor</span>
              <span className="text-base font-black text-white tracking-tight flex items-center gap-1">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>{top3.streakDays} Days</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. LEADERBOARD TABLE (Ranks #04 and below - Streak and Consistency only) */}
      <div className="bg-[#0B1322] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col gap-3">
        {/* Column Headers */}
        <div className="grid grid-cols-12 px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-white/[0.06]">
          <div className="col-span-2 sm:col-span-1">RANK</div>
          <div className="col-span-5 sm:col-span-5">MEMBER</div>
          <div className="col-span-2 sm:col-span-3 text-right sm:text-left">ACTIVE STREAK</div>
          <div className="col-span-2 sm:col-span-2 text-right sm:text-left">CONSISTENCY</div>
          <div className="col-span-1 sm:col-span-1 text-center">STATUS</div>
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-1.5">
          {tableRows.map((member) => {
            const isUser = member.isCurrentUser;

            return (
              <div
                key={member.id}
                className={`grid grid-cols-12 items-center px-3 py-3 rounded-xl transition-all ${
                  isUser
                    ? 'border border-[#FACC15] bg-[#FACC15]/[0.04] shadow-[0_0_20px_rgba(250,204,21,0.12)]'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                {/* RANK */}
                <div className="col-span-2 sm:col-span-1">
                  <span
                    className={`font-mono text-sm font-black ${
                      isUser ? 'text-[#FACC15]' : 'text-slate-400'
                    }`}
                  >
                    #{String(member.rank).padStart(2, '0')}
                  </span>
                </div>

                {/* MEMBER */}
                <div className="col-span-5 sm:col-span-5 flex items-center gap-3 min-w-0 pr-2">
                  {/* Avatar */}
                  {member.avatarUrl ? (
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-amber-400/50 bg-slate-800">
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {isUser && (
                        <span className="absolute -bottom-1 -right-1 bg-[#FACC15] text-slate-950 font-black text-[8px] px-1 rounded-full border border-slate-950">
                          YOU
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700/60 border border-slate-500/30 text-slate-300 font-black text-xs flex items-center justify-center shrink-0">
                      {member.initials}
                    </div>
                  )}

                  {/* Name and Handle */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className={`text-sm font-bold truncate ${
                          isUser ? 'text-[#FACC15]' : 'text-white'
                        }`}
                      >
                        {member.name}
                      </span>
                      {isUser && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-[#FACC15] text-slate-950">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate font-medium">
                      <span>{member.handle}</span>
                    </div>
                  </div>
                </div>

                {/* ACTIVE STREAK (Primary Ranking Factor) */}
                <div className="col-span-2 sm:col-span-3 text-right sm:text-left font-mono text-sm font-extrabold flex items-center gap-1.5">
                  <Flame
                    className={`w-4 h-4 shrink-0 ${
                      isUser
                        ? 'fill-amber-400 text-amber-400'
                        : member.streakDays >= 20
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-500 text-slate-500'
                    }`}
                  />
                  <span className={isUser ? 'text-[#FACC15]' : 'text-white'}>
                    {member.streakDays} <span className="text-xs font-semibold text-slate-400">days</span>
                  </span>
                </div>

                {/* CONSISTENCY */}
                <div className="col-span-2 sm:col-span-2 flex items-center gap-2.5 justify-end sm:justify-start">
                  <span className="text-xs font-bold text-slate-300 min-w-[42px]">
                    {member.consistency}%
                  </span>
                  {/* Mini green consistency progress bar */}
                  <div className="hidden sm:block w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                      style={{ width: `${Math.min(100, member.consistency)}%` }}
                    />
                  </div>
                </div>

                {/* STATUS (Online indicator) */}
                <div className="col-span-1 sm:col-span-1 flex items-center justify-center">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      member.isOnline
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                        : 'bg-slate-600'
                    }`}
                    title={member.isOnline ? 'Online' : 'Offline'}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. ADD FRIEND MODAL (Opens with searchbar, far-right LinkedIn QR icon, and live user list with Connect buttons) */}
      <AddFriendModal
        isOpen={isAddFriendModalOpen}
        onClose={() => setIsAddFriendModalOpen(false)}
        onOpenQr={() => setIsLinkedInQrModalOpen(true)}
      />

      {/* 6. LINKEDIN-STYLE MOBILE FULLSCREEN QR MODAL (Real QR Code Generator + Real Camera jsQR Scanner) */}
      <LinkedInQrModal
        isOpen={isLinkedInQrModalOpen}
        onClose={() => setIsLinkedInQrModalOpen(false)}
        currentUser={{
          name: currentUser.name,
          handle: currentUser.handle,
          avatarUrl: currentUser.avatarUrl,
        }}
      />
    </div>
  );
};

export default Rank;
