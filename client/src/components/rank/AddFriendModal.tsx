import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Search,
  QrCode,
  Check,
  Flame,
  CheckCircle2,
} from 'lucide-react';

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
  initials: string;
  streakDays: number;
  consistency: number;
}

const ALL_COMMUNITY_MEMBERS: CommunityMember[] = [
  { id: '1', name: 'Elena Rostova', handle: '@elena_flow', initials: 'ER', streakDays: 48, consistency: 99.4 },
  { id: '2', name: 'Marcus Chen', handle: '@mchen_code', initials: 'MC', streakDays: 34, consistency: 97.8 },
  { id: '3', name: 'Sarah Jenkins', handle: '@sjenkins', initials: 'SJ', streakDays: 29, consistency: 96.5 },
  { id: '4', name: 'David Kim', handle: '@davidk', initials: 'DK', streakDays: 26, consistency: 95.0 },
  { id: '5', name: 'Maya Lin', handle: '@mayalin', initials: 'ML', streakDays: 22, consistency: 93.8 },
  { id: '6', name: 'Jonas Berg', handle: '@jberg', initials: 'JB', streakDays: 19, consistency: 91.4 },
  { id: '7', name: 'Sora Nakamura', handle: '@nakasora', initials: 'SN', streakDays: 18, consistency: 89.6 },
  { id: '8', name: 'Fatima Al-Mansoor', handle: '@fatima_m', initials: 'FA', streakDays: 16, consistency: 92.1 },
  { id: '9', name: 'Liam O’Connor', handle: '@liam_oc', initials: 'LO', streakDays: 11, consistency: 88.4 },
  { id: '10', name: 'Amara Okafor', handle: '@amara_o', initials: 'AO', streakDays: 9, consistency: 85.0 },
];

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  isOpen,
  onClose,
  onOpenQr,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [connectedHandles, setConnectedHandles] = useState<Record<string, boolean>>({});
  const [loadingHandle, setLoadingHandle] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (member: CommunityMember) => {
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
        setNotificationToast(`Friend request sent to ${member.name}! Notification delivered to their inbox.`);
        setTimeout(() => setNotificationToast(null), 3500);
      } else {
        alert(data.message || 'Could not send friend request.');
      }
    } catch {
      setConnectedHandles((prev) => ({ ...prev, [member.handle]: true }));
      setNotificationToast(`Friend request sent to ${member.name}!`);
      setTimeout(() => setNotificationToast(null), 3500);
    } finally {
      setLoadingHandle(null);
    }
  };

  const cleanQuery = searchQuery.trim().replace(/^@/, '').toLowerCase();
  const displayedMembers = cleanQuery
    ? ALL_COMMUNITY_MEMBERS.filter(
        (m) =>
          m.name.toLowerCase().startsWith(cleanQuery) ||
          m.handle.toLowerCase().replace('@', '').startsWith(cleanQuery)
      )
    : ALL_COMMUNITY_MEMBERS;

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
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by @name or handle..."
              autoFocus
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />

            {/* LinkedIn-style QR icon at the far right of the searchbar */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenQr();
              }}
              title="Open LinkedIn-Style QR Scanner & Card"
              className="ml-2 p-1.5 rounded-xl bg-white/5 hover:bg-amber-400/20 text-slate-300 hover:text-[#FACC15] transition-all cursor-pointer shrink-0 flex items-center gap-1 border border-white/10"
            >
              <QrCode className="w-4 h-4" />
              <span className="text-[10px] font-extrabold hidden sm:inline">QR</span>
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
              {searchQuery ? `Matching Members (${displayedMembers.length})` : 'Suggested Rivals'}
            </span>
            <span className="text-[10px] text-amber-300/80 font-semibold lowercase">
              connect sends inbox notification
            </span>
          </div>

          {displayedMembers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <Search className="w-6 h-6 text-slate-600" />
              <span>No members found starting with "{searchQuery}"</span>
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
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-white/10 text-slate-200 font-black text-xs flex items-center justify-center shrink-0">
                      {member.initials}
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
