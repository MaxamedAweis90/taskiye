import { ChatMindProfileCard, TaskDraft, SuggestedRoute } from './chatmind';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  createdTaskId?: string;
  createdTaskDate?: string;
  targetPage?: 'dashboard' | 'history';
  taskDraft?: TaskDraft;
  profileCard?: ChatMindProfileCard;
  suggestedRoute?: SuggestedRoute;
}

const GUEST_CHAT_KEY = 'taskiye_chat_history_guest';
const USER_CHAT_KEY_PREFIX = 'taskiye_chat_history_user_';
const MAX_MESSAGES_SAVED = 100;

export function getChatStorageKey(userId?: string | null): string {
  if (userId && typeof userId === 'string' && userId.trim() !== '') {
    return `${USER_CHAT_KEY_PREFIX}${userId.trim()}`;
  }
  return GUEST_CHAT_KEY;
}

/**
 * Load chat messages from local storage safely
 */
export function loadChatMessages(userId?: string | null): ChatMessage[] {
  try {
    const key = getChatStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.warn('[chatStorage] Failed to load chat messages:', err);
    return [];
  }
}

/**
 * Save chat messages to local storage, keeping the latest MAX_MESSAGES_SAVED
 */
export function saveChatMessages(messages: ChatMessage[], userId?: string | null): void {
  try {
    const key = getChatStorageKey(userId);
    // Keep only the latest messages to prevent localStorage quota exhaustion
    const sliced = messages.slice(-MAX_MESSAGES_SAVED);
    localStorage.setItem(key, JSON.stringify(sliced));
  } catch (err) {
    console.warn('[chatStorage] Failed to save chat messages:', err);
  }
}

/**
 * Clear chat messages for a specific user or guest
 */
export function clearChatMessages(userId?: string | null): void {
  try {
    const key = getChatStorageKey(userId);
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('[chatStorage] Failed to clear chat messages:', err);
  }
}

/**
 * Check if guest has stored chat messages
 */
export function hasGuestChatMessages(): boolean {
  try {
    const raw = localStorage.getItem(GUEST_CHAT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

/**
 * Migrate guest chat messages to newly authenticated user
 */
export function migrateGuestChatMessages(targetUserId: string): boolean {
  if (!targetUserId) return false;
  try {
    const guestMessages = loadChatMessages(null);
    if (!guestMessages || guestMessages.length === 0) {
      return false;
    }

    const existingUserMessages = loadChatMessages(targetUserId);

    // Deduplicate by message ID
    const seenIds = new Set<string>(existingUserMessages.map((m) => m.id));
    const merged = [...existingUserMessages];

    for (const msg of guestMessages) {
      if (!seenIds.has(msg.id)) {
        merged.push(msg);
        seenIds.add(msg.id);
      }
    }

    saveChatMessages(merged, targetUserId);
    clearChatMessages(null); // Clear guest storage after successful merge
    return true;
  } catch (err) {
    console.warn('[chatStorage] Failed to migrate guest chat messages:', err);
    return false;
  }
}
