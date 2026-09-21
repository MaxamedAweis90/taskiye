import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  UserPlus,
  Search,
  QrCode,
  Check,
  Flame,
  CheckCircle2,
  Loader2,
  Clock,
  UserCheck,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { useTaskiyeStore } from '../../store/useTaskiyeStore';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQr: () => void;
  currentUsername?: string;
}

interface CommunityMember {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  initials: string;
  streakDays: number;
  consistency: number;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  isOpen,
  onClose,
  onOpenQr,
}) => {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { openAuthModal } = useTaskiyeStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [connectedHandles, setConnectedHandles] = useState<Record<string, boolean>>({});
  const [loadingHandle, setLoadingHandle] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const currentUserId = session?.user?.id ? String(session.user.id) : '';
  const currentUserName = session?.user?.name || '';
  const currentUserHandle = `@${currentUserName.toLowerCase().replace(/\s+/g, '')}`;

  // Live query for current friendships to determine LinkedIn connection status
  const { data: friendsData } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const res = await apiFetch('/api/friends');
      if (!res.ok) return { friends: [], pendingIncoming: [], pendingOutgoing: [] };
      const json = await res.json();
      return json.data;
    },
    enabled: isOpen && Boolean(session?.user),
  });

  const acceptedFriendUserIds = useMemo(() => {
    const s = new Set<string>();
    (friendsData?.friends || []).forEach((f: { id?: string; userId?: string; handle?: string }) => {
      if (f.id) s.add(String(f.id));
      if (f.userId) s.add(String(f.userId));
      if (f.handle) s.add(f.handle.toLowerCase());
    });
    return s;
  }, [friendsData?.friends]);

  const pendingOutgoingUserIds = useMemo(() => {
    const s = new Set<string>();
    (friendsData?.pendingOutgoing || []).forEach((f: { id?: string; userId?: string; handle?: string }) => {
      if (f.id) s.add(String(f.id));
      if (f.userId) s.add(String(f.userId));
      if (f.handle) s.add(f.handle.toLowerCase());
    });
    return s;
  }, [friendsData?.pendingOutgoing]);

  const pendingIncomingMap = useMemo(() => {
    const map = new Map<string, string>();
    (friendsData?.pendingIncoming || []).forEach((f: { friendshipId?: string; id?: string; userId?: string; handle?: string }) => {
      const fId = f.friendshipId || '';
      if (f.id) map.set(String(f.id), fId);
      if (f.userId) map.set(String(f.userId), fId);
      if (f.handle) map.set(f.handle.toLowerCase(), fId);
    });
    return map;
  }, [friendsData?.pendingIncoming]);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    setIsSearching(true);

    const timeout = setTimeout(async () => {
      try {
        const clean = searchQuery.trim().replace(/^@/, '');
        const res = await apiFetch(`/api/friends/search?q=${encodeURIComponent(clean)}`);
        const json = await res.json();
        if (!isCancelled && json.data) {
          setMembers(json.data);
        }
      } catch (err) {
        console.error('Failed to search friends:', err);
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery, isOpen]);

  if (!isOpen) return null;

  const handleConnect = async (member: CommunityMember) => {
    // 1. Guest check: prompt login
    if (!session?.user) {
      openAuthModal('manual', 'signin');
      setNotificationToast('Please sign in to connect with rivals & friends!');
      setTimeout(() => setNotificationToast(null), 4000);
      return;
    }

    // 2. Client-side self check
    if (
      (currentUserId && member.id === currentUserId) ||
      member.handle.toLowerCase() === currentUserHandle.toLowerCase()
    ) {
      setNotificationToast("That's you! 👋 Share your handle or QR with a friend so they can add you.");
      setTimeout(() => setNotificationToast(null), 4000);
      return;
    }

    setLoadingHandle(member.handle);
    try {
      const res = await apiFetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: member.id,
          targetUsername: member.handle,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setConnectedHandles((prev) => ({
          ...prev,
          [member.handle]: true,
          [member.id]: true,
        }));
        await queryClient.invalidateQueries({ queryKey: ['friends'] });
        await queryClient.invalidateQueries({ queryKey: ['rankings'] });
        setNotificationToast(data.message || `Friend request sent to ${member.name}! Rivalry challenge delivered.`);
        setTimeout(() => setNotificationToast(null), 3500);
      } else {
        setNotificationToast(data.message || 'Could not send friend request.');
        setTimeout(() => setNotificationToast(null), 3500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setNotificationToast(`Could not send request: ${msg}`);
      setTimeout(() => setNotificationToast(null), 3500);
    } finally {
      setLoadingHandle(null);
    }
  };

  const handleCancelRequest = async (member: CommunityMember) => {
    setLoadingHandle(member.handle);
    try {
      const res = await apiFetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: member.id }),
      });
      if (res.ok) {
        setConnectedHandles((prev) => {
          const copy = { ...prev };
          delete copy[member.handle];
          delete copy[member.id];
          return copy;
        });
        await queryClient.invalidateQueries({ queryKey: ['friends'] });
        await queryClient.invalidateQueries({ queryKey: ['rankings'] });
        setNotificationToast(`Invitation to ${member.name} cancelled.`);
        setTimeout(() => setNotificationToast(null), 3000);
      }
    } catch {
      setNotificationToast('Failed to cancel request.');
      setTimeout(() => setNotificationToast(null), 3000);
    } finally {
      setLoadingHandle(null);
    }
  };

  const handleAcceptIncoming = async (friendshipId: string, memberName: string) => {
    setLoadingHandle(friendshipId);
    try {
      const res = await apiFetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId, action: 'ACCEPT' }),
      });
      const data = await res.json();
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ['friends'] });
        await queryClient.invalidateQueries({ queryKey: ['rankings'] });
        await queryClient.invalidateQueries({ queryKey: ['notifications'] });
        setNotificationToast(`Connected with ${memberName}! 🎉 Challenge accepted.`);
        setTimeout(() => setNotificationToast(null), 3500);
      } else {
        setNotificationToast(data.message || 'Could not accept request');
        setTimeout(() => setNotificationToast(null), 3500);
      }
    } catch {
      setNotificationToast('Failed to accept request. Please try again.');
      setTimeout(() => setNotificationToast(null), 3500);
    } finally {
      setLoadingHandle(null);
    }
  };

  const handleRejectIncoming = async (friendshipId: string, memberName: string) => {
    setLoadingHandle(friendshipId);
    try {
      const res = await apiFetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId, action: 'REJECT' }),
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ['friends'] });
        await queryClient.invalidateQueries({ queryKey: ['rankings'] });
        await queryClient.invalidateQueries({ queryKey: ['notifications'] });
        setNotificationToast(`Request from ${memberName} declined.`);
        setTimeout(() => setNotificationToast(null), 3000);
      }
    } catch {
      setNotificationToast('Failed to decline request.');
      setTimeout(() => setNotificationToast(null), 3000);
    } finally {
      setLoadingHandle(null);
    }
  };

  // Strictly exclude authenticated user from search results
  const displayedMembers = members.filter((m) => {
    if (currentUserId && m.id === currentUserId) return false;
    if (m.handle.toLowerCase() === currentUserHandle.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#0D1527] border border-slate-200 dark:border-[#FACC15]/40 rounded-3xl p-5 sm:p-6 shadow-2xl dark:shadow-[0_0_40px_rgba(250,204,21,0.18)] flex flex-col gap-4 text-left relative max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 dark:bg-amber-400/15 border border-amber-500/20 dark:border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-[#FACC15]">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">Find & Connect Friends</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Search community rivals or scan in person</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Searchbar with Integrated Far-Right LinkedIn QR Icon */}
        <div className="relative shrink-0">
          <div className="flex items-center bg-slate-50 dark:bg-[#070C18] border border-slate-200 dark:border-white/10 rounded-2xl px-3.5 py-2.5 focus-within:border-amber-500 dark:focus-within:border-amber-400/70 transition-all shadow-inner">
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-amber-500 dark:text-[#FACC15] animate-spin shrink-0 mr-2.5" />
            ) : (
              <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by @name or handle..."
              autoFocus
              className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />

            {/* LinkedIn-style QR icon at far right of searchbar - Mobile only (< sm) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                onOpenQr();
              }}
              title="Open LinkedIn-Style QR Scanner & Card (Mobile)"
              className="ml-2 p-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-amber-500/10 dark:hover:bg-amber-400/20 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-[#FACC15] transition-all cursor-pointer shrink-0 flex sm:hidden items-center border border-slate-200 dark:border-white/10"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notificationToast && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <span className="flex-1">{notificationToast}</span>
          </div>
        )}

        {/* User Listing with Individual Connect Buttons */}
        <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1 min-h-[260px] max-h-[380px]">
          <div className="px-1 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>
              {searchQuery ? `Matching Members (${displayedMembers.length})` : 'Active Community Rivals'}
            </span>
            <span className="text-[10px] text-amber-700 dark:text-amber-300/80 font-semibold lowercase">
              connect sends challenge
            </span>
          </div>

          {displayedMembers.length === 0 && !isSearching ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <Search className="w-6 h-6 text-slate-400 dark:text-slate-600" />
              <span>
                {searchQuery
                  ? `No registered members found starting with "${searchQuery}"`
                  : 'No other community members found yet.'}
              </span>
            </div>
          ) : (
            displayedMembers.map((member) => {
              const memberIdStr = String(member.id);
              const memberHandleLower = member.handle.toLowerCase();

              const isAcceptedFriend =
                acceptedFriendUserIds.has(memberIdStr) ||
                acceptedFriendUserIds.has(memberHandleLower);

              const isPendingOutgoing =
                pendingOutgoingUserIds.has(memberIdStr) ||
                pendingOutgoingUserIds.has(memberHandleLower) ||
                Boolean(connectedHandles[member.handle]);

              const incomingFriendshipId =
                pendingIncomingMap.get(memberIdStr) ||
                pendingIncomingMap.get(memberHandleLower);

              const isLoading =
                loadingHandle === member.handle ||
                (incomingFriendshipId ? loadingHandle === incomingFriendshipId : false);

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-[#090F1E] border border-slate-200/80 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/15 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 font-black text-xs flex items-center justify-center shrink-0">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{member.initials}</span>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
                        {member.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="text-amber-600 dark:text-amber-300">{member.handle}</span>
                        <span>•</span>
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                          <Flame className="w-3 h-3 text-amber-500 dark:fill-amber-400 fill-amber-500 dark:text-amber-400" />
                          {member.streakDays}d
                        </span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{member.consistency}%</span>
                      </div>
                    </div>
                  </div>

                  {/* LinkedIn Dynamic Connection Status */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isAcceptedFriend ? (
                      <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center gap-1.5 select-none">
                        <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Connected</span>
                      </div>
                    ) : incomingFriendshipId ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleAcceptIncoming(incomingFriendshipId, member.name)}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 dark:bg-[#FACC15] dark:hover:bg-amber-300 text-slate-950 flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                          title="Accept invitation"
                        >
                          {isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Accept</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleRejectIncoming(incomingFriendshipId, member.name)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
                          title="Decline invitation"
                        >
                          <X className="w-3.5 h-3.5 stroke-[2]" />
                        </button>
                      </div>
                    ) : isPendingOutgoing ? (
                      <div className="flex items-center gap-1">
                        <div className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 dark:border-amber-400/30 flex items-center gap-1.5 select-none">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending</span>
                        </div>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleCancelRequest(member)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all cursor-pointer disabled:opacity-50"
                          title="Cancel friend request"
                        >
                          {isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5 stroke-[2]" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleConnect(member)}
                        disabled={isLoading}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 dark:bg-[#FACC15] dark:hover:bg-amber-300 text-slate-950 shadow-[0_0_12px_rgba(250,204,21,0.25)] active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Connect</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
