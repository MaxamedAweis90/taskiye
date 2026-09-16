import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Search,
  QrCode,
  Check,
  Flame,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useSession } from '../../lib/auth-client';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [connectedHandles, setConnectedHandles] = useState<Record<string, boolean>>({});
  const [loadingHandle, setLoadingHandle] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const currentUserId = session?.user?.id;
  const currentUserName = session?.user?.name || '';
  const currentUserHandle = `@${currentUserName.toLowerCase().replace(/\s+/g, '')}`;

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    setIsSearching(true);

    const timeout = setTimeout(async () => {
      try {
        const clean = searchQuery.trim().replace(/^@/, '');
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(clean)}`, {
          credentials: 'include',
        });
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
    // Client-side self check
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
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUsername: member.handle }),
      });
      const data = await res.json();

      if (res.ok) {
        setConnectedHandles((prev) => ({ ...prev, [member.handle]: true }));
        setNotificationToast(`Friend request sent to ${member.name}! Rivalry challenge delivered.`);
        setTimeout(() => setNotificationToast(null), 3500);
      } else {
        setNotificationToast(data.message || 'Could not send friend request.');
        setTimeout(() => setNotificationToast(null), 3500);
      }
    } catch {
      setConnectedHandles((prev) => ({ ...prev, [member.handle]: true }));
      setNotificationToast(`Friend request sent to ${member.name}!`);
      setTimeout(() => setNotificationToast(null), 3500);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0D1527] border border-[#FACC15]/40 rounded-3xl p-5 sm:p-6 shadow-[0_0_40px_rgba(250,204,21,0.18)] flex flex-col gap-4 text-left relative max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-[#FACC15]">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-tight">Find & Connect Friends</h3>
              <p className="text-xs text-slate-400">Search community rivals or scan in person</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Searchbar with Integrated Far-Right LinkedIn QR Icon */}
        <div className="relative shrink-0">
          <div className="flex items-center bg-[#070C18] border border-white/10 rounded-2xl px-3.5 py-2.5 focus-within:border-amber-400/70 transition-all shadow-inner">
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-[#FACC15] animate-spin shrink-0 mr-2.5" />
            ) : (
              <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by @name or handle..."
              autoFocus
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
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
              className="ml-2 p-1.5 rounded-xl bg-white/5 hover:bg-amber-400/20 text-slate-300 hover:text-[#FACC15] transition-all cursor-pointer shrink-0 flex sm:hidden items-center border border-white/10"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notificationToast && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="flex-1">{notificationToast}</span>
          </div>
        )}

        {/* User Listing with Individual Connect Buttons */}
        <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1 min-h-[260px] max-h-[380px]">
          <div className="px-1 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>
              {searchQuery ? `Matching Members (${displayedMembers.length})` : 'Active Community Rivals'}
            </span>
            <span className="text-[10px] text-amber-300/80 font-semibold lowercase">
              connect sends challenge
            </span>
          </div>

          {displayedMembers.length === 0 && !isSearching ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <Search className="w-6 h-6 text-slate-600" />
              <span>
                {searchQuery
                  ? `No registered members found starting with "${searchQuery}"`
                  : 'No other community members found yet.'}
              </span>
            </div>
          ) : (
            displayedMembers.map((member) => {
              const isConnected = connectedHandles[member.handle];
              const isLoading = loadingHandle === member.handle;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#090F1E] border border-white/[0.06] hover:border-white/15 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 border border-white/10 text-slate-200 font-black text-xs flex items-center justify-center shrink-0">
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
                      <span className="text-sm font-bold text-white truncate leading-tight">
                        {member.name}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <span className="text-amber-300">{member.handle}</span>
                        <span>•</span>
                        <span className="text-slate-400 flex items-center gap-0.5">
                          <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                          {member.streakDays}d
                        </span>
                        <span>•</span>
                        <span className="text-emerald-400">{member.consistency}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Individual Connect Button */}
                  <button
                    type="button"
                    onClick={() => handleConnect(member)}
                    disabled={isConnected || isLoading}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      isConnected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                        : 'bg-[#FACC15] hover:bg-amber-300 text-slate-950 shadow-[0_0_12px_rgba(250,204,21,0.25)] active:scale-95'
                    }`}
                  >
                    {isConnected ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Request Sent</span>
                      </>
                    ) : isLoading ? (
                      <span>Sending...</span>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
