import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  Check,
  Clock,
  Pencil,
  Archive,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  X,
  Sparkles,
  Zap,
  Trash2,
  AlertTriangle,
  GripVertical,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../lib/auth-client';
import { useTaskiyeStore, GuestHabit } from '../store/useTaskiyeStore';

type CadenceType = 'Daily' | 'Specific Days' | 'Times per Week';

interface HabitFormData {
  title: string;
  category: string;
  cadence: CadenceType;
  activeDays: number[];
  frequency?: string;
  timeOfDay?: string;
  targetUnit?: string;
}

const SETUP_CATEGORIES = [
  {
    id: 'Health & Fitness',
    label: 'Health & Fitness',
    dot: 'bg-emerald-400',
    activeClass: 'bg-[#122425] border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.2)]',
  },
  {
    id: 'Deep Work',
    label: 'Deep Work',
    dot: 'bg-amber-400',
    activeClass: 'bg-[#251f14] border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(250,204,21,0.2)]',
  },
  {
    id: 'Mind & Focus',
    label: 'Mind & Focus',
    dot: 'bg-blue-400',
    activeClass: 'bg-[#132238] border-blue-400 text-blue-200 shadow-[0_0_12px_rgba(96,165,250,0.2)]',
  },
  {
    id: 'Daily Routine',
    label: 'Daily Routine',
    dot: 'bg-purple-400',
    activeClass: 'bg-[#221832] border-purple-400 text-purple-200 shadow-[0_0_12px_rgba(192,132,252,0.2)]',
  },
  {
    id: 'Personal Growth',
    label: 'Personal Growth',
    dot: 'bg-rose-400',
    activeClass: 'bg-[#27151c] border-rose-400 text-rose-200 shadow-[0_0_12px_rgba(251,113,133,0.2)]',
  },
] as const;

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const DEFAULT_FORM: HabitFormData = {
  title: '',
  category: 'Health & Fitness',
  cadence: 'Daily',
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  timeOfDay: 'Morning (08:00 AM)',
  targetUnit: 'sessions',
};

interface TypewriterTitleProps {
  text: string;
  isWriting: boolean;
  onFinish?: () => void;
  className?: string;
}

const ActiveTypewriterTitle: React.FC<{
  text: string;
  onFinish?: () => void;
  className?: string;
}> = ({ text, onFinish, className }) => {
  const [displayedText, setDisplayedText] = useState('');
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    let index = 0;
    const intervalMs = Math.max(16, Math.min(32, Math.floor(650 / (text.length || 1))));

    const timer = setInterval(() => {
      index++;
      setDisplayedText(text.slice(0, index));

      if (index >= text.length) {
        clearInterval(timer);
        setTimeout(() => {
          onFinishRef.current?.();
        }, 350);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [text]);

  return (
    <span className={className}>
      {displayedText}
      <span className="inline-block w-1.5 h-4 bg-violet-400 ml-1 translate-y-[2px] animate-pulse rounded-sm" />
    </span>
  );
};

const TypewriterTitle: React.FC<TypewriterTitleProps> = ({
  text,
  isWriting,
  onFinish,
  className,
}) => {
  if (!isWriting) {
    return <span className={className}>{text}</span>;
  }

  return <ActiveTypewriterTitle text={text} onFinish={onFinish} className={className} />;
};

const CATEGORIES = ['All Habits', 'Health', 'Work', 'Mind', 'Routine'] as const;

export const Habits: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  // Zustand Store for Guest Mode
  const {
    habits: guestHabits,
    addGuestHabit,
    updateGuestHabit,
    archiveGuestHabit,
    restoreGuestHabit,
    deleteGuestHabit,
    reorderGuestHabits,
  } = useTaskiyeStore();

  // Local UI State
  const [selectedCategory, setSelectedCategory] = useState<string>('All Habits');
  const [searchQuery, setSearchQuery] = useState('');
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [formData, setFormData] = useState<HabitFormData>(DEFAULT_FORM);

  // Animated states: delete, create, edit, archive, restore
  const [habitToDelete, setHabitToDelete] = useState<GuestHabit | null>(null);
  const [deletingHabitId, setDeletingHabitId] = useState<string | null>(null);
  const [deletedHabitIds, setDeletedHabitIds] = useState<Set<string>>(new Set());
  const [newlyCreatedHabitId, setNewlyCreatedHabitId] = useState<string | null>(null);
  const [archivingHabitId, setArchivingHabitId] = useState<string | null>(null);
  const [recentlyArchivedId, setRecentlyArchivedId] = useState<string | null>(null);
  const [restoringHabitId, setRestoringHabitId] = useState<string | null>(null);
  const [restoredHabitId, setRestoredHabitId] = useState<string | null>(null);
  const [editedHabitId, setEditedHabitId] = useState<string | null>(null);

  // Optimistic tracking sets to eliminate any network re-render flicker
  const [optimisticallyArchivedIds, setOptimisticallyArchivedIds] = useState<Set<string>>(new Set());
  const [optimisticallyRestoredIds, setOptimisticallyRestoredIds] = useState<Set<string>>(new Set());

  // Drag and drop states (Option 2: Drag to archive / Drag out of archive)
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<'active' | 'archived' | null>(null);
  const [dragOverHabitId, setDragOverHabitId] = useState<string | null>(null);
  const [isDragOverArchiveZone, setIsDragOverArchiveZone] = useState(false);
  const [isDragOverActiveZone, setIsDragOverActiveZone] = useState(false);
  const [customHabitOrder, setCustomHabitOrder] = useState<string[]>([]);

  // TanStack Query for Authenticated Habits
  const { data: serverHabits = [] } = useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits?includeArchived=true', { credentials: 'include' });
      const json = await res.json();
      return (json.data || []) as Array<{
        _id: string;
        title: string;
        frequency: string;
        category?: string;
        timeOfDay?: string;
        targetUnit?: string;
        streakDays?: number;
        totalCompletions?: number;
        consistencyRate?: number;
        activeDays?: number[];
        warnings?: number;
        lastCompletedDate?: string;
        isArchived: boolean;
        archivedAt?: string;
        lastStreak?: number;
        createdAt: string;
      }>;
    },
    enabled: isAuthenticated,
  });

  // TanStack Mutation: Create Habit
  const createHabitMutation = useMutation({
    mutationFn: async (newHabit: HabitFormData) => {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHabit),
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // TanStack Mutation: Update Habit
  const updateHabitMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<HabitFormData> }) => {
      const res = await fetch(`/api/habits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // TanStack Mutation: Archive Habit
  const archiveHabitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/habits/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (_, id) => {
      // Rollback optimistic state only on error
      setOptimisticallyArchivedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  // TanStack Mutation: Restore Habit
  const restoreHabitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/habits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false }),
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (_, id) => {
      // Rollback optimistic state only on error
      setOptimisticallyRestoredIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  // TanStack Mutation: Delete Habit (Permanent)
  const deleteHabitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/habits/${id}?permanent=true`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Unified Habits List
  const habitsList = useMemo(() => {
    if (isAuthenticated) {
      return serverHabits.map((h) => ({
        id: h._id,
        title: h.title || 'Untitled Habit',
        category: h.category || 'Routine',
        frequency: h.frequency || 'Daily',
        timeOfDay: h.timeOfDay || 'Morning',
        targetUnit: h.targetUnit || 'sessions',
        streakDays: typeof h.streakDays === 'number' ? h.streakDays : 0,
        totalCompletions: typeof h.totalCompletions === 'number' ? h.totalCompletions : 0,
        consistencyRate: typeof h.consistencyRate === 'number' ? h.consistencyRate : 100,
        activeDays: h.activeDays ?? [0, 1, 2, 3, 4],
        warnings: typeof h.warnings === 'number' ? h.warnings : 0,
        lastCompletedDate: h.lastCompletedDate,
        isArchived: Boolean(h.isArchived),
        archivedAt: h.archivedAt,
        lastStreak: h.lastStreak ?? 0,
        createdAt: h.createdAt,
      }));
    }
    return (guestHabits || []).map((h) => ({
      ...h,
      title: h.title || 'Untitled Habit',
      category: h.category || 'Routine',
      frequency: h.frequency || 'Daily',
      activeDays: h.activeDays ?? [0, 1, 2, 3, 4, 5, 6],
      streakDays: typeof h.streakDays === 'number' ? h.streakDays : 0,
      totalCompletions: typeof h.totalCompletions === 'number' ? h.totalCompletions : 0,
      consistencyRate: typeof h.consistencyRate === 'number' ? h.consistencyRate : 100,
      warnings: typeof h.warnings === 'number' ? h.warnings : 0,
      lastCompletedDate: h.lastCompletedDate,
      isArchived: Boolean(h.isArchived),
    }));
  }, [isAuthenticated, serverHabits, guestHabits]);

  // Active vs Archived Habits (optimistically reconciled to eliminate return-state flash)
  const activeHabits = useMemo(() => {
    const base = habitsList.filter((h) => {
      if (deletedHabitIds.has(h.id)) return false;
      if (optimisticallyArchivedIds.has(h.id)) return false;
      if (optimisticallyRestoredIds.has(h.id)) return true;
      return !h.isArchived;
    });
    if (customHabitOrder.length === 0) return base;
    const orderMap = new Map(customHabitOrder.map((id, index) => [id, index]));
    return [...base].sort((a, b) => {
      const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      return orderA - orderB;
    });
  }, [habitsList, deletedHabitIds, optimisticallyArchivedIds, optimisticallyRestoredIds, customHabitOrder]);

  const archivedHabits = useMemo(
    () =>
      habitsList.filter((h) => {
        if (deletedHabitIds.has(h.id)) return false;
        if (optimisticallyRestoredIds.has(h.id)) return false;
        if (optimisticallyArchivedIds.has(h.id)) return true;
        return Boolean(h.isArchived);
      }),
    [habitsList, deletedHabitIds, optimisticallyArchivedIds, optimisticallyRestoredIds]
  );

  // Category counts for filter pills (safe against undefined category)
  const categoryCounts = useMemo(() => {
    const getCat = (h: { category?: string }) => (h.category || '').toLowerCase();
    const counts: Record<string, number> = {
      'All Habits': activeHabits.length,
      Health: activeHabits.filter((h) => getCat(h).includes('health')).length,
      Work: activeHabits.filter((h) => getCat(h).includes('work')).length,
      Mind: activeHabits.filter((h) => getCat(h).includes('mind')).length,
      Routine: activeHabits.filter((h) => getCat(h).includes('routine')).length,
    };
    return counts;
  }, [activeHabits]);

  // Filtered Active Habits based on search & category
  const filteredActiveHabits = useMemo(() => {
    return activeHabits.filter((h) => {
      const habitCat = (h.category || '').toLowerCase();
      const habitTitle = (h.title || '').toLowerCase();

      // Category filter
      if (selectedCategory !== 'All Habits') {
        const catKey = selectedCategory.toLowerCase();
        if (!habitCat.includes(catKey)) return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = habitTitle.includes(query);
        const matchesCategory = habitCat.includes(query);
        if (!matchesTitle && !matchesCategory) return false;
      }
      return true;
    });
  }, [activeHabits, selectedCategory, searchQuery]);

  // Helper for Category styling & indicator dots
  const getCategoryTheme = (category?: string) => {
    const lower = (category || '').toLowerCase();
    if (lower.includes('health')) {
      return {
        pill: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
        dot: 'bg-emerald-400',
      };
    }
    if (lower.includes('routine')) {
      return {
        pill: 'bg-teal-500/10 border-teal-500/25 text-teal-300',
        dot: 'bg-teal-400',
      };
    }
    if (lower.includes('work') || lower.includes('focus')) {
      return {
        pill: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
        dot: 'bg-amber-400',
      };
    }
    if (lower.includes('mind') || lower.includes('reading')) {
      return {
        pill: 'bg-blue-500/10 border-blue-500/25 text-blue-300',
        dot: 'bg-blue-400',
      };
    }
    return {
      pill: 'bg-slate-700/30 border-slate-600/30 text-slate-300',
      dot: 'bg-slate-400',
    };
  };

  // Modal Handlers
  const openCreateModal = () => {
    setEditingHabitId(null);
    setFormData(DEFAULT_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (habit: GuestHabit) => {
    setEditingHabitId(habit.id);
    const days = habit.activeDays?.length ? habit.activeDays : [0, 1, 2, 3, 4, 5, 6];
    const isDaily = days.length === 7 || (habit.frequency || '').toLowerCase().includes('daily');
    const isWeekdays = days.length === 5 && !days.includes(5) && !days.includes(6);
    setFormData({
      title: habit.title,
      category: habit.category || 'Health & Fitness',
      cadence: isDaily ? 'Daily' : isWeekdays ? 'Specific Days' : 'Times per Week',
      activeDays: days,
      timeOfDay: habit.timeOfDay || 'Morning (08:00 AM)',
      targetUnit: habit.targetUnit || 'sessions',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHabitId(null);
    setFormData(DEFAULT_FORM);
  };

  const handleCadenceChange = (cadence: CadenceType) => {
    if (cadence === 'Daily') {
      setFormData((prev) => ({
        ...prev,
        cadence: 'Daily',
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      }));
    } else if (cadence === 'Specific Days') {
      setFormData((prev) => ({
        ...prev,
        cadence: 'Specific Days',
        activeDays: [0, 1, 2, 3, 4],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        cadence: 'Times per Week',
        activeDays: [0, 2, 4],
      }));
    }
  };

  const toggleDay = (dayIndex: number) => {
    setFormData((prev) => {
      let newDays: number[];
      if (prev.activeDays.includes(dayIndex)) {
        if (prev.activeDays.length <= 1) return prev;
        newDays = prev.activeDays.filter((d) => d !== dayIndex);
      } else {
        newDays = [...prev.activeDays, dayIndex].sort((a, b) => a - b);
      }
      const nextCadence: CadenceType =
        newDays.length === 7 ? 'Daily' : 'Specific Days';
      return {
        ...prev,
        activeDays: newDays,
        cadence: nextCadence,
      };
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = formData.title.trim();
    if (!trimmedTitle) return;

    const freqString =
      formData.activeDays.length === 7
        ? 'Daily'
        : formData.activeDays.length === 5 &&
          !formData.activeDays.includes(5) &&
          !formData.activeDays.includes(6)
        ? 'Weekdays'
        : `${formData.activeDays.length} days/wk`;

    if (editingHabitId) {
      const targetId = editingHabitId;
      setEditedHabitId(targetId);
      setTimeout(() => {
        setEditedHabitId((curr) => (curr === targetId ? null : curr));
      }, 1800);

      setTimeout(() => {
        const el = document.getElementById(`habit-card-${targetId}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const inView =
            rect.top >= 60 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
          if (!inView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }, 80);

      if (isAuthenticated) {
        updateHabitMutation.mutate({
          id: editingHabitId,
          updates: {
            title: trimmedTitle,
            category: formData.category,
            frequency: freqString,
            activeDays: formData.activeDays,
          },
        });
      } else {
        updateGuestHabit(editingHabitId, {
          title: trimmedTitle,
          category: formData.category,
          frequency: freqString,
          activeDays: formData.activeDays,
        });
      }
    } else {
      if (isAuthenticated) {
        createHabitMutation.mutate(
          {
            title: trimmedTitle,
            category: formData.category,
            cadence: formData.cadence,
            frequency: freqString,
            timeOfDay: 'Morning (08:00 AM)',
            targetUnit: 'sessions',
            activeDays: formData.activeDays,
          },
          {
            onSuccess: (res: any) => {
              const newId = res?.data?._id;
              if (newId) {
                setNewlyCreatedHabitId(newId);
                setTimeout(() => {
                  const el = document.getElementById(`habit-card-${newId}`);
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    const inView =
                      rect.top >= 60 &&
                      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
                    if (!inView) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                  }
                }, 80);
              }
            },
          }
        );
      } else {
        const generatedId = `guest_habit_${Date.now()}`;
        addGuestHabit({
          id: generatedId,
          title: trimmedTitle,
          category: formData.category,
          frequency: freqString,
          timeOfDay: 'Morning (08:00 AM)',
          targetUnit: 'sessions',
          streakDays: 0,
          totalCompletions: 0,
          consistencyRate: 100,
          activeDays: formData.activeDays,
        });
        setNewlyCreatedHabitId(generatedId);
        setTimeout(() => {
          const el = document.getElementById(`habit-card-${generatedId}`);
          if (el) {
            const rect = el.getBoundingClientRect();
            const inView =
              rect.top >= 60 &&
              rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
            if (!inView) {
              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        }, 80);
      }
    }

    closeModal();
  };

  const handleConfirmDeleteHabit = () => {
    if (!habitToDelete) return;
    const targetId = habitToDelete.id;
    setHabitToDelete(null);
    setDeletingHabitId(targetId);

    setTimeout(() => {
      // 1. Immediately hide from local state so it NEVER flickers or returns
      setDeletedHabitIds((prev) => new Set(prev).add(targetId));
      setDeletingHabitId((curr) => (curr === targetId ? null : curr));

      // 2. Perform actual deletion in database or guest store
      if (isAuthenticated) {
        deleteHabitMutation.mutate(targetId, {
          onError: () => {
            setDeletedHabitIds((prev) => {
              const next = new Set(prev);
              next.delete(targetId);
              return next;
            });
          },
        });
      } else {
        deleteGuestHabit(targetId);
      }
    }, 400);
  };

  // Option 1 Button Archive Handler
  const handleArchive = (id: string) => {
    if (archivingHabitId || deletingHabitId) return;
    setArchivingHabitId(id);

    // Duration matches card-archive-sink (250ms)
    setTimeout(() => {
      setOptimisticallyArchivedIds((prev) => new Set(prev).add(id));
      setOptimisticallyRestoredIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setArchivingHabitId(null);
      setIsArchivedOpen(true);
      setRecentlyArchivedId(id);

      setTimeout(() => {
        setRecentlyArchivedId((curr) => (curr === id ? null : curr));
      }, 2000);

      if (isAuthenticated) {
        archiveHabitMutation.mutate(id);
      } else {
        archiveGuestHabit(id);
      }
    }, 250);
  };

  // Option 1 Button Restore Handler
  const handleRestore = (id: string) => {
    if (restoringHabitId) return;
    setRestoringHabitId(id);

    // Duration matches row-restore-exit (250ms)
    setTimeout(() => {
      setOptimisticallyRestoredIds((prev) => new Set(prev).add(id));
      setOptimisticallyArchivedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setRestoringHabitId(null);
      setRestoredHabitId(id);

      setTimeout(() => {
        setRestoredHabitId((curr) => (curr === id ? null : curr));
      }, 1800);

      if (isAuthenticated) {
        restoreHabitMutation.mutate(id);
      } else {
        restoreGuestHabit(id);
      }
      // Zero scroll jump: keeps user viewport completely stable
    }, 250);
  };

  // Drag and Drop handlers (Option 2: Drag to Archive & Out of Archive)
  const handleActiveDragStart = (e: React.DragEvent, id: string) => {
    setDraggedHabitId(id);
    setDragSource('active');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-habit-id', id);
    e.dataTransfer.setData('application/x-habit-source', 'active');
    e.dataTransfer.setData('text/plain', id);
  };

  const handleArchivedDragStart = (e: React.DragEvent, id: string) => {
    setDraggedHabitId(id);
    setDragSource('archived');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-habit-id', id);
    e.dataTransfer.setData('application/x-habit-source', 'archived');
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragEnd = () => {
    setDraggedHabitId(null);
    setDragSource(null);
    setDragOverHabitId(null);
    setIsDragOverArchiveZone(false);
    setIsDragOverActiveZone(false);
  };

  const handleActiveCardDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSource === 'active' && dragOverHabitId !== id) {
      setDragOverHabitId(id);
    }
  };

  const handleActiveCardDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const source = dragSource || e.dataTransfer.getData('application/x-habit-source');
    const sourceId =
      draggedHabitId ||
      e.dataTransfer.getData('application/x-habit-id') ||
      e.dataTransfer.getData('text/plain');

    setDraggedHabitId(null);
    setDragSource(null);
    setDragOverHabitId(null);
    setIsDragOverActiveZone(false);

    if (!sourceId) return;

    // Option 2: Dragged from archived to active grid -> INSTANT RESTORE ON DROP!
    if (source === 'archived') {
      setOptimisticallyRestoredIds((prev) => new Set(prev).add(sourceId));
      setOptimisticallyArchivedIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
      setRestoredHabitId(sourceId);
      setTimeout(() => {
        setRestoredHabitId((curr) => (curr === sourceId ? null : curr));
      }, 1800);

      if (isAuthenticated) {
        restoreHabitMutation.mutate(sourceId);
      } else {
        restoreGuestHabit(sourceId);
      }
      return;
    }

    if (sourceId === targetId) return;

    const currentList = [...filteredActiveHabits];
    const sourceIndex = currentList.findIndex((h) => h.id === sourceId);
    const targetIndex = currentList.findIndex((h) => h.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const [movedItem] = currentList.splice(sourceIndex, 1);
    currentList.splice(targetIndex, 0, movedItem);

    const newIdOrder = currentList.map((h) => h.id);
    setCustomHabitOrder(newIdOrder);

    if (!isAuthenticated) {
      const fullList = [...guestHabits];
      const itemMap = new Map(fullList.map((h) => [h.id, h]));
      const reordered: GuestHabit[] = [];

      newIdOrder.forEach((id) => {
        const h = itemMap.get(id);
        if (h) {
          reordered.push(h);
          itemMap.delete(id);
        }
      });
      itemMap.forEach((h) => reordered.push(h));
      reorderGuestHabits(reordered);
    }
  };

  // Active Zone drop handlers (Option 2: Drag out of archive to restore)
  const handleActiveZoneDragOver = (e: React.DragEvent) => {
    if (dragSource === 'archived') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!isDragOverActiveZone) {
        setIsDragOverActiveZone(true);
      }
    }
  };

  const handleActiveZoneDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverActiveZone(false);
    }
  };

  const handleActiveZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverActiveZone(false);
    const source = dragSource || e.dataTransfer.getData('application/x-habit-source');
    const sourceId =
      draggedHabitId ||
      e.dataTransfer.getData('application/x-habit-id') ||
      e.dataTransfer.getData('text/plain');

    setDraggedHabitId(null);
    setDragSource(null);
    setDragOverHabitId(null);

    if (source === 'archived' && sourceId) {
      // INSTANT RESTORE ON DROP (No snapback to old archived row!)
      setOptimisticallyRestoredIds((prev) => new Set(prev).add(sourceId));
      setOptimisticallyArchivedIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
      setRestoredHabitId(sourceId);
      setTimeout(() => {
        setRestoredHabitId((curr) => (curr === sourceId ? null : curr));
      }, 1800);

      if (isAuthenticated) {
        restoreHabitMutation.mutate(sourceId);
      } else {
        restoreGuestHabit(sourceId);
      }
    }
  };

  // Archive Zone drop handlers (Option 2: Drag to Archive)
  const handleArchiveZoneDragOver = (e: React.DragEvent) => {
    if (dragSource === 'active') {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!isDragOverArchiveZone) {
        setIsDragOverArchiveZone(true);
      }
    }
  };

  const handleArchiveZoneDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverArchiveZone(false);
    }
  };

  const handleArchiveZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverArchiveZone(false);
    const source = dragSource || e.dataTransfer.getData('application/x-habit-source');
    const sourceId =
      draggedHabitId ||
      e.dataTransfer.getData('application/x-habit-id') ||
      e.dataTransfer.getData('text/plain');

    setDraggedHabitId(null);
    setDragSource(null);
    setDragOverHabitId(null);

    if (source === 'active' && sourceId) {
      // INSTANT ARCHIVE ON DROP (No snapback to active card!)
      setOptimisticallyArchivedIds((prev) => new Set(prev).add(sourceId));
      setOptimisticallyRestoredIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
      setIsArchivedOpen(true);
      setRecentlyArchivedId(sourceId);
      setTimeout(() => {
        setRecentlyArchivedId((curr) => (curr === sourceId ? null : curr));
      }, 2000);

      if (isAuthenticated) {
        archiveHabitMutation.mutate(sourceId);
      } else {
        archiveGuestHabit(sourceId);
      }
    }
  };

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Habit Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
            Manage recurring daily routines and active commitments
          </p>
        </div>

        {/* Primary CTA Button */}
        <button
          type="button"
          onClick={openCreateModal}
          className="bg-[#FACC15] hover:bg-[#EAB308] text-slate-950 font-extrabold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.25)] hover:shadow-[0_0_25px_rgba(250,204,21,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Create New Habit</span>
        </button>
      </div>

      {/* 2. Controls & Filter Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat] ?? 0;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#FACC15] text-slate-950 shadow-sm'
                    : 'bg-[#152033] hover:bg-[#1C2B44] text-slate-300 border border-white/[0.06]'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isSelected ? 'bg-slate-900/20 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input & Option 2 Restore Drop Notice */}
        <div className="flex items-center gap-3">
          {dragSource === 'archived' && (
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isDragOverActiveZone
                  ? 'bg-emerald-400 text-slate-950 shadow-md scale-105'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 animate-pulse'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              <span>
                {isDragOverActiveZone
                  ? 'Release to Restore Habit!'
                  : 'Drop anywhere on Active Grid to Restore'}
              </span>
            </div>
          )}

          <div className="relative min-w-[240px] sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by routine name..."
              className="w-full bg-[#10192D] border border-white/10 hover:border-white/20 focus:border-amber-400 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/40 transition-all"
            />
          </div>
        </div>
      </div>

      {/* 3. Active Habits Grid (3 Columns) */}
      {filteredActiveHabits.length === 0 ? (
        <div className="bg-[#152033] border border-white/[0.06] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No habits match your view</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Try adjusting your search query or category filter, or create a brand new habit to track.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-2 text-xs font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
          >
            + Create New Habit
          </button>
        </div>
      ) : (
        <div
          onDragOver={handleActiveZoneDragOver}
          onDragLeave={handleActiveZoneDragLeave}
          onDrop={handleActiveZoneDrop}
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start rounded-2xl transition-colors duration-200 ${
            dragSource === 'archived' && isDragOverActiveZone
              ? 'ring-2 ring-emerald-400 bg-emerald-500/[0.04]'
              : dragSource === 'archived'
              ? 'ring-1 ring-dashed ring-emerald-400/60 bg-emerald-500/[0.02]'
              : ''
          }`}
        >
          {filteredActiveHabits.map((habit) => {
            const theme = getCategoryTheme(habit.category);
            const isWeekdays = (habit.frequency || '').toLowerCase().includes('weekday');
            const isDeleting = deletingHabitId === habit.id;
            const isCreating = newlyCreatedHabitId === habit.id;
            const isArchiving = archivingHabitId === habit.id;
            const isEdited = editedHabitId === habit.id;
            const isRestored = restoredHabitId === habit.id;
            const isDragging = draggedHabitId === habit.id;
            const isDragOver = dragOverHabitId === habit.id;

            return (
              <div
                key={habit.id}
                id={`habit-card-${habit.id}`}
                draggable={!isDeleting && !isArchiving}
                onDragStart={(e) => handleActiveDragStart(e, habit.id)}
                onDragOver={(e) => handleActiveCardDragOver(e, habit.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleActiveCardDrop(e, habit.id)}
                className={`relative rounded-2xl p-5 flex flex-col justify-between shadow-md hover:shadow-xl group overflow-hidden bg-[#152033] border transition-[background-color,border-color,box-shadow] duration-200 ${
                  isDeleting
                    ? 'animate-card-break-drop pointer-events-none z-30 border-rose-500/40'
                    : isArchiving
                    ? 'animate-card-archive pointer-events-none z-20 border-white/[0.06]'
                    : isDragging
                    ? 'opacity-40 scale-[0.98] border-dashed border-amber-400/80 cursor-grabbing z-30'
                    : isDragOver
                    ? 'border-amber-400 bg-[#182538] shadow-[0_0_20px_rgba(250,204,21,0.35)] scale-[1.02] z-20'
                    : isRestored
                    ? 'animate-card-restored-arrival border-emerald-400/80 shadow-[0_0_25px_rgba(52,211,153,0.35)] z-20'
                    : isEdited
                    ? 'animate-card-edit-pulse border-amber-400/80 shadow-[0_0_25px_rgba(250,204,21,0.35)] z-20'
                    : isCreating
                    ? 'border-violet-400/80 shadow-[0_0_30px_rgba(167,139,250,0.35)] scale-[1.01] z-20 before:absolute before:inset-0 before:bg-gradient-to-br before:from-violet-500/[0.12] before:to-transparent before:pointer-events-none'
                    : 'border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {/* Creation Generation Badge */}
                {isCreating && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/50 text-[10px] font-bold text-violet-300 shadow-sm animate-pulse z-10">
                    <Sparkles className="w-3 h-3 text-violet-300" />
                    <span>Generating Habit...</span>
                  </div>
                )}

                {/* Edited Pulse Badge */}
                {isEdited && !isCreating && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[10px] font-bold text-amber-300 shadow-sm animate-pulse z-10">
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Updated!</span>
                  </div>
                )}

                {/* Restored Arrival Badge */}
                {isRestored && !isCreating && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-bold text-emerald-300 shadow-sm animate-pulse z-10">
                    <RotateCcw className="w-3 h-3 text-emerald-300" />
                    <span>Restored!</span>
                  </div>
                )}

                {/* Top Badge Row: Category on left (with drag grip handle), Streak on right */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="text-slate-600 group-hover:text-slate-400 hover:!text-amber-400 cursor-grab active:cursor-grabbing transition-colors p-1 -ml-1 rounded hover:bg-white/5 shrink-0"
                      title="Option 2: Drag down to Archived section to archive, or drag to reorder"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${theme.pill} truncate`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} shrink-0`} />
                      <span className="truncate">{habit.category}</span>
                    </span>
                  </div>

                  {/* Streak & Warning Badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {habit.warnings === 1 ? (
                      <span
                        className="bg-[#2b1f09] border border-amber-500/50 text-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-sm"
                        title="Warning 1: 1 Day Missed! Streak is frozen. Complete today to clear warning."
                      >
                        <span>⚠️</span>
                        <span>{habit.streakDays ?? 0}d (At Risk)</span>
                      </span>
                    ) : habit.warnings === 2 ? (
                      <span
                        className="bg-[#2e1219] border border-rose-500/50 text-rose-300 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-sm animate-pulse"
                        title="Warning 2: 2 Days Missed! Final warning before streak resets to 0. Complete today to save streak!"
                      >
                        <span>🚨</span>
                        <span>{habit.streakDays ?? 0}d (Final Notice)</span>
                      </span>
                    ) : (
                      <span className="bg-[#271E0B] border border-amber-500/30 text-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                        <span>🔥</span>
                        <span>{habit.streakDays ?? 0} Days Active</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Warning Alert Banner (if under Warning 1 or Warning 2) */}
                {habit.warnings === 1 && (
                  <div className="mt-2.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>Warning 1: Missed 1 day. Streak is frozen. Complete today to clear warning!</span>
                  </div>
                )}
                {habit.warnings === 2 && (
                  <div className="mt-2.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center gap-1.5 text-[11px] text-rose-300 font-semibold animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span>Warning 2: Missed 2 days. Streak resets to 0 if not completed today!</span>
                  </div>
                )}

                {/* Habit Title */}
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mt-3 truncate">
                  {isCreating ? (
                    <TypewriterTitle
                      text={habit.title}
                      isWriting={true}
                      onFinish={() => {
                        setTimeout(() => {
                          setNewlyCreatedHabitId((curr) => (curr === habit.id ? null : curr));
                        }, 800);
                      }}
                      className="text-white"
                    />
                  ) : (
                    habit.title
                  )}
                </h3>

                {/* Schedule Info */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">
                    {habit.frequency} • {habit.timeOfDay || 'Continuous'}
                  </span>
                </div>

                {/* Inset Metrics Container */}
                <div className="bg-[#0F172A]/70 border border-white/[0.04] rounded-xl p-3.5 mt-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
                      Completions
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-white">
                      {habit.totalCompletions ?? 0} {habit.targetUnit || 'sessions'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
                      Consistency
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-emerald-400">
                      {(typeof habit.consistencyRate === 'number' ? habit.consistencyRate : 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Weekday Consistency Matrix Strip */}
                <div className="mt-4">
                  {/* Day labels (M T W T F S S) */}
                  <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                    {dayLabels.map((day, idx) => (
                      <span key={idx} className="text-[10px] font-bold text-slate-500">
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* 7 Checkmark Day Cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const isScheduled = !(isWeekdays && (dayIndex === 5 || dayIndex === 6));
                      const isCompleted = isScheduled && (habit.activeDays?.includes(dayIndex) ?? false);

                      if (!isScheduled) {
                        return (
                          <div
                            key={dayIndex}
                            className="h-7 bg-[#141C2B] text-slate-600 text-[10px] font-bold rounded-lg flex items-center justify-center select-none"
                            title="Day off"
                          >
                            off
                          </div>
                        );
                      }

                      return (
                        <div
                          key={dayIndex}
                          className={`h-7 rounded-lg flex items-center justify-center transition-all ${
                            isCompleted
                              ? 'bg-[#FACC15] text-slate-950 shadow-sm'
                              : 'bg-[#1C263A] border border-white/[0.04]'
                          }`}
                          title={isCompleted ? 'Completed' : 'Pending / Missed'}
                        >
                          {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card Action Controls Footer */}
                <div className="flex items-center justify-between border-t border-white/[0.06] mt-4 pt-3 text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={() => openEditModal(habit)}
                    className="flex items-center gap-1.5 hover:text-amber-400 transition-colors font-semibold cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <div className="flex items-center gap-3">
                    {/* Option 1: Archive Button */}
                    <button
                      type="button"
                      onClick={() => handleArchive(habit.id)}
                      className="flex items-center gap-1 hover:text-slate-200 transition-colors font-medium cursor-pointer"
                      title="Option 1: Archive habit (Progress will be paused & preserved)"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archive</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHabitToDelete(habit)}
                      className="flex items-center gap-1 text-rose-400/80 hover:text-rose-300 transition-colors font-medium cursor-pointer hover:bg-rose-500/10 px-2 py-1 rounded-lg border border-transparent hover:border-rose-500/20"
                      title="Delete habit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Archived Habits Section (Collapsible Bottom Drawer & Option 2 Drop Zone) */}
      <div
        onDragOver={handleArchiveZoneDragOver}
        onDragLeave={handleArchiveZoneDragLeave}
        onDrop={handleArchiveZoneDrop}
        className={`bg-[#152033] rounded-2xl overflow-hidden mt-2 transition-colors duration-200 ${
          dragSource === 'active' && isDragOverArchiveZone
            ? 'ring-2 ring-amber-400 bg-[#19273f] shadow-[0_0_25px_rgba(250,204,21,0.25)]'
            : dragSource === 'active'
            ? 'ring-1 ring-dashed ring-amber-400/60 bg-[#162238]'
            : 'border border-white/[0.06]'
        }`}
      >
        {/* Accordion Toggle Header */}
        <button
          type="button"
          onClick={() => setIsArchivedOpen(!isArchivedOpen)}
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            {isArchivedOpen ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Archived Habits
            </h3>
            <span className="bg-slate-800 border border-white/10 text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
              {archivedHabits.length}
            </span>

            {/* Option 2 Drag to Archive Indicator inside header */}
            {dragSource === 'active' && (
              <span
                className={`text-xs font-extrabold px-3 py-1 rounded-lg transition-all ml-2 ${
                  isDragOverArchiveZone
                    ? 'bg-amber-400 text-slate-950 shadow-sm scale-105'
                    : 'bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-pulse'
                }`}
              >
                {isDragOverArchiveZone
                  ? 'Release to Archive!'
                  : 'Option 2: Drop here to Archive'}
              </span>
            )}
          </div>

          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Click to {isArchivedOpen ? 'collapse' : 'expand'}
          </span>
        </button>

        {/* Collapsible Content */}
        {isArchivedOpen && (
          <div className="p-4 sm:p-5 pt-0 border-t border-white/[0.04] flex flex-col gap-3">
            {archivedHabits.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No archived habits. Archived routines will be stored here.
              </div>
            ) : (
              archivedHabits.map((habit) => {
                const theme = getCategoryTheme(habit.category);
                const isRestoring = restoringHabitId === habit.id;
                const isJustArchived = recentlyArchivedId === habit.id;

                return (
                  <div
                    key={habit.id}
                    id={`archived-habit-${habit.id}`}
                    draggable={!isRestoring}
                    onDragStart={(e) => handleArchivedDragStart(e, habit.id)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-xl p-3 sm:px-4 flex flex-wrap items-center justify-between gap-3 bg-[#111A2E]/80 border transition-[background-color,border-color,box-shadow] duration-200 ${
                      isRestoring
                        ? 'animate-row-restore-exit pointer-events-none border-white/[0.05]'
                        : isJustArchived
                        ? 'bg-amber-500/10 border-amber-400/40 shadow-[0_0_15px_rgba(250,204,21,0.2)] animate-pulse'
                        : draggedHabitId === habit.id
                        ? 'opacity-40 border-dashed border-emerald-400/80 cursor-grabbing bg-[#111A2E]'
                        : 'border-white/[0.05] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Option 2 Drag Handle to restore */}
                      <div
                        className="text-slate-600 hover:text-emerald-400 cursor-grab active:cursor-grabbing transition-colors p-1 -ml-1 rounded hover:bg-white/5 shrink-0"
                        title="Option 2: Drag up to active grid to restore habit"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/5 flex items-center justify-center text-slate-400 shrink-0">
                        <Archive className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-300 line-through truncate">
                            {habit.title}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${theme.pill}`}
                          >
                            {habit.category}
                          </span>
                          {isJustArchived && (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-400/20 border border-amber-400/40 px-2 py-0.2 rounded-full animate-pulse">
                              Archived!
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>{habit.archivedAt || 'Archived previously'}</span>
                          <span>•</span>
                          <span className="text-amber-400/90 font-medium">
                            🔥 Preserved streak: {habit.lastStreak || habit.streakDays} days (Paused)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Option 1: Restore Button */}
                      <button
                        type="button"
                        onClick={() => handleRestore(habit.id)}
                        disabled={isRestoring}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/5 hover:border-emerald-400/30 text-xs font-semibold text-slate-200 hover:text-emerald-300 transition-all cursor-pointer disabled:opacity-50"
                        title="Option 1: Restore Habit to active library"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore Habit</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setHabitToDelete(habit)}
                        disabled={isRestoring}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-semibold text-rose-300 hover:text-rose-200 transition-all cursor-pointer disabled:opacity-50"
                        title="Delete habit permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 5. Create / Edit Habit Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={closeModal}
        >
          <div
            className="bg-[#141C2B] border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col gap-5 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-1">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(250,204,21,0.15)]">
                  <Zap className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {editingHabitId ? 'Edit Habit' : 'Create New Habit'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Build consistent routines with trackable daily actions.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
              {/* Habit Name Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Habit Name</label>
                  <span className="text-[11px] font-medium text-slate-500">Required</span>
                </div>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Morning 20m Deep Yoga & Mobility"
                  className="w-full bg-[#0D1524] border border-white/10 hover:border-white/20 focus:border-amber-400 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/40 transition-all"
                />
              </div>

              {/* Category (Single line, scrollable to left & right) */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Category</label>
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 pt-0.5 -mx-1 px-1 select-none">
                  {SETUP_CATEGORIES.map((cat) => {
                    const isSelected = formData.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat.id })}
                        className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                          isSelected
                            ? cat.activeClass
                            : 'bg-[#0D1524] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${cat.dot} shrink-0`} />
                        <span className="whitespace-nowrap">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Frequency & Cadence */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Frequency & Cadence
                </label>

                {/* Cadence segmented pill tabs */}
                <div className="grid grid-cols-3 bg-[#0D1524] p-1 rounded-xl border border-white/10 select-none">
                  {(['Daily', 'Specific Days', 'Times per Week'] as const).map((tab) => {
                    const isSelected = formData.cadence === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => handleCadenceChange(tab)}
                        className={`py-2 px-2 sm:px-3 text-xs font-bold rounded-lg transition-all cursor-pointer text-center truncate ${
                          isSelected
                            ? 'bg-[#FACC15] text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                        }`}
                      >
                        {tab}
                      </button>
                    );
                  })}
                </div>

                {/* 7-day pill buttons */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mt-3 select-none">
                  {DAY_LABELS.map((day, idx) => {
                    const isDayActive = formData.activeDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        title={DAY_NAMES[idx]}
                        className={`h-9 sm:h-10 rounded-xl flex items-center justify-center text-xs font-extrabold transition-all cursor-pointer ${
                          isDayActive
                            ? 'bg-[#FACC15] text-slate-950 shadow-[0_0_12px_rgba(250,204,21,0.25)] hover:bg-[#EAB308]'
                            : 'bg-[#0D1524] border border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06] mt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#FACC15] hover:bg-[#EAB308] text-slate-950 font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.25)] hover:shadow-[0_0_25px_rgba(250,204,21,0.4)] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>{editingHabitId ? 'Save Changes' : '+ Create Habit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Delete Habit Confirmation Modal */}
      {habitToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setHabitToDelete(null)}
        >
          <div
            className="bg-[#141C2B] border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-4 relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Delete Habit?
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to delete <span className="text-white font-semibold">"{habitToDelete.title}"</span>? This will permanently remove this routine and its progress records.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06] mt-2">
              <button
                type="button"
                onClick={() => setHabitToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteHabit}
                className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:shadow-[0_0_25px_rgba(244,63,94,0.5)] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Habit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Habits;
