import React, { useState } from 'react';
import {
  Flame,
  Zap,
  Crown,
  Loader2,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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
  totalCompletions?: number;
  isOnline: boolean;
  isCurrentUser?: boolean;
}

interface ServerRankItem {
  userId: string;
  rank: number;
  userName: string;
  handle: string;
  userAvatar?: string;
  initials?: string;
  streakCount: number;
  consistencyRate: number;
  totalCompletions: number;
  isOnline: boolean;
  isCurrentUser?: boolean;
}

interface RankingsApiResponse {
  type: 'friends' | 'global';
  currentUser: ServerRankItem;
  leaderboard: ServerRankItem[];
}

export const Rank: React.FC = () => {
  const { data: session } = useSession();
  const [leagueType, setLeagueType] = useState<'friends' | 'global'>('friends');
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [isLinkedInQrModalOpen, setIsLinkedInQrModalOpen] = useState(false);

  // Fetch real registered users and live streak rankings from database
  const { data: rankData, isLoading } = useQuery<RankingsApiResponse>({
    queryKey: ['rankings', leagueType],
    queryFn: async () => {
      const res = await fetch(`/api/rankings?type=${leagueType}`, {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data;
    },
  });

  const activeMembers: LeaderboardMember[] = (rankData?.leaderboard || []).map((m) => ({
    id: m.userId,
    rank: m.rank,
    name: m.userName,
    handle: m.handle,
    avatarUrl: m.userAvatar || undefined,
    initials: m.initials || 'U',
    streakDays: m.streakCount,
    consistency: m.consistencyRate,
    totalCompletions: m.totalCompletions,
    isOnline: m.isOnline ?? true,
    isCurrentUser: m.isCurrentUser,
  }));

  // Podium leaders (Top 3) sorted strictly by streak days
  const top1 = activeMembers.find((m) => m.rank === 1);
  const top2 = activeMembers.find((m) => m.rank === 2);
  const top3 = activeMembers.find((m) => m.rank === 3);

  // Table rows: Ranks #04 and below
  const tableRows = activeMembers.filter((m) => m.rank >= 4);

  // Current user item from database response or active session
  const currentUserServer = rankData?.currentUser;
  const currentUser: LeaderboardMember = currentUserServer
    ? {
        id: currentUserServer.userId,
        rank: currentUserServer.rank,
        name: currentUserServer.userName,
        handle: currentUserServer.handle,
        avatarUrl: currentUserServer.userAvatar || session?.user?.image || undefined,
        initials: currentUserServer.initials || 'U',
        streakDays: currentUserServer.streakCount,
        consistency: currentUserServer.consistencyRate,
        totalCompletions: currentUserServer.totalCompletions,
        isOnline: true,
        isCurrentUser: true,
      }
    : {
        id: session?.user?.id || 'current_user',
        rank: 1,
        name: session?.user?.name || 'You',
        handle: `@${(session?.user?.name || 'you').toLowerCase().replace(/\s+/g, '')}`,
        avatarUrl: session?.user?.image || undefined,
        initials: (session?.user?.name || 'Y').slice(0, 2).toUpperCase(),
        streakDays: 0,
        consistency: 100,
        totalCompletions: 0,
        isOnline: true,
        isCurrentUser: true,
      };

  const getTierBadge = (streak: number) => {
    if (streak >= 30) return 'Diamond Tier';
    if (streak >= 14) return 'Gold Tier';
    if (streak >= 7) return 'Silver Tier';
    return 'Bronze Tier';
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
              <span>All-Time Streak League • Ongoing</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
            Track peer accountability, consistency rates, and all-time streak ranking.
          </p>
        </div>

        {/* Top Right Controls: Segmented Pill Switch + Add Friend Button */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full md:w-auto">
          {/* Segmented Switch: Friends Rank vs Global League */}
          <div className="bg-[#0B1322] border border-white/10 p-1 rounded-xl flex items-center shadow-inner flex-1 sm:flex-initial justify-center">
            <button
              type="button"
              onClick={() => setLeagueType('friends')}
              className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer text-center whitespace-nowrap ${
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
              className={`flex-1 sm:flex-initial px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer text-center whitespace-nowrap ${
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
            className="bg-[#FACC15] hover:bg-amber-300 text-slate-950 font-black px-3.5 sm:px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(250,204,21,0.25)] transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
          >
            <span className="text-base font-bold leading-none">+</span>
            <span>+ Add Friend</span>
          </button>
        </div>
      </div>

      {/* 2. PINNED CURRENT-USER BANNER (Real streak & consistency based) */}
      <div className="bg-[#0B1322] border border-[#FACC15] rounded-2xl p-3.5 sm:p-5 shadow-[0_0_24px_rgba(250,204,21,0.12)] flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
        {/* Left Section: Rank Badge, Avatar, Username, Tier, Streak & Completions */}
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
          {/* Rank Badge */}
          <div className="border border-amber-400/40 bg-amber-400/10 rounded-xl px-2 sm:px-2.5 py-1.5 text-center min-w-[44px] sm:min-w-[50px] shadow-sm shrink-0">
            <div className="text-[8.5px] sm:text-[9px] font-bold text-amber-400/80 uppercase tracking-wider leading-none">
              RANK
            </div>
            <div className="text-sm sm:text-base font-black text-[#FACC15] leading-tight mt-0.5">
              #{currentUser.rank}
            </div>
          </div>

          {/* User Avatar with YOU tag */}
          <div className="relative shrink-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden ring-2 ring-[#FACC15] shadow-[0_0_10px_rgba(250,204,21,0.3)] bg-slate-800 flex items-center justify-center">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-black text-[#FACC15]">{currentUser.initials}</span>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 bg-[#FACC15] text-slate-950 font-black text-[8px] sm:text-[9px] px-1 py-0.2 rounded-full border border-slate-950 shadow-sm uppercase tracking-tight">
              YOU
            </span>
          </div>

          {/* User Details */}
          <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-base font-black text-white leading-tight truncate">
                {currentUser.name}
              </span>
              <span className="text-xs font-semibold text-slate-400 truncate">{currentUser.handle}</span>
              <span className="text-[9.5px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-400/35 bg-amber-400/10 text-amber-300 whitespace-nowrap">
                {getTierBadge(currentUser.streakDays)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-slate-300">
              <span className="text-amber-400 flex items-center gap-1 font-bold whitespace-nowrap">
                <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400" />
                <span>{currentUser.streakDays}d Streak</span>
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 font-medium whitespace-nowrap">
                Completions: <span className="font-bold text-white">{currentUser.totalCompletions ?? 0} total</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Active Streak, Consistency %, Rank Status */}
        <div className="flex items-center gap-3 sm:gap-6 self-stretch lg:self-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-white/[0.08] w-full lg:w-auto justify-between lg:justify-end">
          {/* Active Streak */}
          <div className="text-left">
            <div className="text-[10px] sm:text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">
              Active Streak
            </div>
            <div className="text-base sm:text-xl font-black text-[#FACC15] tracking-tight flex items-center gap-1">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 text-amber-400 shrink-0" />
              <span>{currentUser.streakDays} Days</span>
            </div>
          </div>

          {/* Consistency Percentage */}
          <div className="text-left">
            <div className="text-[10px] sm:text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">
              Consistency
            </div>
            <div className="text-base sm:text-xl font-black text-emerald-400 tracking-tight">
              {currentUser.consistency}%
            </div>
          </div>

          {/* Rank Badge */}
          <div className="bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[11px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap">
            <Flame className="w-3.5 h-3.5 fill-amber-400" />
            <span>Rank #{currentUser.rank}</span>
          </div>
        </div>
      </div>

      {/* LOADING SPINNER */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-7 h-7 text-[#FACC15] animate-spin" />
          <span className="text-xs font-medium">Loading live streak rankings...</span>
        </div>
      )}

      {/* EMPTY FRIENDS STATE */}
      {!isLoading && activeMembers.length === 0 && (
        <div className="bg-[#0B1322] border border-white/10 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 my-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-[#FACC15] flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No Friends in Ranking Yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Connect with rivals to start your streak competition. Search users or scan QR to challenge them.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddFriendModalOpen(true)}
            className="bg-[#FACC15] hover:bg-amber-300 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(250,204,21,0.25)]"
          >
            <span>+ Add Friend</span>
          </button>
        </div>
      )}

      {/* 3A. MOBILE ONLY: CIRCULAR TOP 3 PODIUM */}
      {!isLoading && activeMembers.length > 0 && (
        <div className="md:hidden bg-[#0B1322] border border-white/10 rounded-2xl p-4 shadow-lg pt-6">
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
              Top 3 Podium
            </span>
            <span className="text-[10.5px] font-bold text-amber-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-amber-400" />
              Ranked by Streak
            </span>
          </div>

          <div className="flex items-end justify-center gap-2.5 px-1 pb-1">
            {/* #2 SILVER (Left Circle) */}
            {top2 && (
              <div className="flex flex-col items-center flex-1 max-w-[100px] text-center">
                <div className="relative mb-2">
                  <div className="w-14 h-14 rounded-full border-2 border-slate-300 bg-slate-800 text-slate-200 font-black text-base flex items-center justify-center overflow-hidden shadow-[0_0_12px_rgba(203,213,225,0.2)]">
                    {top2.avatarUrl ? (
                      <img src={top2.avatarUrl} alt={top2.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{top2.initials}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-300 text-slate-950 font-black text-[10px] flex items-center justify-center shadow">
                    2
                  </div>
                </div>

                <span className="text-xs font-black text-white truncate w-full leading-tight">
                  {top2.name.split(' ')[0]}
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate w-full">
                  {top2.handle}
                </span>
                <div className="mt-1 flex items-center justify-center gap-0.5 text-xs font-black text-slate-200">
                  <Flame className="w-3.5 h-3.5 text-slate-300 fill-slate-300 shrink-0" />
                  <span>{top2.streakDays}d</span>
                </div>
                <span className="text-[9.5px] font-bold text-emerald-400 mt-0.5">
                  {top2.consistency}%
                </span>
              </div>
            )}

            {/* #1 GOLD CHAMPION (Center Elevated Circle) */}
            {top1 && (
              <div className="flex flex-col items-center flex-1 max-w-[115px] text-center -translate-y-2">
                <Crown className="w-5 h-5 text-[#FACC15] fill-[#FACC15] drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] mb-0.5" />
                <div className="relative mb-2">
                  <div className="w-16 h-16 rounded-full border-2 border-[#FACC15] bg-amber-400/20 text-[#FACC15] font-black text-lg flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(250,204,21,0.4)]">
                    {top1.avatarUrl ? (
                      <img src={top1.avatarUrl} alt={top1.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{top1.initials}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#FACC15] text-slate-950 font-black text-[10px] flex items-center justify-center shadow-md">
                    1
                  </div>
                </div>

                <span className="text-xs font-black text-white truncate w-full leading-tight">
                  {top1.name.split(' ')[0]}
                </span>
                <span className="text-[10px] text-amber-300 font-bold truncate w-full">
                  {top1.handle}
                </span>
                <div className="mt-1 flex items-center justify-center gap-0.5 text-xs font-black text-[#FACC15]">
                  <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                  <span>{top1.streakDays}d</span>
                </div>
                <span className="text-[9.5px] font-bold text-emerald-400 mt-0.5">
                  {top1.consistency}%
                </span>
              </div>
            )}

            {/* #3 BRONZE (Right Circle) */}
            {top3 && (
              <div className="flex flex-col items-center flex-1 max-w-[100px] text-center">
                <div className="relative mb-2">
                  <div className="w-14 h-14 rounded-full border-2 border-amber-600 bg-amber-950/40 text-amber-400 font-black text-base flex items-center justify-center overflow-hidden shadow-[0_0_12px_rgba(217,119,6,0.25)]">
                    {top3.avatarUrl ? (
                      <img src={top3.avatarUrl} alt={top3.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{top3.initials}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-amber-600 text-white font-black text-[10px] flex items-center justify-center shadow">
                    3
                  </div>
                </div>

                <span className="text-xs font-black text-white truncate w-full leading-tight">
                  {top3.name.split(' ')[0]}
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate w-full">
                  {top3.handle}
                </span>
                <div className="mt-1 flex items-center justify-center gap-0.5 text-xs font-black text-amber-400">
                  <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                  <span>{top3.streakDays}d</span>
                </div>
                <span className="text-[9.5px] font-bold text-emerald-400 mt-0.5">
                  {top3.consistency}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3B. DESKTOP ONLY: TOP 3 PODIUM CARDS */}
      {!isLoading && activeMembers.length > 0 && (
        <div className="hidden md:grid md:grid-cols-3 gap-4 items-end pt-2">
          {/* #2 SILVER MEDAL (Left card) */}
          {top2 ? (
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
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-700/60 border border-slate-500/40 text-slate-200 font-black text-sm flex items-center justify-center shrink-0">
                    {top2.avatarUrl ? (
                      <img src={top2.avatarUrl} alt={top2.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{top2.initials}</span>
                    )}
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
          ) : (
            <div className="hidden md:block order-2 md:order-1" />
          )}

          {/* #1 GOLD LEADER (Center elevated card with CHAMPION pill) */}
          {top1 ? (
            <div className="relative bg-[#0B1322] border-2 border-[#FACC15] rounded-2xl p-5 shadow-[0_0_32px_rgba(250,204,21,0.22)] flex flex-col justify-between min-h-[235px] order-1 md:order-2">
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
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-amber-400/20 border-2 border-[#FACC15] text-[#FACC15] font-black text-sm flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(250,204,21,0.35)]">
                    {top1.avatarUrl ? (
                      <img src={top1.avatarUrl} alt={top1.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{top1.initials}</span>
                    )}
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
          ) : (
            <div className="hidden md:block order-1 md:order-2" />
          )}

          {/* #3 BRONZE MEDAL (Right card) */}
          {top3 ? (
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
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-amber-800/30 border border-amber-600/40 text-amber-400 font-black text-sm flex items-center justify-center shrink-0">
                    {top3.avatarUrl ? (
                      <img src={top3.avatarUrl} alt={top3.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{top3.initials}</span>
                    )}
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
          ) : (
            <div className="hidden md:block order-3 md:order-3" />
          )}
        </div>
      )}

      {/* 4. LEADERBOARD TABLE (Ranks #04 and below) */}
      {!isLoading && activeMembers.length > 0 && (
        <div className="bg-[#0B1322] border border-white/10 rounded-2xl p-3.5 sm:p-6 shadow-xl flex flex-col gap-3">
          {/* Column Headers */}
          <div className="grid grid-cols-12 px-2 sm:px-3 py-2 text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-white/[0.06]">
            <div className="col-span-2 sm:col-span-1">RANK</div>
            <div className="col-span-6 sm:col-span-5">MEMBER</div>
            <div className="col-span-2 sm:col-span-3 text-right sm:text-left">
              <span className="sm:hidden">STREAK</span>
              <span className="hidden sm:inline">ACTIVE STREAK</span>
            </div>
            <div className="col-span-2 sm:col-span-2 text-right sm:text-left">
              <span className="sm:hidden">RATE</span>
              <span className="hidden sm:inline">CONSISTENCY</span>
            </div>
            <div className="hidden sm:block sm:col-span-1 text-center">STATUS</div>
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-1.5">
            {tableRows.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-1">
                <span>No additional rivals in this tier yet.</span>
                <span className="text-slate-500 text-[11px]">
                  Keep building your streak to maintain your rank!
                </span>
              </div>
            ) : (
              tableRows.map((member) => {
                const isUser = member.isCurrentUser;

                return (
                  <div
                    key={member.id}
                    className={`grid grid-cols-12 items-center px-2 sm:px-3 py-2.5 sm:py-3 rounded-xl transition-all ${
                      isUser
                        ? 'border border-[#FACC15] bg-[#FACC15]/[0.04] shadow-[0_0_20px_rgba(250,204,21,0.12)]'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* RANK */}
                    <div className="col-span-2 sm:col-span-1">
                      <span
                        className={`font-mono text-xs sm:text-sm font-black ${
                          isUser ? 'text-[#FACC15]' : 'text-slate-400'
                        }`}
                      >
                        #{String(member.rank).padStart(2, '0')}
                      </span>
                    </div>

                    {/* MEMBER */}
                    <div className="col-span-6 sm:col-span-5 flex items-center gap-2 sm:gap-3 min-w-0 pr-1 sm:pr-2">
                      <div className="relative shrink-0">
                        {member.avatarUrl ? (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden ring-1 ring-amber-400/50 bg-slate-800">
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-700/60 border border-slate-500/30 text-slate-300 font-black text-xs flex items-center justify-center shrink-0">
                            {member.initials}
                          </div>
                        )}

                        <div
                          className={`absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border-2 border-[#0B1322] ${
                            member.isOnline
                              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                              : 'bg-slate-600'
                          }`}
                          title={member.isOnline ? 'Online' : 'Offline'}
                        />

                        {isUser && (
                          <span className="absolute -bottom-1 -right-1 bg-[#FACC15] text-slate-950 font-black text-[7px] sm:text-[8px] px-1 rounded-full border border-slate-950">
                            YOU
                          </span>
                        )}
                      </div>

                      {/* Name and Handle */}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`text-xs sm:text-sm font-bold truncate ${
                              isUser ? 'text-[#FACC15]' : 'text-white'
                            }`}
                          >
                            {member.name}
                          </span>
                          {isUser && (
                            <span className="text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.2 rounded bg-[#FACC15] text-slate-950">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-400 truncate font-medium">
                          <span>{member.handle}</span>
                        </div>
                      </div>
                    </div>

                    {/* ACTIVE STREAK */}
                    <div className="col-span-2 sm:col-span-3 text-right sm:text-left font-mono text-xs sm:text-sm font-extrabold flex items-center justify-end sm:justify-start gap-1 sm:gap-1.5">
                      <Flame
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                          isUser
                            ? 'fill-amber-400 text-amber-400'
                            : member.streakDays >= 20
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-slate-500 text-slate-500'
                        }`}
                      />
                      <span className={isUser ? 'text-[#FACC15]' : 'text-white'}>
                        {member.streakDays}
                        <span className="sm:hidden text-[11px]">d</span>
                        <span className="hidden sm:inline text-xs font-semibold text-slate-400 ml-1">days</span>
                      </span>
                    </div>

                    {/* CONSISTENCY */}
                    <div className="col-span-2 sm:col-span-2 flex items-center gap-2 justify-end sm:justify-start">
                      <span className="text-xs font-bold text-slate-300">
                        {member.consistency}%
                      </span>
                      <div className="hidden sm:block w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                          style={{ width: `${Math.min(100, member.consistency)}%` }}
                        />
                      </div>
                    </div>

                    {/* STATUS */}
                    <div className="hidden sm:flex sm:col-span-1 items-center justify-center">
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
              })
            )}
          </div>
        </div>
      )}

      {/* 5. ADD FRIEND MODAL (Live search + Connect + Mobile QR icon) */}
      <AddFriendModal
        isOpen={isAddFriendModalOpen}
        onClose={() => setIsAddFriendModalOpen(false)}
        onOpenQr={() => setIsLinkedInQrModalOpen(true)}
      />

      {/* 6. LINKEDIN-STYLE MOBILE FULLSCREEN QR MODAL */}
      <LinkedInQrModal
        isOpen={isLinkedInQrModalOpen}
        onClose={() => setIsLinkedInQrModalOpen(false)}
        currentUser={{
          name: currentUser.name,
          handle: currentUser.handle,
          avatarUrl: currentUser.avatarUrl || undefined,
        }}
      />
    </div>
  );
};

export default Rank;
