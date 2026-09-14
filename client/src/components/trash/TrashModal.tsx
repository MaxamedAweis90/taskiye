import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Flame,
  CheckSquare,
  Repeat,
  Folder,
  FolderOpen,
  HardDrive,
  Search,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../lib/auth-client';
import { useTaskiyeStore } from '../../store/useTaskiyeStore';

interface TrashedTask {
  _id: string;
  title: string;
  category?: string;
  date?: string;
  deletedAt: string;
  isHabitInstance?: boolean;
  habitId?: { title?: string; category?: string } | null;
}

interface TrashedHabit {
  _id: string;
  title: string;
  category?: string;
  frequency?: string;
  streakDays?: number;
  deletedAt: string;
}

export const TrashModal: React.FC = () => {
  const { isTrashOpen, setIsTrashOpen, showToast, markTaskRestored, markHabitRestored } = useTaskiyeStore();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'tasks' | 'habits'>('tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState<{
    id: string;
    type: 'task' | 'habit';
    title: string;
  } | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  // Reset states on open/close & Close on ESC key
  useEffect(() => {
    if (!isTrashOpen) {
      setItemToPermanentDelete(null);
      setShowEmptyConfirm(false);
      setSearchQuery('');
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (itemToPermanentDelete) {
          setItemToPermanentDelete(null);
        } else if (showEmptyConfirm) {
          setShowEmptyConfirm(false);
        } else {
          setIsTrashOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTrashOpen, itemToPermanentDelete, showEmptyConfirm, setIsTrashOpen]);

  // Query Trashed Tasks
  const { data: trashedTasks = [], isLoading: isLoadingTasks } = useQuery<TrashedTask[]>({
    queryKey: ['tasks', 'trash'],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      const res = await fetch('/api/tasks/trash', { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
    enabled: isTrashOpen && isAuthenticated,
  });

  // Query Trashed Habits
  const { data: trashedHabits = [], isLoading: isLoadingHabits } = useQuery<TrashedHabit[]>({
    queryKey: ['habits', 'trash'],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      const res = await fetch('/api/habits/trash', { credentials: 'include' });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
    enabled: isTrashOpen && isAuthenticated,
  });

  // Restore Task Mutation
  const restoreTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: async (_, id) => {
      markTaskRestored(id);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'trash'] });
      const task = trashedTasks.find((t) => t._id === id);
      showToast('Task Restored', `"${task?.title || 'Task'}" has been restored to your checklist.`, 'success');
    },
  });

  // Permanently Delete Task Mutation
  const permanentDeleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}?permanent=true`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'trash'] });
      showToast('Permanently Deleted', 'Task has been permanently removed.', 'info');
    },
  });

  // Restore Habit Mutation
  const restoreHabitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/habits/${id}/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: async (_, id) => {
      markHabitRestored(id);
      await queryClient.invalidateQueries({ queryKey: ['habits'] });
      await queryClient.refetchQueries({ queryKey: ['habits'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['habits', 'trash'] });
      const habit = trashedHabits.find((h) => h._id === id);
      showToast('Habit Restored', `"${habit?.title || 'Habit'}" and its daily schedule are restored.`, 'success');
    },
  });

  // Permanently Delete Habit Mutation
  const permanentDeleteHabitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/habits/${id}?permanent=true`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits', 'trash'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showToast('Permanently Deleted', 'Habit and linked task instances permanently removed.', 'info');
    },
  });

  // Empty Entire Folder (Tasks or Habits)
  const emptyTrashMutation = useMutation({
    mutationFn: async () => {
      if (activeTab === 'tasks') {
        const res = await fetch('/api/tasks/trash/empty', {
          method: 'DELETE',
          credentials: 'include',
        });
        return res.json();
      } else {
        const res = await fetch('/api/habits/trash/empty', {
          method: 'DELETE',
          credentials: 'include',
        });
        return res.json();
      }
    },
    onSuccess: () => {
      if (activeTab === 'tasks') {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'trash'] });
        showToast('Trash Emptied', 'All trashed tasks have been permanently purged.', 'info');
      } else {
        queryClient.invalidateQueries({ queryKey: ['habits', 'trash'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        showToast('Trash Emptied', 'All trashed habits have been permanently purged.', 'info');
      }
      setShowEmptyConfirm(false);
    },
  });

  const calculateDaysRemaining = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    if (isNaN(deletedDate.getTime())) return 30;
    const msPassed = Date.now() - deletedDate.getTime();
    const daysPassed = Math.floor(msPassed / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysPassed);
  };

  const handleConfirmPermanentDelete = () => {
    if (!itemToPermanentDelete) return;
    if (itemToPermanentDelete.type === 'task') {
      permanentDeleteTaskMutation.mutate(itemToPermanentDelete.id);
    } else {
      permanentDeleteHabitMutation.mutate(itemToPermanentDelete.id);
    }
    setItemToPermanentDelete(null);
  };

  // Filter items by search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return trashedTasks;
    const q = searchQuery.toLowerCase();
    return trashedTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q))
    );
  }, [trashedTasks, searchQuery]);

  const filteredHabits = useMemo(() => {
    if (!searchQuery.trim()) return trashedHabits;
    const q = searchQuery.toLowerCase();
    return trashedHabits.filter(
      (h) =>
        h.title.toLowerCase().includes(q) ||
        (h.category && h.category.toLowerCase().includes(q))
    );
  }, [trashedHabits, searchQuery]);

  if (!isTrashOpen) return null;

  const currentFolderCount = activeTab === 'tasks' ? trashedTasks.length : trashedHabits.length;

  return (
    <div className="fixed inset-0 z-[10000] bg-[#0B132B] text-slate-100 flex flex-col justify-between select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Bar with Profile Settings style top-left X button */}
      <div className="w-full flex items-center justify-between px-4 sm:px-10 py-3.5 sm:py-4 border-b border-white/[0.08] bg-[#080E1E]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-4">
          <button
            type="button"
            onClick={() => setIsTrashOpen(false)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            title="Close Trash"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(250,204,21,0.15)]">
              <Trash2 className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5 sm:gap-2">
                <span className="hidden xs:inline">Taskiye Drive</span>
                <span className="hidden xs:inline text-slate-600">/</span>
                <span className="text-slate-200 font-bold">Trash & Recovery</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Right: 30-Day TTL Badge & Empty Action */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>30-Day Auto-Prune</span>
          </div>

          {currentFolderCount > 0 && (
            <button
              type="button"
              onClick={() => setShowEmptyConfirm(true)}
              disabled={emptyTrashMutation.isPending}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty {activeTab === 'tasks' ? 'Tasks' : 'Habits'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Layout: Google Drive Style (Left Folder Navigation + Right File View) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Google Drive Folders (Desktop only) */}
        <aside className="hidden md:flex w-64 sm:w-72 shrink-0 border-r border-white/[0.08] bg-[#070E1C]/90 flex-col justify-between p-4 sm:p-5">
          <div className="flex flex-col gap-5">
            {/* Section Header */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-2">
                Trash Folders
              </span>
            </div>

            {/* Folder 1: Tasks */}
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('tasks');
                  setSearchQuery('');
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                  activeTab === 'tasks'
                    ? 'bg-gradient-to-r from-amber-400/20 via-amber-400/10 to-transparent border border-amber-400/30 text-amber-200 shadow-[0_0_20px_rgba(250,204,21,0.12)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      activeTab === 'tasks'
                        ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
                        : 'bg-white/[0.06] text-amber-400 group-hover:bg-amber-400/20'
                    }`}
                  >
                    {activeTab === 'tasks' ? (
                      <FolderOpen className="w-4 h-4" />
                    ) : (
                      <Folder className="w-4 h-4" />
                    )}
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold tracking-tight">Tasks</span>
                    <span className="block text-[10px] font-medium text-slate-400">
                      Daily actions
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                    activeTab === 'tasks'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/[0.08] text-slate-300'
                  }`}
                >
                  {trashedTasks.length}
                </span>
              </button>

              {/* Folder 2: Habits */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('habits');
                  setSearchQuery('');
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer group ${
                  activeTab === 'habits'
                    ? 'bg-gradient-to-r from-amber-400/20 via-amber-400/10 to-transparent border border-amber-400/30 text-amber-200 shadow-[0_0_20px_rgba(250,204,21,0.12)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      activeTab === 'habits'
                        ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
                        : 'bg-white/[0.06] text-amber-400 group-hover:bg-amber-400/20'
                    }`}
                  >
                    {activeTab === 'habits' ? (
                      <FolderOpen className="w-4 h-4" />
                    ) : (
                      <Folder className="w-4 h-4" />
                    )}
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold tracking-tight">Habits</span>
                    <span className="block text-[10px] font-medium text-slate-400">
                      Routines & streaks
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold ${
                    activeTab === 'habits'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/[0.08] text-slate-300'
                  }`}
                >
                  {trashedHabits.length}
                </span>
              </button>
            </div>
          </div>

          {/* Drive Storage Policy Box (Google Drive style storage card at bottom) */}
          <div className="p-4 rounded-2xl bg-[#0F1829] border border-white/[0.08] shadow-inner flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-amber-400">
              <HardDrive className="w-4 h-4" />
              <span className="text-xs font-bold text-white tracking-tight">TTL Storage Engine</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
              Deleted items sit here for <strong>30 days</strong>. MongoDB Time-To-Live indexes automatically hard-purge expired records 24/7.
            </p>
            <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-400 font-semibold mt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Self-pruning protected</span>
            </div>
          </div>
        </aside>

        {/* Right Main Content Area: Google Drive File Browser */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0B132B]">
          {/* Mobile Folder Selector Tabs (< md) */}
          <div className="flex md:hidden items-center gap-2 px-4 py-3 bg-[#0A1124]/70 border-b border-white/[0.06]">
            <div className="grid grid-cols-2 gap-2 w-full p-1 bg-[#070E1C] rounded-xl border border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('tasks');
                  setSearchQuery('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'tasks'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Tasks</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === 'tasks' ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {trashedTasks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('habits');
                  setSearchQuery('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'habits'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Habits</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === 'habits' ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {trashedHabits.length}
                </span>
              </button>
            </div>
          </div>

          {/* Top Folder Header & Search Filter */}
          <div className="px-4 sm:px-8 py-3.5 sm:py-4 border-b border-white/[0.06] bg-[#0A1124]/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 shrink-0">
                {activeTab === 'tasks' ? <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5" /> : <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>
              <div>
                <h2 className="text-sm sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{activeTab === 'tasks' ? 'Tasks Folder' : 'Habits Folder'}</span>
                  <span className="text-xs font-medium text-slate-400">
                    ({activeTab === 'tasks' ? filteredTasks.length : filteredHabits.length} items)
                  </span>
                </h2>
                <p className="text-[10.5px] sm:text-[11px] text-slate-400 hidden xs:block">
                  Select items to restore them back to active workflows or delete permanently
                </p>
              </div>
            </div>

            {/* Quick Filter Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={`Search in ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#10192D] border border-white/[0.08] hover:border-white/[0.15] focus:border-amber-400/60 rounded-xl py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/30 transition-all"
              />
            </div>
          </div>

          {/* Files List / Grid Header */}
          <div className="px-4 sm:px-8 py-2.5 border-b border-white/[0.06] bg-[#080E1C]/40 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider grid grid-cols-12 gap-2 sm:gap-4 shrink-0">
            <div className="col-span-7 sm:col-span-5">Name</div>
            <div className="col-span-3 sm:col-span-3 hidden sm:block">Category / Routine</div>
            <div className="col-span-2 hidden xs:block sm:col-span-2">Retention</div>
            <div className="col-span-5 xs:col-span-3 sm:col-span-2 text-right">Actions</div>
          </div>

          {/* Files List Container */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-3 space-y-2">
            {!isAuthenticated ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                <HardDrive className="w-10 h-10 opacity-30 text-amber-400 mb-1" />
                <p className="text-sm font-semibold text-white">Sign In Required</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Cloud-backed 30-day trash and recovery drive is active for registered accounts.
                </p>
              </div>
            ) : (activeTab === 'tasks' && isLoadingTasks) || (activeTab === 'habits' && isLoadingHabits) ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-slate-400 animate-pulse">
                <Clock className="w-7 h-7 text-amber-400 animate-spin" />
                <p className="text-xs">Loading {activeTab} folder contents...</p>
              </div>
            ) : activeTab === 'tasks' ? (
              filteredTasks.length === 0 ? (
                <div className="py-24 text-center flex flex-col items-center justify-center gap-3 text-slate-500">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-400">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400/60" />
                  </div>
                  <h4 className="text-base font-bold text-slate-200">
                    {searchQuery ? 'No matching tasks found' : 'Tasks Trash is Empty'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    {searchQuery
                      ? 'Try adjusting your search query.'
                      : 'Deleted tasks will sit in this folder for 30 days before being automatically pruned.'}
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const daysLeft = calculateDaysRemaining(task.deletedAt);
                  return (
                    <div
                      key={task._id}
                      className="p-3 sm:px-4 rounded-2xl bg-[#121C2E] border border-white/[0.06] hover:border-white/[0.15] hover:bg-[#152238] transition-all grid grid-cols-12 gap-2 sm:gap-4 items-center group"
                    >
                      {/* Name Column */}
                      <div className="col-span-7 xs:col-span-7 sm:col-span-5 flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/[0.08] flex items-center justify-center text-slate-400 shrink-0 group-hover:text-amber-300 group-hover:bg-amber-400/10 transition-colors">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-amber-200 transition-colors">
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.date && (
                              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(task.date).toLocaleDateString()}</span>
                              </span>
                            )}
                            <span className="xs:hidden text-[10px] text-amber-300/90 font-medium">
                              {daysLeft}d left
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Category Column */}
                      <div className="col-span-3 sm:col-span-3 hidden sm:flex items-center gap-2">
                        {task.category ? (
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-white/[0.06] text-slate-300 border border-white/[0.05]">
                            {task.category}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">General</span>
                        )}
                      </div>

                      {/* Retention Column */}
                      <div className="col-span-2 hidden xs:flex items-center">
                        <span
                          className={`text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${
                            daysLeft <= 5
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{daysLeft}d left</span>
                        </span>
                      </div>

                      {/* Actions Column */}
                      <div className="col-span-5 xs:col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => restoreTaskMutation.mutate(task._id)}
                          disabled={restoreTaskMutation.isPending}
                          className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 select-none active:scale-95 shrink-0"
                          title="Restore task to active checklist"
                        >
                          <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span className="hidden sm:inline">Restore</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setItemToPermanentDelete({
                              id: task._id,
                              type: 'task',
                              title: task.title,
                            })
                          }
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )
            ) : filteredHabits.length === 0 ? (
              <div className="py-24 text-center flex flex-col items-center justify-center gap-3 text-slate-500">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-400">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400/60" />
                </div>
                <h4 className="text-base font-bold text-slate-200">
                  {searchQuery ? 'No matching habits found' : 'Habits Trash is Empty'}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  {searchQuery
                    ? 'Try adjusting your search query.'
                    : 'Deleted habits and preserved streak records will sit here for 30 days before permanent pruning.'}
                </p>
              </div>
            ) : (
              filteredHabits.map((habit) => {
                const daysLeft = calculateDaysRemaining(habit.deletedAt);
                return (
                  <div
                    key={habit._id}
                    className="p-3 sm:px-4 rounded-2xl bg-[#121C2E] border border-white/[0.06] hover:border-white/[0.15] hover:bg-[#152238] transition-all grid grid-cols-12 gap-2 sm:gap-4 items-center group"
                  >
                    {/* Name Column */}
                    <div className="col-span-7 xs:col-span-7 sm:col-span-5 flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-300 shrink-0 group-hover:text-amber-300 group-hover:bg-amber-400/10 transition-colors">
                        <Repeat className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-amber-200 transition-colors">
                          {habit.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {typeof habit.streakDays === 'number' && habit.streakDays > 0 && (
                            <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
                              <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span>{habit.streakDays}d streak</span>
                            </span>
                          )}
                          <span className="xs:hidden text-[10px] text-amber-300/90 font-medium">
                            {daysLeft}d left
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Category Column */}
                    <div className="col-span-3 sm:col-span-3 hidden sm:flex items-center gap-2">
                      {habit.category ? (
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-white/[0.06] text-slate-300 border border-white/[0.05]">
                          {habit.category}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Routine</span>
                      )}
                    </div>

                    {/* Retention Column */}
                    <div className="col-span-2 hidden xs:flex items-center">
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${
                          daysLeft <= 5
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{daysLeft}d left</span>
                      </span>
                    </div>

                    {/* Actions Column */}
                    <div className="col-span-5 xs:col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => restoreHabitMutation.mutate(habit._id)}
                        disabled={restoreHabitMutation.isPending}
                        className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 select-none active:scale-95 shrink-0"
                        title="Restore habit and resume streak tracking"
                      >
                        <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span className="hidden sm:inline">Restore</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setItemToPermanentDelete({
                            id: habit._id,
                            type: 'habit',
                            title: habit.title,
                          })
                        }
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete permanently (cascade)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      {itemToPermanentDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setItemToPermanentDelete(null)}
        >
          <div
            className="bg-[#152033] border border-rose-500/30 rounded-3xl p-6 max-w-sm w-full shadow-[0_24px_70px_rgba(0,0,0,0.9)] flex flex-col gap-3 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.25)]">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white tracking-tight">Permanently Delete?</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-[#0D1424] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 truncate mt-1">
              <span className="text-slate-400 mr-1.5">{itemToPermanentDelete.type === 'task' ? 'Task:' : 'Habit:'}</span>
              <span className="font-semibold text-white">{itemToPermanentDelete.title}</span>
            </div>

            {itemToPermanentDelete.type === 'habit' && (
              <p className="text-[11px] text-amber-300/90 leading-snug">
                All daily habit instance tasks and historical streak records will also be permanently purged.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setItemToPermanentDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all cursor-pointer"
              >
                Yes, Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash Confirmation Dialog */}
      {showEmptyConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setShowEmptyConfirm(false)}
        >
          <div
            className="bg-[#152033] border border-rose-500/30 rounded-3xl p-6 max-w-sm w-full shadow-[0_24px_70px_rgba(0,0,0,0.9)] flex flex-col gap-3 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.25)]">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  Empty {activeTab === 'tasks' ? 'Tasks' : 'Habits'} Trash?
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  This will permanently destroy all {currentFolderCount} items in this folder.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setShowEmptyConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => emptyTrashMutation.mutate()}
                disabled={emptyTrashMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all cursor-pointer disabled:opacity-50"
              >
                {emptyTrashMutation.isPending ? 'Emptying...' : 'Yes, Empty Folder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
