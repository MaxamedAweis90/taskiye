/**
 * ============================================================================
 * TASKIYE NOTIFICATION TEMPLATE ENGINE (DUOLINGO-STYLE)
 * ============================================================================
 * 
 * RULES & GUIDELINES FOR CUSTOMIZING:
 * ----------------------------------------------------------------------------
 * 1. All notification templates are defined here in code for full developer control.
 * 2. Each category has multiple rotating variants. The engine randomly selects
 *    one variant each time to keep alerts fresh, witty, and engaging (Duolingo style).
 * 3. Placeholders automatically replaced at runtime:
 *      {firstName}    -> User's first name, or "Champion" if anonymous
 *      {streakDays}   -> Current active streak count (e.g., "7")
 *      {pendingCount} -> Number of remaining habits/tasks for today
 *      {itemName}     -> Specific habit or task title (e.g., "Read 20 Pages")
 *      {daysLeft}     -> Number of days left before 30-day trash purge (e.g., "2")
 * 4. To add a new message:
 *    Simply append a new `{ title: '...', body: '...' }` object to any category array below.
 * ============================================================================
 */

export interface NotificationCopy {
  title: string;
  body: string;
}

export interface NotificationContext {
  firstName?: string;
  streakDays?: number;
  pendingCount?: number;
  itemName?: string;
  daysLeft?: number;
}

// 1. Morning Cadence Kickoff (8:00 AM - 9:59 AM)
export const MORNING_CADENCE_TEMPLATES: NotificationCopy[] = [
  {
    title: 'Rise and conquer, {firstName}! ☀️',
    body: 'You have {pendingCount} habits ready on your daily cadence. Let’s make today count!',
  },
  {
    title: 'Your daily cadence is waiting 🎯',
    body: 'Hey {firstName}, a quick 2-minute habit this morning builds an unbreakable streak.',
  },
  {
    title: 'Morning momentum! 🚀',
    body: '{firstName}, your future self will thank you. Check in and start today’s first habit.',
  },
  {
    title: 'Coffee? Check. Habits? Next! ☕',
    body: '{pendingCount} items on today’s checklist, {firstName}. Ready to check off the first one?',
  },
];

// 2. All Tasks & Habits Completed Today (100% Clearance Celebration)
export const ALL_COMPLETED_TEMPLATES: NotificationCopy[] = [
  {
    title: 'Flawless Victory, {firstName}! 🎯',
    body: 'You crushed every single habit and task on today’s cadence! Rest easy tonight.',
  },
  {
    title: '100% Cadence Cleared! 🏆',
    body: 'Phenomenal work today, {firstName}. Your consistency is paying compound interest.',
  },
  {
    title: 'Indestructible Momentum! ⚡',
    body: 'All done for today, {firstName}! Your streak is glowing at {streakDays} days strong.',
  },
  {
    title: 'Checklist Zero achieved! ✨',
    body: 'Zero remaining tasks, {firstName}. Go relax—you’ve earned it!',
  },
];

// 3. Evening Streak at Risk / Duolingo-Style Urgency (8:00 PM - 10:30 PM)
export const STREAK_AT_RISK_TEMPLATES: NotificationCopy[] = [
  {
    title: 'Don’t let your {streakDays}-day streak die! 🔥',
    body: '{firstName}, midnight rollover is approaching! Complete 1 habit to keep the flame alive.',
  },
  {
    title: 'Your streak is crying right now! 😭',
    body: 'Hey {firstName}! {pendingCount} habits left before midnight resets your {streakDays}-day record.',
  },
  {
    title: 'Emergency Streak Alert 🚨',
    body: '{firstName}, you’re only {pendingCount} items away from keeping your {streakDays}-day streak intact!',
  },
  {
    title: 'Midnight is coming, {firstName} ⏳',
    body: 'Protect your hard-earned progress before the day ends. Just take 2 minutes now.',
  },
];

// 4. Streak Freeze Worn Off (Next Day Thaw Warning)
export const STREAK_FREEZE_MELTED_TEMPLATES: NotificationCopy[] = [
  {
    title: 'Your Streak Freeze has melted! ❄️➡️🔥',
    body: 'Hey {firstName}, your streak freeze protected you yesterday, but today’s flame is live again!',
  },
  {
    title: 'Freeze shield expired 🛡️',
    body: 'Back in the arena, {firstName}! Check off today’s habits to maintain your {streakDays}-day streak.',
  },
  {
    title: 'Back on the clock, {firstName}! ⚡',
    body: 'Your freeze day is over. Complete today’s cadence to keep moving toward your goals.',
  },
];

// 5. Account Migration: Guest to Real Account Sync
export const GUEST_MIGRATION_TEMPLATES: NotificationCopy[] = [
  {
    title: 'Welcome aboard, {firstName}! 🛡️',
    body: 'All your guest habits, tasks, and streaks have been safely migrated to the cloud.',
  },
  {
    title: 'Cloud Backup Activated ☁️',
    body: 'Your progress is now permanently synced across all your devices, {firstName}.',
  },
];

// 6. Trash TTL Expiration Imminent (Days 27, 28, 29)
export const TRASH_EXPIRING_TEMPLATES: NotificationCopy[] = [
  {
    title: '⚠️ Permanent deletion in {daysLeft} days',
    body: '"{itemName}" in your Trash will be permanently erased soon. Open Trash if you need to restore it.',
  },
  {
    title: 'Final call for "{itemName}" ⏳',
    body: 'Only {daysLeft} day(s) left before "{itemName}" is permanently purged by the 30-day TTL.',
  },
];

// 7. Trash Purged Alert (Day 30)
export const TRASH_PURGED_TEMPLATES: NotificationCopy[] = [
  {
    title: '🗑️ Trash TTL Purge Complete',
    body: '"{itemName}" reached the 30-day limit and was permanently purged from storage.',
  },
];

// 8. Daily Task Planning Reminder (Plan Today's Priorities)
export const TASK_PLANNING_TEMPLATES: NotificationCopy[] = [
  {
    title: "Plan Today's Priorities 🎯",
    body: "Hey {firstName}! Take 2 minutes to choose your focus tasks for today and set yourself up for victory.",
  },
  {
    title: "What's on your agenda today? ⚡",
    body: "Clarity creates momentum, {firstName}. Set your key tasks for today and conquer them one by one.",
  },
  {
    title: "Time to set today's focus 📋",
    body: "Good habits start with clear intentions. Add today's tasks to your checklist now, {firstName}!",
  },
  {
    title: "Design your day, {firstName} 🌅",
    body: "A successful day starts with a game plan. Tap here to set today's focus and habits.",
  },
];

/**
 * Replaces dynamic variables ({firstName}, {streakDays}, etc.) with context data
 */
export function renderTemplate(template: NotificationCopy, ctx: NotificationContext): NotificationCopy {
  const name = ctx.firstName || 'Champion';
  const streak = ctx.streakDays !== undefined ? String(ctx.streakDays) : '1';
  const pending = ctx.pendingCount !== undefined ? String(ctx.pendingCount) : '1';
  const item = ctx.itemName || 'Item';
  const days = ctx.daysLeft !== undefined ? String(ctx.daysLeft) : '1';

  const format = (str: string) =>
    str
      .replace(/\{firstName\}/g, name)
      .replace(/\{streakDays\}/g, streak)
      .replace(/\{pendingCount\}/g, pending)
      .replace(/\{itemName\}/g, item)
      .replace(/\{daysLeft\}/g, days);

  return {
    title: format(template.title),
    body: format(template.body),
  };
}

/**
 * Randomly selects one variant from an array of templates
 */
export function pickRandomTemplate(templates: NotificationCopy[]): NotificationCopy {
  const index = Math.floor(Math.random() * templates.length);
  return templates[index] || templates[0] || { title: 'Taskiye Alert', body: 'Check in on your habits today!' };
}
