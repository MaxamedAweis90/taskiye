import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../lib/auth-client';
import { useTaskiyeStore, GuestTask, GuestHabit } from '../../store/useTaskiyeStore';
import { AppCategory } from '../../constants/categories';

export interface ChatMindUser {
  name?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  image?: string | null;
}

export interface ChatMindProfileCard {
  name: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  isGuest: boolean;
  initial: string;
  stats?: {
    tasksCount: number;
    completedCount: number;
    pendingCount: number;
    habitsCount: number;
  };
}

export interface TaskDraft {
  title: string;
  targetDate: string; // YYYY-MM-DD
  category: AppCategory;
}

export interface MindTaskItem {
  id: string;
  title: string;
  category?: string;
  date?: string;
  isCompleted: boolean;
  isHabitInstance?: boolean;
}

export interface SuggestedRoute {
  path: string;
  label: string;
  description?: string;
}

export interface ChatMindResponse {
  handled: boolean;
  reply?: string;
  actionTaken?:
    | 'CREATE_TASK'
    | 'CREATE_HABIT'
    | 'LIST_TASKS'
    | 'RESCHEDULE_TASKS'
    | 'SHOW_PROFILE'
    | 'PREVIEW_TASK'
    | 'NAVIGATE_ROUTE'
    | 'SCOPE_REFUSAL';
  createdTaskId?: string;
  createdTaskDate?: string;
  targetPage?: 'dashboard' | 'history';
  taskDraft?: TaskDraft;
  profileCard?: ChatMindProfileCard;
  suggestedRoute?: SuggestedRoute;
}

export type MindStep =
  | 'idle'
  | 'awaiting_task_title'
  | 'awaiting_task_confirmation'
  | 'awaiting_habit_title';

/**
 * Intelligent Category Detection based on task or habit title keywords
 */
export function inferCategory(text: string): AppCategory {
  const lower = text.toLowerCase();

  // Health & Fitness
  if (
    /gym|workout|exercise|run|walk|jog|cardio|stretch|yoga|water|diet|meal|eat|breakfast|lunch|dinner|sleep|meditation|pill|medicine|vitamin|health|fitness|jimicsi|caafimaad|biyo|orod|hurdo|dawo/i.test(
      lower
    )
  ) {
    return 'Health & Fitness';
  }

  // Mind Improving
  if (
    /read|book|study|exam|course|learn|lecture|quiz|homework|math|code|program|skill|focus|deep work|research|write|article|podcast|buug|cashir|waxbarasho|aqri|daraasad|qor/i.test(
      lower
    )
  ) {
    return 'Mind Improving';
  }

  // Work & Career
  if (
    /meeting|call|client|customer|project|presentation|slide|report|email|slack|deploy|ticket|bug|review|sprint|boss|manager|contract|proposal|shaqo|xafiis|mashruuc|kulan|warbixin/i.test(
      lower
    )
  ) {
    return 'Work';
  }

  // Personal Growth
  if (
    /journal|reflect|goal|habit|streak|gratitude|pray|quran|namaz|salat|mosque|charity|family|call mom|call dad|horumar|ducada|salaad|qoys/i.test(
      lower
    )
  ) {
    return 'Personal Growth';
  }

  // Routine Activity (Default Fallback)
  return 'Routine Activity';
}

/**
 * Format a human-readable date label in English or Somali
 */
export function formatDateLabel(
  dateStr: string,
  todayStr: string,
  tomorrowStr: string,
  lang: 'en' | 'so'
): string {
  if (dateStr === todayStr) {
    return lang === 'so' ? 'maanta' : 'today';
  }
  if (dateStr === tomorrowStr) {
    return lang === 'so' ? 'barri' : 'tomorrow';
  }
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString(lang === 'so' ? 'so-SO' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Month lookup dictionary with multilingual and typo tolerance
 */
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, janaayo: 0,
  feb: 1, february: 1, febraayo: 1,
  mar: 2, march: 2, maarso: 2,
  apr: 3, april: 3, abrool: 3,
  may: 4, maajo: 4,
  jun: 5, june: 5, juun: 5,
  jul: 6, july: 6, luuliyo: 6,
  aug: 7, august: 7, ogosto: 7,
  sep: 8, sept: 8, september: 8, siteembar: 8,
  oct: 9, october: 9, octobar: 9, oktoobar: 9, oktoobarh: 9,
  nov: 10, november: 10, noofeembar: 10,
  dec: 11, december: 11, diseembar: 11,
};

/**
 * Intelligent Target Date Extractor supporting:
 * - Day + Month: "10 oct", "10th of octobar", "25th of upcoming november"
 * - Month + Day: "oct 10", "october 10th", "upcoming sept 25"
 * - Relative: "tomorrow", "barri", "today", "maanta", "day after tomorrow", "saadambe"
 * - Weekdays: "on Friday", "next monday", "jimcaha", "isniinta"
 * - ISO: "2026-10-10"
 */
export function parseTargetDate(text: string): { targetDate?: string; cleanedText: string } {
  const lower = text.toLowerCase();
  const now = new Date();
  let resolvedDate: Date | null = null;
  let matchedSnippet: RegExp | null = null;

  // 1. Tomorrow / Barri / Tmrw
  if (/\b(?:for\s+|on\s+)?(?:tomorrow|tmrw)\b/i.test(lower) || /\bbarri\b/i.test(lower)) {
    resolvedDate = new Date(now);
    resolvedDate.setDate(resolvedDate.getDate() + 1);
    matchedSnippet = /\b(?:for\s+|on\s+)?(?:tomorrow|tmrw)\b|\bbarri\b/gi;
  }
  // 2. Day after tomorrow / Saadambe
  else if (/\b(?:day\s+after\s+tomorrow|saadambe)\b/i.test(lower)) {
    resolvedDate = new Date(now);
    resolvedDate.setDate(resolvedDate.getDate() + 2);
    matchedSnippet = /\b(?:day\s+after\s+tomorrow|saadambe)\b/gi;
  }
  // 3. Today / Maanta / Caawa / Tonight
  else if (/\b(?:for\s+|on\s+)?(?:today|tonight)\b/i.test(lower) || /\b(?:maanta|caawa)\b/i.test(lower)) {
    resolvedDate = new Date(now);
    matchedSnippet = /\b(?:for\s+|on\s+)?(?:today|tonight)\b|\b(?:maanta|caawa)\b/gi;
  }
  // 4. ISO Date: YYYY-MM-DD
  else if (/\b(\d{4}-\d{2}-\d{2})\b/.test(text)) {
    const match = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (match) {
      const d = new Date(match[1] + 'T12:00:00');
      if (!isNaN(d.getTime())) {
        resolvedDate = d;
        matchedSnippet = /\b(?:for\s+|on\s+)?\d{4}-\d{2}-\d{2}\b/gi;
      }
    }
  }

  // 5. Day + Month: e.g. "10 oct", "10th of octobar", "10th of upcoming octobar"
  if (!resolvedDate) {
    const dayMonthMatch = lower.match(
      /\b(?:for\s+|on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:upcoming\s+|this\s+|next\s+)?([a-z]+)\b/i
    );
    if (dayMonthMatch) {
      const dayNum = parseInt(dayMonthMatch[1], 10);
      const rawMonth = dayMonthMatch[2].toLowerCase();
      const mIdx = Object.keys(MONTH_MAP).find((key) => rawMonth.startsWith(key) || key.startsWith(rawMonth));
      if (mIdx !== undefined && dayNum >= 1 && dayNum <= 31) {
        const monthNum = MONTH_MAP[mIdx];
        resolvedDate = new Date(now.getFullYear(), monthNum, dayNum, 12, 0, 0);
        if (resolvedDate < now && now.getTime() - resolvedDate.getTime() > 86400000) {
          resolvedDate.setFullYear(resolvedDate.getFullYear() + 1);
        }
        matchedSnippet = new RegExp(dayMonthMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      }
    }
  }

  // 6. Month + Day: e.g. "oct 10", "october 10th", "upcoming sept 25"
  if (!resolvedDate) {
    const monthDayMatch = lower.match(
      /\b(?:for\s+|on\s+)?(?:upcoming\s+|this\s+|next\s+)?([a-z]+)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i
    );
    if (monthDayMatch) {
      const rawMonth = monthDayMatch[1].toLowerCase();
      const dayNum = parseInt(monthDayMatch[2], 10);
      const mIdx = Object.keys(MONTH_MAP).find((key) => rawMonth.startsWith(key) || key.startsWith(rawMonth));
      if (mIdx !== undefined && dayNum >= 1 && dayNum <= 31) {
        const monthNum = MONTH_MAP[mIdx];
        resolvedDate = new Date(now.getFullYear(), monthNum, dayNum, 12, 0, 0);
        if (resolvedDate < now && now.getTime() - resolvedDate.getTime() > 86400000) {
          resolvedDate.setFullYear(resolvedDate.getFullYear() + 1);
        }
        matchedSnippet = new RegExp(monthDayMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      }
    }
  }

  // 7. Weekdays (e.g. "on Friday", "for next Monday", "isniinta", "jimcaha")
  if (!resolvedDate) {
    const daysMap: Record<string, number> = {
      sunday: 0, sun: 0, axad: 0, axadda: 0,
      monday: 1, mon: 1, isniin: 1, isniinta: 1,
      tuesday: 2, tue: 2, talaado: 2, talaadada: 2,
      wednesday: 3, wed: 3, arbaco: 3, arbacada: 3,
      thursday: 4, thu: 4, khamiis: 4, khamiista: 4,
      friday: 5, fri: 5, jimco: 5, jimcaha: 5,
      saturday: 6, sat: 6, sabti: 6, sabtida: 6,
    };

    const weekdayMatch = lower.match(
      /\b(?:for\s+|on\s+|this\s+|next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|isniinta|isniin|talaadada|talaado|arbacada|arbaco|khamiista|khamiis|jimcaha|jimco|sabtida|sabti|axadda|axad)\b/i
    );

    if (weekdayMatch) {
      const targetDay = daysMap[weekdayMatch[1].toLowerCase()];
      if (targetDay !== undefined) {
        resolvedDate = new Date(now);
        const currentDay = now.getDay();
        let diff = targetDay - currentDay;
        if (diff <= 0) diff += 7;
        resolvedDate.setDate(now.getDate() + diff);
        matchedSnippet = new RegExp(
          `\\b(?:for\\s+|on\\s+|this\\s+|next\\s+)?${weekdayMatch[1]}\\b`,
          'gi'
        );
      }
    }
  }

  let cleaned = text;
  if (matchedSnippet) {
    cleaned = cleaned.replace(matchedSnippet, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  // Clean trailing "for", "on", "to", ":" that might have been linking the date
  cleaned = cleaned.replace(/\s+(?:for|on|to|at|named|called|about)\s*$/i, '').trim();

  const dateStr = resolvedDate ? resolvedDate.toLocaleDateString('en-CA') : undefined;
  return { targetDate: dateStr, cleanedText: cleaned };
}

/**
 * Check if the query is asking who the current user is
 */
export function isWhoAmIQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    /^(?:who\s+am\s+i|who\s+i\s+am|who\s+is\s+this|what(?:'s|\s+is)\s+my\s+name|what(?:'s|\s+is)\s+my\s+(?:username|email|profile|account)|show\s+(?:me\s+)?my\s+profile|my\s+profile|my\s+info|my\s+account|about\s+me|tell\s+me\s+about\s+(?:me|myself)|do\s+you\s+know\s+me|do\s+you\s+know\s+who\s+i\s+am)\b/i.test(
      lower
    ) ||
    /who\s+am\s+i/i.test(lower) ||
    /^(?:waa\s+kuma\s+anigu|yaan\s+ahay|yaa\s+weeye\s+aniga|magacaygu\s+waa\s+kuma|magacayga|profile(?:-| )?kayga|xogtayda|koontadayda|ma\s+i\s+garanaysaa)\b/i.test(
      lower
    )
  );
}

/**
 * Check if the query is asking who the AI assistant is
 */
export function isWhoAreYouQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    /^(?:who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|introduce\s+yourself)\b/i.test(lower) ||
    /^(?:waa\s+kuma\s+adigu|yaad\s+tahay|maxaad\s+qaban\s+kartaa|iska\s+key\s+bar)\b/i.test(lower)
  );
}

/**
 * Robust natural language intent extractor for task & habit creation
 */
export interface ExtractedCreateIntent {
  type: 'CREATE_TASK' | 'CREATE_HABIT';
  title?: string;
  targetDate?: string;
}

export function parseCreateIntent(text: string): ExtractedCreateIntent | null {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Habit Detection Patterns
  const isHabitPrompt =
    /(?:create|add|build|start|track|make|new)\s+(?:a\s+|new\s+)?habit\b/i.test(lower) ||
    /^(?:please\s+)?(?:can\s+(?:you|u)\s+)?(?:create|add|build|start)\s+(?:a\s+)?habit\b/i.test(lower) ||
    /^(?:i\s+(?:want|need|would\s+like)\s+to\s+)?(?:create|add|build|start)\s+(?:a\s+)?habit\b/i.test(lower) ||
    /^habit\s*[:\-]/i.test(lower) ||
    /(?:abuur|ku\s+dar|dhis|bilaab|samee)\s+caado\b/i.test(lower) ||
    /(?:waxaan\s+rabaa\s+(?:inaan\s+(?:dhisato|bilaabo|abuuro)\s+)?caado|fadlan\s+ii\s+abuur\s+caado|fadlan\s+iigu\s+dar\s+caado)\b/i.test(lower);

  // Task Detection Patterns
  const isTaskPrompt =
    /(?:create|add|make|schedule|set|remind\s+me\s+to|new)\s+(?:a\s+|new\s+)?task\b/i.test(lower) ||
    /^(?:please\s+)?(?:can\s+(?:you|u)\s+)?(?:create|add|make|schedule)\s+(?:a\s+)?task\b/i.test(lower) ||
    /^(?:i\s+(?:want|need|would\s+like)\s+to\s+)?(?:create|add|make|schedule)\s+(?:a\s+)?task\b/i.test(lower) ||
    /^task\s*[:\-]/i.test(lower) ||
    /^remind\s+me\s+(?:to|tomorrow\s+to)\b/i.test(lower) ||
    /(?:abuur|ku\s+dar|samee)\s+hawl\b/i.test(lower) ||
    /(?:waxaan\s+rabaa\s+(?:inaan\s+abuuro\s+)?hawl|fadlan\s+ii\s+abuur\s+hawl|fadlan\s+iigu\s+dar\s+hawl|i\s+qor\s+hawl|i\s+xasuusi)\b/i.test(lower);

  // Handle Habit intent first if habit keyword is matched
  if (isHabitPrompt && !isTaskPrompt) {
    let title = '';
    const match =
      clean.match(
        /(?:create|add|build|start|track|make|new)\s+(?:a\s+|new\s+)?habit(?:\s+(?:of|to|named|called|for|about|:|ah|ku\s+saabsan|oo\s+ah))?\s*(.*)/i
      ) ||
      clean.match(
        /(?:abuur|ku\s+dar|dhis|bilaab|samee)\s+caado(?:\s+(?:cusub|ah|ku\s+saabsan|oo\s+ah|lagu\s+magacaabo|:))?\s*(.*)/i
      ) ||
      clean.match(/^habit\s*[:\-]\s*(.*)/i);

    if (match && match[1]) {
      title = match[1].trim();
    }
    title = title.replace(/^["'`]|["'`]$/g, '').trim();

    return {
      type: 'CREATE_HABIT',
      title: title.length >= 2 ? title : undefined,
    };
  }

  // Handle Task intent
  if (isTaskPrompt) {
    // 1. Extract date from text first
    const { targetDate, cleanedText } = parseTargetDate(clean);

    let title = '';
    const match =
      cleanedText.match(
        /(?:create|add|make|schedule|set)\s+(?:a\s+|new\s+)?task(?:\s+(?:to|named|called|for|about|:|ah|ku\s+saabsan|oo\s+ah))?\s*(.*)/i
      ) ||
      cleanedText.match(/^remind\s+me\s+(?:to\s+)(.*)/i) ||
      cleanedText.match(/^task\s*[:\-]\s*(.*)/i) ||
      cleanedText.match(
        /(?:abuur|ku\s+dar|samee)\s+hawl(?:\s+(?:cusub|ah|ku\s+saabsan|oo\s+ah|lagu\s+magacaabo|:))?\s*(.*)/i
      ) ||
      cleanedText.match(/(?:i\s+qor\s+hawl\s+(?:ah\s+)?|i\s+xasuusi\s+(?:inaan\s+)?)(.*)/i);

    if (match && match[1]) {
      title = match[1].trim();
    }

    // Clean any residual quotes or punctuation
    title = title.replace(/^["'`]|["'`]$/g, '').trim();

    return {
      type: 'CREATE_TASK',
      title: title.length >= 2 ? title : undefined,
      targetDate,
    };
  }

  return null;
}

/**
 * Scope Guardrail: Checks if the user's message is out of scope
 */
export function isOutOfScopeQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // In-scope keywords
  if (
    /who\s+am\s+i|who\s+i\s+am|who\s+are\s+you|who\s+is\s+this|my\s+name|my\s+profile|my\s+account|about\s+me|waa\s+kuma|yaan\s+ahay|yaad\s+tahay|magacayga|xogtayda|taskiye|habit|task|streak|checklist|ranking|leaderboard|caado|hawl|taxane|baraf|heer|confirm|cancel|change/i.test(
      lower
    )
  ) {
    return false;
  }

  const outOfScopePatterns = [
    /president|madaxweyne/i,
    /prime minister|ra'iisul|wasiir/i,
    /minister|parliament|election|doorasho|government|dowladd/i,
    /who is (?:the )?(?:current )?(?:president|minister|leader|king|mayor)/i,
    /waa kuma (?:madaxweynaha|wasiirka|hogaamiyaha)/i,
    /capital of|caasimadda|caasimada/i,
    /weather in|cimilada/i,
    /who won (?:the )?(?:world cup|champions league|match|game)/i,
    /football|soccer|premier league|real madrid|barcelona|arsenal|manchester/i,
    /movie|actor|actress|celebrity|hollywood|music|singer/i,
    /solve (?:this )?(?:equation|integral|derivative|algebra)/i,
    /recipe for|how to cook/i,
  ];

  return outOfScopePatterns.some((pattern) => pattern.test(lower));
}

/**
 * Returns strict scope refusal message
 */
export function getScopeRefusalMessage(lang: 'en' | 'so'): string {
  if (lang === 'so') {
    return `Waxaan ahay Kaaliyaha Taskiye, waxaan kaa caawin karaa oo kaliya hawlahaaga maalinlaha ah, caadooyinkaaga, taxanahaaga, iyo jadwalkaaga Taskiye. Sideen maanta kaaga caawin karaa abaabulka hawlahaaga?`;
  }
  return `I am Taskiye AI, your dedicated productivity assistant. I can only help you organize your daily tasks, habits, streaks, and schedules on Taskiye. How can I help you organize your tasks or habits today?`;
}

/**
 * Custom hook providing the intelligence, draft preview, and action dispatching for Taskiye AI Chatbot
 */
export function useChatMind({
  language,
  user,
}: {
  language: 'en' | 'so';
  user?: ChatMindUser;
}) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  const {
    tasks: guestTasks,
    habits: guestHabits,
    addGuestTask,
    updateGuestTask,
    deleteGuestTask,
    addGuestHabit,
    showToast,
  } = useTaskiyeStore();

  const [mindStep, setMindStep] = useState<MindStep>('idle');
  const [pendingTargetDate, setPendingTargetDate] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);

  // Format today's date string YYYY-MM-DD
  const getTodayStr = useCallback(() => {
    return new Date().toLocaleDateString('en-CA');
  }, []);

  // Format tomorrow's date string YYYY-MM-DD
  const getTomorrowStr = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA');
  }, []);

  /**
   * 1. Action: Execute Task Creation
   */
  const executeCreateTask = useCallback(
    async (
      title: string,
      targetDate?: string
    ): Promise<{ success: boolean; category: AppCategory; taskId: string; resolvedDate: string }> => {
      const category = inferCategory(title);
      const dateStr = targetDate || getTodayStr();
      const newTaskId = `task_${Date.now()}`;
      let resolvedTaskId = newTaskId;

      if (isAuthenticated) {
        try {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              title: title.trim(),
              category,
              priority: 'normal',
              date: dateStr,
            }),
          });
          const json = await res.json();
          if (json?.data?.id || json?.data?._id) {
            resolvedTaskId = json.data.id || json.data._id;
          }
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        } catch (err) {
          console.error('[ChatMind] Failed to create task via API:', err);
        }
      } else {
        const newTask: GuestTask = {
          id: newTaskId,
          title: title.trim(),
          date: dateStr,
          isCompleted: false,
          isHabitInstance: false,
          sortOrder: 0,
          category,
          priority: 'normal',
          createdAt: new Date().toISOString(),
        };
        addGuestTask(newTask);
      }

      const todayStr = getTodayStr();
      const tomorrowStr = getTomorrowStr();
      const dateLabel = formatDateLabel(dateStr, todayStr, tomorrowStr, language);

      showToast(
        language === 'so' ? 'Hawl La Abuuray 🎯' : 'Task Created 🎯',
        language === 'so'
          ? `"${title}" waxaa lagu daray ${category} ee ${dateLabel}.`
          : `"${title}" added under ${category} for ${dateLabel}.`,
        'success'
      );

      return { success: true, category, taskId: resolvedTaskId, resolvedDate: dateStr };
    },
    [isAuthenticated, getTodayStr, getTomorrowStr, queryClient, addGuestTask, showToast, language]
  );

  /**
   * Helper: Fetch today's tasks (Server tasks for authenticated users, Guest tasks for guest users)
   */
  const fetchTodayTasks = useCallback(async (): Promise<MindTaskItem[]> => {
    const todayStr = getTodayStr();

    if (isAuthenticated) {
      const cached = queryClient.getQueryData<any[]>(['tasks', todayStr]);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return cached.map((t) => ({
          id: String(t._id || t.id),
          title: t.title,
          category: t.category,
          date: t.date || todayStr,
          isCompleted: Boolean(t.isCompleted),
          isHabitInstance: Boolean(t.isHabitInstance),
        }));
      }
      try {
        const res = await fetch(`/api/tasks?date=${todayStr}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const list = json.data || [];
          return list.map((t: any) => ({
            id: String(t._id || t.id),
            title: t.title,
            category: t.category,
            date: t.date || todayStr,
            isCompleted: Boolean(t.isCompleted),
            isHabitInstance: Boolean(t.isHabitInstance),
          }));
        }
      } catch (err) {
        console.error('[ChatMind] Failed fetching today tasks:', err);
      }
      return [];
    }

    // Guest mode: only tasks for today
    return (guestTasks || [])
      .filter((t) => (t.date || '').slice(0, 10) === todayStr)
      .map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        date: t.date,
        isCompleted: Boolean(t.isCompleted),
        isHabitInstance: Boolean(t.isHabitInstance),
      }));
  }, [isAuthenticated, queryClient, guestTasks, getTodayStr]);

  /**
   * Helper: Fetch currently active (uncompleted) tasks
   * Prioritizes today's checklist; if none, fetches upcoming from task history
   */
  const fetchActiveTasks = useCallback(async (): Promise<MindTaskItem[]> => {
    const todayTasks = await fetchTodayTasks();
    const activeToday = todayTasks.filter((t) => !t.isCompleted);

    if (isAuthenticated) {
      if (activeToday.length > 0) {
        return activeToday;
      }
      // If today has no active tasks, check upcoming or active tasks in history
      try {
        const res = await fetch('/api/tasks/history?days=14&hideCompleted=true', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const upcoming = json.data?.upcomingTasks || [];
          const days = json.data?.days || [];
          const histTasks = [
            ...upcoming,
            ...days.flatMap((d: any) => d.tasks || []),
          ];
          const seen = new Set<string>();
          const uncompleted: MindTaskItem[] = [];
          for (const t of histTasks) {
            const id = String(t._id || t.id);
            if (!t.isCompleted && !seen.has(id)) {
              seen.add(id);
              uncompleted.push({
                id,
                title: t.title,
                category: t.category,
                date: t.date,
                isCompleted: false,
                isHabitInstance: Boolean(t.isHabitInstance),
              });
            }
          }
          if (uncompleted.length > 0) return uncompleted;
        }
      } catch (err) {
        console.error('[ChatMind] Failed fetching history tasks:', err);
      }
      return [];
    }

    // Guest Mode: active tasks deduplicated
    const seen = new Set<string>();
    const list: MindTaskItem[] = [];
    for (const t of guestTasks || []) {
      if (!t.isCompleted && !seen.has(t.id)) {
        seen.add(t.id);
        list.push({
          id: t.id,
          title: t.title,
          category: t.category,
          date: t.date,
          isCompleted: false,
          isHabitInstance: Boolean(t.isHabitInstance),
        });
      }
    }
    return list;
  }, [fetchTodayTasks, isAuthenticated, guestTasks]);

  /**
   * Helper: Fetch active habits count
   */
  const fetchHabitsCount = useCallback(async (): Promise<number> => {
    if (isAuthenticated) {
      const cached = queryClient.getQueryData<any[]>(['habits']);
      if (cached && Array.isArray(cached)) {
        return cached.filter((h) => !h.isArchived).length;
      }
      try {
        const res = await fetch('/api/habits', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const list = json.data || [];
          return list.filter((h: any) => !h.isArchived).length;
        }
      } catch (err) {
        console.error('[ChatMind] Failed fetching habits count:', err);
      }
      return 0;
    }
    return guestHabits ? guestHabits.filter((h) => !h.isArchived).length : 0;
  }, [isAuthenticated, queryClient, guestHabits]);

  /**
   * Action: Execute Task Deletion / Removal
   */
  const executeDeleteTask = useCallback(
    async (taskId: string, taskTitle: string): Promise<boolean> => {
      if (isAuthenticated) {
        try {
          await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          queryClient.setQueriesData({ queryKey: ['tasks'] }, (old: any) => {
            if (Array.isArray(old)) {
              return old.filter((item: any) => String(item._id || item.id) !== String(taskId));
            }
            return old;
          });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['tasks', 'trash'] });
          queryClient.invalidateQueries({ queryKey: ['tasks', 'history'] });
        } catch (err) {
          console.error('[ChatMind] Failed to delete task via API:', err);
        }
      } else {
        deleteGuestTask(taskId);
      }

      showToast(
        language === 'so' ? 'Hawsha Waa La Tirtiray 🗑️' : 'Task Removed 🗑️',
        language === 'so'
          ? `"${taskTitle}" waxaa loo wareejiyay qashinka.`
          : `"${taskTitle}" has been moved to trash.`,
        'info'
      );

      return true;
    },
    [isAuthenticated, queryClient, deleteGuestTask, showToast, language]
  );

  /**
   * 2. Action: Execute Habit Creation
   */
  const executeCreateHabit = useCallback(
    async (title: string): Promise<{ success: boolean; category: AppCategory }> => {
      const category = inferCategory(title);
      const newHabitId = `habit_${Date.now()}`;

      if (isAuthenticated) {
        try {
          await fetch('/api/habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              title: title.trim(),
              category,
              frequency: 'daily',
              timeOfDay: 'Anytime',
              activeDays: [0, 1, 2, 3, 4, 5, 6],
            }),
          });
          queryClient.invalidateQueries({ queryKey: ['habits'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        } catch (err) {
          console.error('[ChatMind] Failed to create habit via API:', err);
        }
      } else {
        const newHabit: GuestHabit = {
          id: newHabitId,
          title: title.trim(),
          category,
          frequency: 'daily',
          timeOfDay: 'Anytime',
          streakDays: 0,
          totalCompletions: 0,
          consistencyRate: 100,
          activeDays: [0, 1, 2, 3, 4, 5, 6],
          isArchived: false,
          createdAt: new Date().toISOString(),
        };
        addGuestHabit(newHabit);
      }

      showToast(
        language === 'so' ? 'Caado La Abuuray ✨' : 'Habit Created ✨',
        language === 'so'
          ? `"${title}" waxaa lagu daray caadooyinkaaga.`
          : `"${title}" added to your daily habits.`,
        'success'
      );

      return { success: true, category };
    },
    [isAuthenticated, queryClient, addGuestHabit, showToast, language]
  );

  /**
   * 3. Action: Query Today's Tasks
   */
  const executeListTodayTasks = useCallback(async (): Promise<string> => {
    const todayStr = getTodayStr();
    const todayTasks = await fetchTodayTasks();

    if (todayTasks.length === 0) {
      return language === 'so'
        ? `Maanta wax hawlo ah laguu ma qorsheynin weli.\n\nMa jeclaan lahayd inaad mid cusub abuurto? Kaliya i dheh **"abuur hawl"**!`
        : `You do not have any tasks scheduled for today yet.\n\nWould you like to add one? Just say **"create a task"**!`;
    }

    const completed = todayTasks.filter((t) => t.isCompleted).length;
    const total = todayTasks.length;

    let response =
      language === 'so'
        ? `**Hawlahaaga Maanta (${todayStr}):**\nWaxaad dhameysay ${completed} ka mid ah ${total} hawlood.\n\n`
        : `**Your Tasks for Today (${todayStr}):**\nProgress: ${completed} of ${total} completed.\n\n`;

    todayTasks.forEach((task) => {
      const check = task.isCompleted ? '✓' : ' ';
      const statusText = task.isCompleted
        ? language === 'so'
          ? 'Dhameystiran'
          : 'Completed'
        : language === 'so'
        ? 'Hadhay'
        : 'Pending';
      response += `- [${check}] **${task.title}** (${task.category || 'General'}) — *${statusText}*\n`;
    });

    if (completed < total) {
      response +=
        language === 'so'
          ? `\nHaddii aad rabto inaad hawlaha hadhay u wareejiso barri, kaliya i dheh: **"hawlaha u wareeji barri"**!`
          : `\nIf you want to move remaining tasks to tomorrow, just tell me: **"reschedule remaining tasks to tomorrow"**!`;
    }

    return response;
  }, [fetchTodayTasks, getTodayStr, language]);

  /**
   * 4. Action: Reschedule Remaining Tasks for Today to Tomorrow
   */
  const executeRescheduleTasksToTomorrow = useCallback(async (): Promise<string> => {
    const tomorrowStr = getTomorrowStr();

    const todayTasks = await fetchTodayTasks();
    const pendingTasks = todayTasks.filter((t) => !t.isCompleted && !t.isHabitInstance);

    if (pendingTasks.length === 0) {
      return language === 'so'
        ? `Ma jiraan hawlo qabyo ah oo maanta hadhay oo u baahan in dib loo dhigo! Dhammaan waa la dhameeyay ama ma jiraan.`
        : `There are no uncompleted tasks remaining for today to reschedule! You're either all caught up or have none scheduled.`;
    }

    if (isAuthenticated) {
      try {
        for (const task of pendingTasks) {
          await fetch(`/api/tasks/${task.id}/reschedule`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ targetDate: 'tomorrow' }),
          });
        }
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } catch (err) {
        console.error('[ChatMind] Failed rescheduling tasks via API:', err);
      }
    } else {
      pendingTasks.forEach((task) => {
        updateGuestTask(task.id, { date: tomorrowStr });
      });
    }

    showToast(
      language === 'so' ? 'Hawlaha Dib Loo Dhigay 📅' : 'Tasks Rescheduled 📅',
      language === 'so'
        ? `${pendingTasks.length} hawlood ayaa loo wareejiyay Barri (${tomorrowStr}).`
        : `${pendingTasks.length} pending task(s) moved to Tomorrow (${tomorrowStr}).`,
      'success'
    );

    return language === 'so'
      ? `Guul! 📅 Waxaan u wareejiyay **${pendingTasks.length}** hawlood oo hadhay maalinta **Barri (${tomorrowStr})**.\n\nWaxaad ka arki kartaa boggaaga Dashboard-ka ama Taariikhda Hawlaha!`
      : `Success! 📅 I have rescheduled **${pendingTasks.length}** remaining task(s) to **Tomorrow (${tomorrowStr})**.\n\nYou can view them on your Dashboard and Tasks history!`;
  }, [
    getTodayStr,
    getTomorrowStr,
    fetchTodayTasks,
    isAuthenticated,
    queryClient,
    updateGuestTask,
    showToast,
    language,
  ]);

  /**
   * Helper: Generate Draft Preview Message
   */
  const buildDraftPreviewReply = useCallback(
    (draft: TaskDraft, introText?: string): string => {
      const todayStr = getTodayStr();
      const tomorrowStr = getTomorrowStr();
      const dateLabel = formatDateLabel(draft.targetDate, todayStr, tomorrowStr, language);
      const destination =
        draft.targetDate === todayStr
          ? language === 'so'
            ? "Today's Checklist (Bogga Hore)"
            : "Today's Checklist"
          : language === 'so'
          ? 'Task History (Taariikhda Hawlaha)'
          : 'Task History';

      if (language === 'so') {
        const intro = introText ? `${introText}\n\n` : '';
        return `${intro}**Qabyo-qoraalka Hawsha (Task Preview):**\n\n- 📋 **Hawsha:** **${draft.title}**\n- 📅 **Taariikhda:** **${dateLabel}** (${destination})\n- 🏷️ **Qaybta:** **${draft.category}**\n\nMa xaqiijinaysaa abuurista hawshan, mise waxaad rabtaa inaad wax ka beddesho (tusaale: *"taariikhda u wareeji barri"* ama *"ciwaanka u beddel..."*)?`;
      }

      const intro = introText ? `${introText}\n\n` : '';
      return `${intro}**Task Draft Preview:**\n\n- 📋 **Task:** **${draft.title}**\n- 📅 **Date:** **${dateLabel}** (${destination})\n- 🏷️ **Category:** **${draft.category}**\n\nWould you like to confirm and create this task, or change anything (e.g., *"change date to tomorrow"*, *"change title to..."*)?`;
    },
    [getTodayStr, getTomorrowStr, language]
  );

  /**
   * Main Dispatcher: Processes incoming user text
   */
  const processMessage = useCallback(
    async (userInput: string): Promise<ChatMindResponse> => {
      const text = userInput.trim();
      const lower = text.toLowerCase();
      const todayStr = getTodayStr();
      const tomorrowStr = getTomorrowStr();

      // Step A: Handle Cancellation at any stage
      const isCancel = /^(?:cancel|stop|never\s*mind|exit|no|don't\s+create|jooji|ha\s+abuurin|iska\s+daay)\b/i.test(lower);
      if ((mindStep !== 'idle' || taskDraft) && isCancel) {
        setMindStep('idle');
        setPendingTargetDate(null);
        setTaskDraft(null);
        return {
          handled: true,
          reply:
            language === 'so'
              ? `Abuuristii hawsha waa la joojiyay. Sideen kale oo aan kuu caawin karaa?`
              : `Task creation cancelled. How else can I help you today?`,
        };
      }

      // Step B: Handling Task Draft Confirmation / Modification
      if (mindStep === 'awaiting_task_confirmation' && taskDraft) {
        // B1. User confirms creation: "yes", "confirm", "create", "ok", "haa", "samee", "abuur"
        const isConfirm = /^(?:yes|confirm|create|ok|sure|proceed|yep|yeah|create\s+it|confirm\s+and\s+create|haa|samee|abuur|haye|abuur\s+hawsha)\b/i.test(lower);
        if (isConfirm) {
          const activeDraft = taskDraft;
          setMindStep('idle');
          setTaskDraft(null);
          setPendingTargetDate(null);

          const { category, taskId, resolvedDate } = await executeCreateTask(
            activeDraft.title,
            activeDraft.targetDate
          );
          const dateLabel = formatDateLabel(resolvedDate, todayStr, tomorrowStr, language);
          const isToday = resolvedDate === todayStr;
          const targetPage: 'dashboard' | 'history' = isToday ? 'dashboard' : 'history';

          const reply =
            language === 'so'
              ? isToday
                ? `Guul! 🎯 Hawshaada **"${activeDraft.title}"** waxaa lagu daray qaybta **${category}** ee maanta.\n\nWaxaad ka arki kartaa Checklist-kaaga maanta!`
                : `Guul! 🎯 Hawshaada **"${activeDraft.title}"** waxaa loo qorsheeyay qaybta **${category}** maalinta **${dateLabel}**.\n\nWaxaad ka arki kartaa bogga **Taariikhda Hawlaha (Task History)**!`
              : isToday
              ? `Success! 🎯 Your task **"${activeDraft.title}"** has been created under **${category}** for today.\n\nYou can view it on your Today's Checklist!`
              : `Success! 🎯 Your task **"${activeDraft.title}"** has been scheduled under **${category}** for **${dateLabel}**.\n\nYou can view it in your **Task History**!`;

          return {
            handled: true,
            reply,
            actionTaken: 'CREATE_TASK',
            createdTaskId: taskId,
            createdTaskDate: resolvedDate,
            targetPage,
          };
        }

        // B2. User modifies date: "change date to tomorrow", "move to 15 oct", "make it for Friday"
        const changeDateMatch = lower.match(/(?:change|move|reschedule|set|make)\s+(?:the\s+)?(?:date|it)\s+(?:to|for)\s+(.+)/i) ||
          lower.match(/(?:beddel|u\s+wareeji)\s+(?:taariikhda)\s*(?:u|ku\s+dar)?\s*(.+)/i);

        if (changeDateMatch) {
          const rawDateStr = changeDateMatch[1].trim();
          const { targetDate: newDate } = parseTargetDate(rawDateStr);
          if (newDate) {
            const updatedDraft: TaskDraft = {
              ...taskDraft,
              targetDate: newDate,
            };
            setTaskDraft(updatedDraft);
            const newLabel = formatDateLabel(newDate, todayStr, tomorrowStr, language);
            const intro =
              language === 'so'
                ? `Taariikhda waxaan u beddelay **${newLabel}**! 👍`
                : `Date updated to **${newLabel}**! 👍`;
            return {
              handled: true,
              reply: buildDraftPreviewReply(updatedDraft, intro),
              actionTaken: 'PREVIEW_TASK',
              taskDraft: updatedDraft,
            };
          }
        }

        // B3. User modifies title: "change title to...", "rename to..."
        const changeTitleMatch = lower.match(/(?:change|update|rename|set)\s+(?:the\s+)?(?:title|name|task)\s+(?:to|as)\s+(.+)/i) ||
          lower.match(/(?:beddel)\s+(?:magaca|ciwaanka|hawsha)\s*(?:u|ah)?\s*(.+)/i);

        if (changeTitleMatch) {
          const newTitle = changeTitleMatch[1].trim().replace(/^["'`]|["'`]$/g, '');
          if (newTitle.length >= 2) {
            const updatedDraft: TaskDraft = {
              ...taskDraft,
              title: newTitle,
              category: inferCategory(newTitle),
            };
            setTaskDraft(updatedDraft);
            const intro =
              language === 'so'
                ? `Ciwaanka waxaan u beddelay **"${newTitle}"**! 👍`
                : `Title updated to **"${newTitle}"**! 👍`;
            return {
              handled: true,
              reply: buildDraftPreviewReply(updatedDraft, intro),
              actionTaken: 'PREVIEW_TASK',
              taskDraft: updatedDraft,
            };
          }
        }

        // B4. User modifies category: "change category to Work"
        const changeCategoryMatch = lower.match(/(?:change|update|set)\s+(?:the\s+)?category\s+(?:to|as)\s+(.+)/i) ||
          lower.match(/(?:beddel)\s+(?:qaybta)\s*(?:u)?\s*(.+)/i);

        if (changeCategoryMatch) {
          const rawCat = changeCategoryMatch[1].trim();
          const newCategory = inferCategory(rawCat);
          const updatedDraft: TaskDraft = {
            ...taskDraft,
            category: newCategory,
          };
          setTaskDraft(updatedDraft);
          const intro =
            language === 'so'
              ? `Qaybta waxaan u beddelay **${newCategory}**! 👍`
              : `Category updated to **${newCategory}**! 👍`;
          return {
            handled: true,
            reply: buildDraftPreviewReply(updatedDraft, intro),
            actionTaken: 'PREVIEW_TASK',
            taskDraft: updatedDraft,
          };
        }

        // If user said something else while awaiting confirmation, remind them
        const reminder =
          language === 'so'
            ? `Fadlan dooro inaad **xaqiijiso** hawshan (guji *Confirm & Create Task* ama dheh *"haa"*), ama sheeg waxaad rabto inaad beddesho (tusaale *"taariikhda u beddel barri"*).`
            : `Please **confirm** to create this task (click *Confirm & Create Task* or say *"yes"*), or tell me what to change (e.g. *"change date to tomorrow"*).`;
        return {
          handled: true,
          reply: `${reminder}\n\n${buildDraftPreviewReply(taskDraft)}`,
          actionTaken: 'PREVIEW_TASK',
          taskDraft,
        };
      }

      // Step C: Handling Multi-Turn Awaiting Task Title
      if (mindStep === 'awaiting_task_title') {
        const { targetDate: turnDate, cleanedText } = parseTargetDate(text);
        const resolvedDate = turnDate || pendingTargetDate || todayStr;
        const taskTitle = cleanedText.trim() || text.trim();

        if (taskTitle.length >= 2) {
          const category = inferCategory(taskTitle);
          const draft: TaskDraft = {
            title: taskTitle,
            targetDate: resolvedDate,
            category,
          };

          setMindStep('awaiting_task_confirmation');
          setTaskDraft(draft);
          setPendingTargetDate(null);

          return {
            handled: true,
            reply: buildDraftPreviewReply(draft),
            actionTaken: 'PREVIEW_TASK',
            taskDraft: draft,
          };
        }
      }

      // Step D: Handling Habit Title
      if (mindStep === 'awaiting_habit_title') {
        setMindStep('idle');
        const { category } = await executeCreateHabit(text);
        const reply =
          language === 'so'
            ? `Guul! ✨ Caadadaada **"${text}"** waxaa si guul leh loogu daray qaybta **${category}**.\n\nWaxaad ka bilaabi kartaa maanta si aad u dhisto taxane joogto ah (streak)!`
            : `Success! ✨ Your habit **"${text}"** has been created under **${category}**.\n\nYou can start tracking it today to build your streak!`;
        return {
          handled: true,
          reply,
          actionTaken: 'CREATE_HABIT',
        };
      }

      // Step E: Identity Recognition - "Who am I?"
      if (isWhoAmIQuery(text)) {
        const displayName =
          user?.name ||
          user?.username ||
          session?.user?.name ||
          (language === 'so' ? 'Marti (Guest)' : 'Guest');
        const userInitial = displayName.charAt(0).toUpperCase();
        const avatarUrl = user?.avatarUrl || user?.image || (session?.user as { image?: string | null })?.image;
        const email = user?.email || session?.user?.email;
        const isGuest = !isAuthenticated && !session?.user && !user?.email;

        const todayTasks = await fetchTodayTasks();
        const completedCount = todayTasks.filter((t) => t.isCompleted).length;
        const pendingCount = todayTasks.length - completedCount;
        const habitsCount = await fetchHabitsCount();

        const profileCardData: ChatMindProfileCard = {
          name: displayName,
          username: user?.username,
          email: email || undefined,
          avatarUrl: avatarUrl || undefined,
          isGuest,
          initial: userInitial,
          stats: {
            tasksCount: todayTasks.length,
            completedCount,
            pendingCount,
            habitsCount,
          },
        };

        let reply = '';
        if (language === 'so') {
          reply = isGuest
            ? `**Xogtaada Taskiye (Habka Martida):**\n\nWaxaad hadda ku dhex jirtaa **Habka Martida (Guest Mode)**.\n- **Magaca:** Marti (Guest)\n- **Kaydka Xogta:** Waxaa lagu kaydiyay browser-kaaga (ilaa 30 shay)\n- **Hawlaha Maanta:** ${completedCount} ka mid ah ${todayTasks.length} waa la dhameeyay\n- **Caadooyinka:** ${habitsCount} firfircoon\n\n*Talo: Waxaad abuuran kartaa akoon bilaash ah markasta si aad xogtaada ugu kaydiso daruuraha (cloud sync)!*`
            : `**Xogtaada Taskiye (Profile-kaaga):**\n\nWaa kan dulmar ku saabsan akoonkaaga iyo wax-soo-saarkaaga maanta:\n\n- **Magaca:** **${displayName}**\n- **Email / Username:** \`${email || (user?.username ? `@${user.username}` : 'Xubin')}\`\n- **Xaaladda Akoonka:** Xubin Buuxda (Daruuriga ku xiran ⚡)\n- **Hawlaha Maanta:** ${completedCount} ka mid ah ${todayTasks.length} waa la dhameeyay (${pendingCount} hadhay)\n- **Caadooyinka:** ${habitsCount} firfircoon\n\nMaxaan maanta kaaga caawin karaa hawlahaaga ama caadooyinkaaga?`;
        } else {
          reply = isGuest
            ? `**Your Taskiye Profile (Guest Mode):**\n\nYou are currently exploring Taskiye in **Guest Mode**.\n- **Display Name:** Guest\n- **Storage:** Local Browser Storage (up to 30 items)\n- **Today's Tasks:** ${completedCount} of ${todayTasks.length} completed\n- **Active Habits:** ${habitsCount} tracking\n\n*Tip: Sign up anytime for free to unlock cloud sync across all your devices!*`
            : `**Your Taskiye Profile:**\n\nHere is your profile and productivity summary:\n\n- **Name:** **${displayName}**\n- **Email / Username:** \`${email || (user?.username ? `@${user.username}` : 'Member')}\`\n- **Account Status:** Member (Cloud Synced ⚡)\n- **Today's Tasks:** ${completedCount} of ${todayTasks.length} completed (${pendingCount} pending)\n- **Active Habits:** ${habitsCount} tracking\n\nHow can I help you with your daily tasks or habits today?`;
        }

        return {
          handled: true,
          reply,
          actionTaken: 'SHOW_PROFILE',
          profileCard: profileCardData,
        };
      }

      // Step F: AI Identity Recognition - "Who are you?"
      if (isWhoAreYouQuery(text)) {
        const reply =
          language === 'so'
            ? `**Kaaliyaha Taskiye AI** ⚡\n\nWaxaan ahay kaaliyahaaga garaadka macmalka ah ee Taskiye. Waxaan kuu halkan u joogaa inaan kaa caawiyo:\n\n1. **Abaabulka & Abuurista Hawlaha Maalinlaha ah**\n2. **Dhisidda Caadooyinka & Ilaalinta Streaks**\n3. **Kala Hormarinta & Dib-u-ballanqaadka Hawlaha**\n4. **Horumarinta Heerarka & Darajooyinka**\n\nI weydii wax kasta oo ku saabsan hawlahaaga ama caadooyinkaaga!`
            : `**Taskiye AI Assistant** ⚡\n\nI am your dedicated personal AI productivity companion for Taskiye. I can help you with:\n\n1. **Creating & Scheduling Daily Tasks**\n2. **Building Habit Streaks & Habit Freezing**\n3. **Organizing & Rescheduling Your Checklist**\n4. **Tracking Progress & Leaderboard Ranks**\n\nHow can I help you get organized today?`;

        return {
          handled: true,
          reply,
        };
      }

      // Step G: Strict Scope Verification
      if (isOutOfScopeQuery(text)) {
        return {
          handled: true,
          reply: getScopeRefusalMessage(language),
          actionTaken: 'SCOPE_REFUSAL',
        };
      }

      // Step G2: Action Detection - Task Removal / Deletion
      const isDeleteTaskAction =
        /^(?:please\s+|can\s+you\s+|fadlan\s+)?(?:remove|delete|trash|drop|clear|tirtir|masax)(?:\s+|$)/i.test(lower) ||
        /\b(?:remove|delete|trash|tirtir|masax)\s+(?:a\s+)?(?:task|hawl)\b/i.test(lower);

      const isHabitExplicit = /(?:habit|caado)/i.test(lower) && !/(?:task|hawl)/i.test(lower);

      if (isDeleteTaskAction && !isHabitExplicit) {
        // Extract title if user wrote e.g. "remove task gym" or "delete Test2"
        let titleMatch = lower
          .replace(
            /^(?:please\s+|can\s+you\s+|fadlan\s+)?(?:remove|delete|trash|drop|clear|tirtir|masax)\s*(?:a\s*)?(?:the\s*)?(?:task|hawl|hawsha)?(?:\s+named|\s+called|\s+ee\s+ah)?\s*/i,
            ''
          )
          .trim();
        titleMatch = titleMatch.replace(/[.!?]+$/, '').trim();

        const activeTasks = await fetchActiveTasks();

        // Case A: Task title was specified
        if (titleMatch.length >= 2) {
          let found =
            activeTasks.find((t) => t.title.toLowerCase().trim() === titleMatch.toLowerCase()) ||
            activeTasks.find((t) => t.title.toLowerCase().includes(titleMatch.toLowerCase())) ||
            activeTasks.find((t) => titleMatch.toLowerCase().includes(t.title.toLowerCase()));

          // If not found in activeTasks, check history
          if (!found && isAuthenticated) {
            try {
              const histRes = await fetch(`/api/tasks/history?search=${encodeURIComponent(titleMatch)}&hideCompleted=true`, { credentials: 'include' });
              if (histRes.ok) {
                const histJson = await histRes.json();
                const allHist = [
                  ...(histJson.data?.upcomingTasks || []),
                  ...(histJson.data?.days || []).flatMap((d: any) => d.tasks || []),
                ];
                const match = allHist.find((t: any) => t.title.toLowerCase().includes(titleMatch.toLowerCase()));
                if (match) {
                  found = {
                    id: String(match._id || match.id),
                    title: match.title,
                    category: match.category,
                    date: match.date,
                    isCompleted: Boolean(match.isCompleted),
                  };
                }
              }
            } catch (err) {
              console.error('[ChatMind] Failed searching task in history:', err);
            }
          }

          if (found) {
            await executeDeleteTask(found.id, found.title);
            const reply =
              language === 'so'
                ? `Guul! 🗑️ Hawsha **"${found.title}"** waa la tirtiray waxaana loo wareejiyay qashinka (Trash).`
                : `Success! 🗑️ The task **"${found.title}"** has been removed and moved to the 30-day trash.`;
            return {
              handled: true,
              reply,
              actionTaken: 'CREATE_TASK',
            };
          }
        }

        // Case B: No specific title or title not matched; list current real active tasks
        if (activeTasks.length > 0) {
          let listReply =
            language === 'so'
              ? `**Waa kuwan hawlahaaga hadda jira ee furan. Hawsheed rabtaa inaad tirtirto?** 🗑️\n\n`
              : `**Here are your current active tasks. Which one would you like to remove?** 🗑️\n\n`;

          activeTasks.slice(0, 6).forEach((t, idx) => {
            const dateStr = t.date ? ` — *${t.date.slice(0, 10)}*` : '';
            listReply += `${idx + 1}. **${t.title}** (${t.category || 'General'})${dateStr}\n`;
          });

          listReply +=
            language === 'so'
              ? `\nKaliya i dheh: *"tirtir ${activeTasks[0].title}"* ama ku dhufo astaanta qashinka (🗑️) ee ku taal Dashboard-ka ama Task History.`
              : `\nJust reply with: *"delete ${activeTasks[0].title}"* or click the trash icon (🗑️) on any task on the Dashboard or in Task History.`;

          return {
            handled: true,
            reply: listReply,
          };
        } else {
          const emptyReply =
            language === 'so'
              ? `Xilligan ma lihid wax hawlo ah oo furan oo la tirtiri karo. 👍\n\nMarkaad hawl cusub abuurto, waxaad mar kasta ku tirtiri kartaa astaanta qashinka (🗑️) ee ku taal Dashboard-ka ama adoo ii sheegaya *"tirtir [magaca hawsha]"*.`
              : `You currently do not have any active tasks to remove. 👍\n\nWhenever you have tasks, you can remove any task by clicking its trash icon (🗑️) on the Dashboard or Task History, or simply tell me *"delete [task name]"*.`;

          return {
            handled: true,
            reply: emptyReply,
          };
        }
      }

      // Step H: Action Detection - Task & Habit Creation
      const createIntent = parseCreateIntent(text);
      if (createIntent) {
        if (createIntent.type === 'CREATE_TASK') {
          // If title was provided in the same message: build draft and present preview
          if (createIntent.title) {
            const targetDate = createIntent.targetDate || todayStr;
            const category = inferCategory(createIntent.title);
            const draft: TaskDraft = {
              title: createIntent.title,
              targetDate,
              category,
            };

            setMindStep('awaiting_task_confirmation');
            setTaskDraft(draft);

            return {
              handled: true,
              reply: buildDraftPreviewReply(draft),
              actionTaken: 'PREVIEW_TASK',
              taskDraft: draft,
            };
          }

          // Title not provided; prompt user and save pending target date
          setMindStep('awaiting_task_title');
          setPendingTargetDate(createIntent.targetDate || null);

          let promptQuestion: string;
          if (createIntent.targetDate) {
            const dateLabel = formatDateLabel(createIntent.targetDate, todayStr, tomorrowStr, language);
            promptQuestion =
              language === 'so'
                ? `Waa maxay hawsha aad rabto inaad u qorsheyso **${dateLabel}**? (Fadlan qor magaca hawsha):`
                : `What task would you like to schedule for **${dateLabel}**? (Please enter the task name or what you want to achieve):`;
          } else {
            promptQuestion =
              language === 'so'
                ? `Waa maxay hawsha aad rabto inaad abuurto? (Fadlan qor magaca hawsha):`
                : `What is your task? (Please enter the task name or what you want to achieve):`;
          }

          return {
            handled: true,
            reply: promptQuestion,
            actionTaken: 'CREATE_TASK',
          };
        }

        if (createIntent.type === 'CREATE_HABIT') {
          if (createIntent.title) {
            const { category } = await executeCreateHabit(createIntent.title);
            const reply =
              language === 'so'
                ? `Guul! ✨ Caadadaada **"${createIntent.title}"** waxaa lagu daray qaybta **${category}**.`
                : `Success! ✨ Your habit **"${createIntent.title}"** has been created under **${category}**.\n\nYou can start tracking it today!`;
            return {
              handled: true,
              reply,
              actionTaken: 'CREATE_HABIT',
            };
          }

          setMindStep('awaiting_habit_title');
          const promptQuestion =
            language === 'so'
              ? `Waa maxay caadada aad rabto inaad dhisato? (tusaale, "Jimicsi 20 daqiiqo" ama "Cabitaanka 2L biyo"):`
              : `What habit would you like to build? (e.g., "Morning 20-min workout" or "Drink 2L water daily"):`;
          return {
            handled: true,
            reply: promptQuestion,
            actionTaken: 'CREATE_HABIT',
          };
        }
      }

      // Step I: Query Today's Tasks
      if (
        /what.*tasks?.*(?:do\s+)?(?:i|we)?.*have.*today|today'?s?.*tasks|tasks?.*for.*today|show.*my.*tasks|list.*my.*tasks|maxaa.*hawlo.*maanta|hawlahayga.*maanta/i.test(
          lower
        )
      ) {
        const reply = await executeListTodayTasks();
        return {
          handled: true,
          reply,
          actionTaken: 'LIST_TASKS',
        };
      }

      // Step J: Reschedule Remaining Tasks to Tomorrow
      if (
        /reschedule.*(?:remaining|tasks?).*to.*tomorrow|move.*(?:remaining|tasks?).*to.*tomorrow|wareeji.*hawl.*barri|dib.*u.*dhig.*barri/i.test(
          lower
        )
      ) {
        const reply = await executeRescheduleTasksToTomorrow();
        return {
          handled: true,
          reply,
          actionTaken: 'RESCHEDULE_TASKS',
        };
      }

      // Step K: Route Navigation & Page Guidance
      // K1: Habits Page (/habits)
      if (
        /(?:go\s+to|open|show|navigate|take\s+me\s+to|where\s+(?:is|are)|how\s+to\s+access|how\s+do\s+i\s+find)\s+(?:the\s+)?(?:habits?|streaks?|caadooyinka|taxanaha)/i.test(lower) ||
        /(?:i\s+gee|fur|u\s+gudub)\s+(?:bogga\s+)?caadooyinka/i.test(lower) ||
        /^(?:habits?|streaks?|caadooyinka)$/i.test(lower)
      ) {
        const reply =
          language === 'so'
            ? `**Bogga Caadooyinka (Habits & Streaks):**\n\nWaxaad ka heli kartaa dhamaan caadooyinkaaga maalinlaha ah, dhisidda taxanaha (streaks), xilliyada maalinta, iyo badbaadada taxanaha (Streak Freeze).\n\nRiix badhanka hoose ama link-ga si aad toos ugu tagto: [Fur Bogga Caadooyinka](/habits)`
            : `**Habits & Streaks Workspace:**\n\nYou can manage all your recurring habits, track consecutive streak days, customize times of day, and utilize Streak Freeze protection on the Habits page.\n\nClick the button below or link to jump there: [Go to Habits](/habits)`;

        return {
          handled: true,
          reply,
          actionTaken: 'NAVIGATE_ROUTE',
          suggestedRoute: {
            path: '/habits',
            label: language === 'so' ? 'Fur Bogga Caadooyinka' : 'Go to Habits',
            description: language === 'so' ? 'Dhis caadooyin cusub oo ilaali taxanahaaga' : 'Create habits and build daily streaks',
          },
        };
      }

      // K2: Task History Page (/tasks)
      if (
        /(?:go\s+to|open|show|navigate|take\s+me\s+to|where\s+(?:is|are)|how\s+to\s+access)\s+(?:the\s+)?(?:task\s+history|history|tasks\s+page|upcoming\s+tasks|all\s+tasks|past\s+tasks|taariikhda|hawlaha\s+hore)/i.test(lower) ||
        /(?:i\s+gee|fur|u\s+gudub)\s+(?:taariikhda|hawlaha)/i.test(lower) ||
        /^(?:task\s+history|history|taariikhda\s+hawlaha)$/i.test(lower)
      ) {
        const reply =
          language === 'so'
            ? `**Taariikhda Hawlaha (Task History):**\n\nBoggan waxaad ka arki kartaa hawlaha soo socda (Upcoming tasks ee barri iyo taariikhaha kale), hawlihii maanta, shalay, iyo dhamaan hawlihii hore ee la diiwaangeliyay.\n\nRiix badhanka hoose ama link-ga: [Fur Taariikhda Hawlaha](/tasks)`
            : `**Task History & Upcoming Tasks:**\n\nHere you can review upcoming tasks scheduled for tomorrow or future dates, today's log, and your complete multi-day task history archives.\n\nClick the button below or link: [Go to Task History](/tasks)`;

        return {
          handled: true,
          reply,
          actionTaken: 'NAVIGATE_ROUTE',
          suggestedRoute: {
            path: '/tasks',
            label: language === 'so' ? 'Fur Taariikhda Hawlaha' : 'Go to Task History',
            description: language === 'so' ? 'Eeg hawlaha soo socda iyo taariikhdii hore' : 'View upcoming and past task archives',
          },
        };
      }

      // K3: Leaderboard & Ranks Page (/rank)
      if (
        /(?:go\s+to|open|show|navigate|take\s+me\s+to|where\s+(?:is|are)|how\s+to\s+access)\s+(?:the\s+)?(?:leaderboard|rankings?|ranks?|tiers?|level|levels?|heerarka|darajooyinka|guulaha)/i.test(lower) ||
        /(?:i\s+gee|fur|u\s+gudub)\s+(?:leaderboard|heerarka|darajooyinka)/i.test(lower) ||
        /^(?:leaderboard|ranks?|rankings?|heerarka)$/i.test(lower)
      ) {
        const reply =
          language === 'so'
            ? `**Heerarka & Leaderboard-ka (Ranks):**\n\nWaxaad ka arki kartaa heerkaaga (Bronze ilaa Master), dhibcahaaga, kaalinta aad kaga jirto tartanka asxaabta, iyo profile kaarkaaga LinkedIn/QR.\n\nRiix badhanka hoose ama link-ga: [Fur Leaderboard-ka](/rank)`
            : `**Leaderboard & Ranks:**\n\nExplore your current rank tier (Bronze to Master), track milestone achievements, compare streaks on the leaderboard, and generate your LinkedIn share card.\n\nClick the button below or link: [Go to Leaderboard & Ranks](/rank)`;

        return {
          handled: true,
          reply,
          actionTaken: 'NAVIGATE_ROUTE',
          suggestedRoute: {
            path: '/rank',
            label: language === 'so' ? 'Fur Heerarka & Leaderboard' : 'Go to Leaderboard & Ranks',
            description: language === 'so' ? 'Arag tartanka asxaabta iyo heerkaaga' : 'Explore leaderboard rankings & tier progression',
          },
        };
      }

      // K4: Dashboard / Checklist (/)
      if (
        /(?:go\s+to|open|show|navigate|take\s+me\s+to)\s+(?:the\s+)?(?:dashboard|home|checklist|today'?s?\s+checklist|bogga\s+hore)/i.test(lower) ||
        /(?:i\s+gee|fur|u\s+gudub)\s+(?:bogga\s+hore|dashboard)/i.test(lower) ||
        /^(?:dashboard|home|bogga\s+hore)$/i.test(lower)
      ) {
        const reply =
          language === 'so'
            ? `**Bogga Hore & Xarunta Koontaroolka (Dashboard):**\n\nWaa goobta aad ku maamusho checklist-ka maanta, kala hormarinta hawlaha, iyo matrix-ka joogtada (Activity Heatmap).\n\nRiix badhanka hoose ama link-ga: [Fur Bogga Hore](/)`
            : `**Dashboard & Daily Workspace:**\n\nThis is your main command center featuring today's checklist, custom task reordering, and your yearly activity heatmap.\n\nClick the button below or link: [Go to Dashboard](/)`;

        return {
          handled: true,
          reply,
          actionTaken: 'NAVIGATE_ROUTE',
          suggestedRoute: {
            path: '/',
            label: language === 'so' ? 'Fur Bogga Hore' : 'Go to Dashboard',
            description: language === 'so' ? 'Checklist-ka maanta iyo xogta guud' : 'Today’s checklist and progress metrics',
          },
        };
      }

      // K5: Trash & Recovery (30-Day Recovery)
      if (
        /(?:go\s+to|open|show|navigate|take\s+me\s+to|where\s+(?:is|are)|how\s+to\s+find)\s+(?:the\s+)?(?:trash|recycle\s+bin|deleted\s+items|deleted\s+tasks|recovery|qashinka)/i.test(lower) ||
        /(?:how\s+to\s+restore|dib\s+u\s+soo\s+celi)\s+(?:deleted|trash|qashin)/i.test(lower) ||
        /^(?:trash|qashinka)$/i.test(lower)
      ) {
        const reply =
          language === 'so'
            ? `**Qashinka & Dib-u-soo-celinta (30-Day Trash):**\n\nHawl kasta ama caado la tirtiro waxa si ammaan ah loogu hayaa qashinka 30 maalmood ka hor intaan si joogto ah loo tirtirin. Waxaad ku soo celin kartaa hal gujin!\n\nRiix badhanka hoose ama link-ga: [Fur Qashinka](/trash)`
            : `**30-Day Trash & Recovery:**\n\nDeleted tasks and habits are safely held in the Trash container for 30 days before permanent cleanup. You can restore any item with a single click!\n\nClick the button below or link: [Open Trash](/trash)`;

        return {
          handled: true,
          reply,
          actionTaken: 'NAVIGATE_ROUTE',
          suggestedRoute: {
            path: '/trash',
            label: language === 'so' ? 'Fur Qashinka (30 Maalmood)' : 'Open 30-Day Trash',
            description: language === 'so' ? 'Dib u soo celi hawlihii ama caadooyinkii la tirtiray' : 'Restore or purge deleted tasks and habits',
          },
        };
      }

      // Not an automated command; forward to conversational Gemini API
      return { handled: false };
    },
    [
      mindStep,
      taskDraft,
      pendingTargetDate,
      language,
      user,
      session?.user,
      isAuthenticated,
      guestTasks,
      guestHabits,
      getTodayStr,
      getTomorrowStr,
      fetchTodayTasks,
      fetchActiveTasks,
      fetchHabitsCount,
      executeCreateTask,
      executeCreateHabit,
      executeDeleteTask,
      executeListTodayTasks,
      executeRescheduleTasksToTomorrow,
      buildDraftPreviewReply,
    ]
  );

  /**
   * Reset the current multi-turn conversation step
   */
  const resetMind = useCallback(() => {
    setMindStep('idle');
    setPendingTargetDate(null);
    setTaskDraft(null);
  }, []);

  return {
    mindStep,
    taskDraft,
    pendingTargetDate,
    processMessage,
    resetMind,
    isOutOfScopeQuery,
  };
}

export default useChatMind;
