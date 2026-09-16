export const APP_CATEGORIES = [
  'Work',
  'Health & Fitness',
  'Routine Activity',
  'Mind Improving',
  'Personal Growth',
] as const;

export type AppCategory = (typeof APP_CATEGORIES)[number];

export const CATEGORY_OPTIONS_WITH_ALL = ['All Categories', ...APP_CATEGORIES] as const;

/**
 * Normalizes any free-form or legacy category string to one of the 5 unified categories.
 */
export function normalizeCategory(cat?: string | null): AppCategory {
  if (!cat) return 'Work';
  const lower = cat.toLowerCase().trim();
  if (lower.includes('health') || lower.includes('fitness')) {
    return 'Health & Fitness';
  }
  if (lower.includes('routine')) {
    return 'Routine Activity';
  }
  if (
    lower.includes('mind') ||
    lower.includes('reading') ||
    lower.includes('read') ||
    lower.includes('learn') ||
    lower.includes('study') ||
    lower.includes('focus')
  ) {
    return 'Mind Improving';
  }
  if (
    lower.includes('growth') ||
    lower.includes('personal') ||
    lower.includes('goal') ||
    lower.includes('habit')
  ) {
    return 'Personal Growth';
  }
  return 'Work';
}

/**
 * Visual styling tokens for unified categories (badges, modal pills, and color dots).
 */
export function getCategoryBadgeStyle(cat?: string | null): {
  badgeClass: string;
  pillClass: string;
  dotColor: string;
  icon: string;
} {
  const normalized = normalizeCategory(cat);
  switch (normalized) {
    case 'Health & Fitness':
      return {
        badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
        pillClass:
          'bg-[#122425] border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.2)]',
        dotColor: 'bg-emerald-400',
        icon: '💪',
      };
    case 'Routine Activity':
      return {
        badgeClass: 'bg-teal-500/15 border-teal-500/30 text-teal-300',
        pillClass:
          'bg-[#122228] border-teal-400 text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.2)]',
        dotColor: 'bg-teal-400',
        icon: '🔄',
      };
    case 'Mind Improving':
      return {
        badgeClass: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
        pillClass:
          'bg-[#132238] border-indigo-400 text-indigo-200 shadow-[0_0_12px_rgba(129,140,248,0.2)]',
        dotColor: 'bg-indigo-400',
        icon: '🧠',
      };
    case 'Personal Growth':
      return {
        badgeClass: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
        pillClass:
          'bg-[#221832] border-purple-400 text-purple-200 shadow-[0_0_12px_rgba(192,132,252,0.2)]',
        dotColor: 'bg-purple-400',
        icon: '🚀',
      };
    case 'Work':
    default:
      return {
        badgeClass: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
        pillClass:
          'bg-[#251f14] border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(250,204,21,0.2)]',
        dotColor: 'bg-amber-400',
        icon: '💼',
      };
  }
}
