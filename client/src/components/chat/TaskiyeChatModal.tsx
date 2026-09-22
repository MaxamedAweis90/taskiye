import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Send,
  RotateCcw,
  Bot,
  Maximize2,
  Minimize2,
  Loader2,
  Settings,
  ArrowLeft,
  Check,
  Compass,
  Target,
  Lightbulb,
  HelpCircle,
  Trash2,
  ArrowUpRight,
  ChevronDown,
  Expand,
  Shrink,
  Calendar,
  Sparkles,
  Trophy,
  LayoutDashboard,
} from 'lucide-react';
import { useChatMind, type SuggestedRoute } from './chatmind';
import { useTaskiyeStore } from '../../store/useTaskiyeStore';
import {
  ChatMessage,
  loadChatMessages,
  saveChatMessages,
  clearChatMessages,
} from './chatStorage';

export type { ChatMessage };

interface TaskiyeChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearInitialPrompt?: () => void;
  initialPrompt?: string;
  initialLanguage?: 'en' | 'so';
  user?: {
    id?: string;
    name?: string;
    username?: string;
    email?: string;
    avatarUrl?: string;
    image?: string | null;
  };
}

interface SuggestionItem {
  icon: React.ElementType;
  text: string;
}

const STARTER_SUGGESTIONS: Record<'en' | 'so', SuggestionItem[]> = {
  en: [
    { icon: Compass, text: 'How do habit streaks and freezing work?' },
    { icon: Target, text: 'Best way to organize today’s checklist?' },
    { icon: Lightbulb, text: 'How do ranking tiers and streaks work?' },
    { icon: HelpCircle, text: 'How does guest storage vs cloud sync work?' },
  ],
  so: [
    { icon: Compass, text: 'Sidee u shaqeeyaan caadooyinka iyo streaks?' },
    { icon: Target, text: 'Sideen u kala hormariyaa hawlahayga maanta?' },
    { icon: Lightbulb, text: 'Sidee u shaqeeyaan darajooyinka hogaanka?' },
    { icon: HelpCircle, text: 'Maxaa farqi u dhexeeya habka martida iyo akoonka?' },
  ],
};

/**
 * Format draft date to user-friendly string
 */
function formatDraftDate(dateStr: string, lang: 'en' | 'so'): string {
  try {
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (dateStr === todayStr) {
      return lang === 'so' ? 'Maanta (Today)' : 'Today';
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
    if (dateStr === tomorrowStr) {
      return lang === 'so' ? 'Berri (Tomorrow)' : 'Tomorrow';
    }
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(lang === 'so' ? 'so-SO' : 'en-US', {
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
 * Extract an in-app route from message text if available
 */
function extractSuggestedRoute(content: string, language: 'en' | 'so'): SuggestedRoute | null {
  if (!content) return null;

  const linkMatch = content.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (linkMatch) {
    const [, label, path] = linkMatch;
    if (path.includes('habit')) {
      return {
        path: '/habits',
        label,
        description: language === 'so' ? 'Dhis caadooyin cusub oo ilaali taxanahaaga' : 'Create habits and build daily streaks',
      };
    }
    if (path.includes('task')) {
      return {
        path: '/tasks',
        label,
        description: language === 'so' ? 'Eeg hawlaha soo socda iyo taariikhdii hore' : 'View upcoming and past task archives',
      };
    }
    if (path.includes('rank')) {
      return {
        path: '/rank',
        label,
        description: language === 'so' ? 'Arag tartanka asxaabta iyo heerkaaga' : 'Explore leaderboard rankings & tier progression',
      };
    }
    if (path.includes('trash')) {
      return {
        path: '/trash',
        label,
        description: language === 'so' ? 'Dib u soo celi hawlihii la tirtiray (30 maalmood)' : 'Restore or purge deleted tasks and habits',
      };
    }
    if (path === '/') {
      return {
        path: '/',
        label,
        description: language === 'so' ? 'Checklist-ka maanta iyo xogta guud' : 'Today’s checklist and progress metrics',
      };
    }
    return { path, label };
  }

  return null;
}

/**
 * Return appropriate route icon for navigation cards
 */
const getRouteIcon = (path: string) => {
  if (path.includes('habit')) return <Target className="w-4 h-4" />;
  if (path.includes('task')) return <Calendar className="w-4 h-4" />;
  if (path.includes('rank')) return <Trophy className="w-4 h-4" />;
  if (path.includes('trash')) return <Trash2 className="w-4 h-4" />;
  return <LayoutDashboard className="w-4 h-4" />;
};

/**
 * RichMessageContent: Parses markdown-style bold, italics, bullets, numbers,
 * and clickable route links into clean, stylish React elements.
 */
const RichMessageContent: React.FC<{
  content: string;
  isUser: boolean;
  onNavigateRoute?: (path: string) => void;
}> = ({ content, isUser, onNavigateRoute }) => {
  if (!content) return null;

  const formatInline = (text: string, keyPrefix: string) => {
    const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

    return parts.map((part, index) => {
      const key = `${keyPrefix}-${index}`;

      // Markdown Link: [Label](/route)
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const [, linkText, linkUrl] = linkMatch;
          return (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateRoute?.(linkUrl);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-400/15 dark:hover:bg-amber-400/25 text-amber-900 dark:text-amber-300 font-bold border border-amber-500/30 dark:border-amber-400/30 text-[11px] transition-all cursor-pointer active:scale-95 group/link align-middle shadow-xs"
            >
              <span>{linkText}</span>
              <ArrowUpRight className="w-3 h-3 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform opacity-80" />
            </button>
          );
        }
      }

      if (part.startsWith('**') && part.endsWith('**')) {
        const cleanText = part.slice(2, -2).replace(/\*/g, '');
        return (
          <strong
            key={key}
            className={`font-black ${
              isUser
                ? 'text-white'
                : 'text-slate-900 dark:text-amber-300'
            }`}
          >
            {cleanText}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        const cleanText = part.slice(1, -1).replace(/\*/g, '');
        return (
          <em key={key} className="italic text-slate-700 dark:text-slate-200">
            {cleanText}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const cleanText = part.slice(1, -1);
        return (
          <code
            key={key}
            className="px-1.5 py-0.5 rounded text-[10.5px] font-mono bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/20"
          >
            {cleanText}
          </code>
        );
      }
      const clean = part.replace(/\*{2,}/g, '').replace(/^\*|\*$/g, '');
      return <React.Fragment key={key}>{clean}</React.Fragment>;
    });
  };

  const lines = content.split('\n');

  return (
    <div className="flex flex-col gap-1.5 leading-relaxed select-text">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} className="h-1" />;
        }

        // Bullet list item
        if (/^[-•]\s+/.test(trimmed)) {
          const bulletText = trimmed.replace(/^[-•]\s+/, '');
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1 my-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  isUser ? 'bg-white' : 'bg-amber-500 dark:bg-amber-400'
                }`}
              />
              <div className="flex-1 min-w-0">
                {formatInline(bulletText, `line-${lineIdx}`)}
              </div>
            </div>
          );
        }

        // Numbered list item
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          const num = numMatch[1];
          const numText = numMatch[2];
          return (
            <div key={lineIdx} className="flex items-start gap-1.5 pl-1 my-0.5">
              <span
                className={`font-black text-[11px] shrink-0 ${
                  isUser ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {num}.
              </span>
              <div className="flex-1 min-w-0">
                {formatInline(numText, `line-${lineIdx}`)}
              </div>
            </div>
          );
        }

        // Standard line
        return (
          <p key={lineIdx} className="leading-relaxed">
            {formatInline(trimmed, `line-${lineIdx}`)}
          </p>
        );
      })}
    </div>
  );
};

export const TaskiyeChatModal: React.FC<TaskiyeChatModalProps> = ({
  isOpen,
  onClose,
  onClearInitialPrompt,
  initialPrompt,
  initialLanguage = 'en',
  user,
}) => {
  // Initialize language preference from localStorage if available
  const [language, setLanguage] = useState<'en' | 'so'>(() => {
    try {
      const stored = localStorage.getItem('taskiye_ai_language');
      if (stored === 'en' || stored === 'so') return stored;
    } catch {
    }
    return initialLanguage;
  });

  const [view, setView] = useState<'chat' | 'settings'>('chat');
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return loadChatMessages(user?.id);
  });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSelectedSuggestion, setHasSelectedSuggestion] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [isTextareaOverflowing, setIsTextareaOverflowing] = useState(false);
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  // Sync messages when user identity changes (e.g. guest to authenticated user or switch)
  const prevUserIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => {
    if (prevUserIdRef.current !== user?.id) {
      prevUserIdRef.current = user?.id;
      const reloaded = loadChatMessages(user?.id);
      setMessages(reloaded);
      if (reloaded.length > 0) {
        initialGreetingSent.current = true;
      }
    }
  }, [user?.id]);

  // Persist messages whenever conversation updates
  useEffect(() => {
    if (messages.length > 0) {
      saveChatMessages(messages, user?.id);
    }
  }, [messages, user?.id]);

  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const latestMessageTopRef = useRef<HTMLDivElement | null>(null);

  // Close chat when clicking elsewhere, but KEEP open if clicking topbar controls (user dropdown, notification, streak)
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Inside the modal itself -> stay open
      if (modalRef.current && modalRef.current.contains(target)) {
        return;
      }

      // 2. Chat toggle buttons -> let toggle handler handle it
      if (target.closest('[data-chat-toggle]')) {
        return;
      }

      // 3. Topbar controls (streak, notifications, user dropdown & their popovers) -> DO NOT close
      if (
        target.closest('[data-topbar-controls]') ||
        target.closest('[data-streak-widget]') ||
        target.closest('[data-notification-widget]') ||
        target.closest('[data-profile-widget]')
      ) {
        return;
      }

      // 4. Clicked elsewhere -> close chat
      onClose();
    };

    // Attach after current tick so the click that opens chat doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  const { processMessage, resetMind } = useChatMind({
    language,
    user,
  });

  // Smoothly scroll the inner messages container to the top of the newly generated message
  const scrollToTopOfLatestMessage = () => {
    if (latestMessageTopRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const target = latestMessageTopRef.current;
      const targetTop = target.offsetTop;
      container.scrollTo({
        top: Math.max(0, targetTop - 12),
        behavior: 'smooth',
      });
    } else {
      latestMessageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const { setIsTrashOpen } = useTaskiyeStore();

  // View newly created task in Dashboard Checklist or Task History and trigger 3-second highlight
  const handleViewTask = (taskId: string, targetPage?: 'dashboard' | 'history') => {
    sessionStorage.setItem('taskiye_highlight_task', taskId);
    onClose();
    if (targetPage === 'history') {
      navigate('/tasks');
    } else {
      navigate('/');
    }
    window.dispatchEvent(new CustomEvent('taskiye-highlight-task', { detail: { taskId } }));
  };

  // Navigate directly to an in-app route and dismiss chat modal
  const handleNavigateRoute = (path: string) => {
    onClose();
    if (path === '/trash' || path === 'trash') {
      setIsTrashOpen(true);
      return;
    }
    navigate(path);
  };

  // Sync initialLanguage if explicitly passed
  useEffect(() => {
    if (initialLanguage) {
      setLanguage(initialLanguage);
    }
  }, [initialLanguage]);

  // Personalized user display details
  const displayName = user?.name || user?.username || user?.email?.split('@')[0] || 'Guest';
  const firstName = displayName.split(' ')[0] || displayName;
  const userInitial = displayName.charAt(0).toUpperCase();
  const avatarUrl = user?.avatarUrl || user?.image;
  const isGuest = !user?.email;

  // Initial welcome message based on selected language and user (no XP mentions)
  const initialGreetingSent = useRef(false);
  useEffect(() => {
    if (messages.length > 0) {
      initialGreetingSent.current = true;
      return;
    }

    if (isOpen && messages.length === 0 && !initialGreetingSent.current) {
      initialGreetingSent.current = true;
      const initialContent =
        language === 'so'
          ? `Ku soo dhawoow Taskiye, ${isGuest ? 'Marti sharafle' : firstName}! ⚡ Waxaan ahay kaaliyahaaga garaadka macmalka ah. Waxaan kaa caawin karaa caadooyinkaaga, hawlaha maalinlaha ah, streaks, iyo darajooyinka. Maxaad jeclaan lahayd inaad ogaato?`
          : `Welcome to Taskiye, ${isGuest ? 'Guest' : firstName}! ⚡ I am your personal AI productivity companion. Ask me anything about creating habits, maintaining streaks, organizing tasks, or climbing the leaderboard!`;

      const initialWelcome: ChatMessage = {
        id: 'welcome-msg',
        role: 'model',
        content: initialContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([initialWelcome]);
      saveChatMessages([initialWelcome], user?.id);
    }
  }, [isOpen, language, messages.length, isGuest, firstName, user?.id]);

  // Auto-trigger initial prompt if passed (single execution guarantee)
  const consumedPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (isOpen && initialPrompt && consumedPromptRef.current !== initialPrompt) {
      consumedPromptRef.current = initialPrompt;
      onClearInitialPrompt?.();
      handleSendMessage(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPrompt, onClearInitialPrompt]);

  // Auto scroll to bottom only when user submits or on initial open, NEVER after AI generates
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const initialFeedScrolled = useRef(false);
  useEffect(() => {
    if (isOpen && view === 'chat') {
      if (!initialFeedScrolled.current) {
        initialFeedScrolled.current = true;
        scrollToBottom(false);
      }
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, view]);

  // Scroll indicator: show when feed isn't at the bottom
  const handleFeedScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollIndicator(distFromBottom > 48);
  }, []);

  // Adjust textarea dynamic height (up to 5 lines ~120px, then show expand button)
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el || isInputExpanded) return;
    el.style.height = 'auto';
    const maxHeight = 120; // ~5 lines before expand button appears
    const scrollHeight = el.scrollHeight;

    if (scrollHeight > maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = 'auto';
      setIsTextareaOverflowing(true);
    } else {
      el.style.height = `${Math.max(40, scrollHeight)}px`;
      el.style.overflowY = 'hidden';
      setIsTextareaOverflowing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    adjustTextareaHeight();
  };

  // Reset textarea height to 1 line (40px)
  const resetTextareaHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = '40px';
      el.style.overflowY = 'hidden';
    }
    setIsTextareaOverflowing(false);
    setIsInputExpanded(false);
  };


  // Request clear confirmation in the chat itself
  const handleRequestClear = () => {
    setView('chat');
    setShowClearConfirm(true);
  };

  // Discard clear confirmation
  const handleDiscardClear = () => {
    setShowClearConfirm(false);
  };

  // Confirm and execute clear
  const handleConfirmClear = () => {
    clearChatMessages(user?.id);
    const freshGreeting =
      language === 'so'
        ? `Ku soo dhawoow Taskiye, ${isGuest ? 'Marti sharafle' : firstName}! ⚡ Waxaan ahay kaaliyahaaga garaadka macmalka ah. Waxaan kaa caawin karaa caadooyinkaaga, hawlaha maalinlaha ah, streaks, iyo darajooyinka. Maxaad jeclaan lahayd inaad ogaato?`
        : `Welcome to Taskiye, ${isGuest ? 'Guest' : firstName}! ⚡ I am your personal AI productivity companion. Ask me anything about creating habits, maintaining streaks, organizing tasks, or climbing the leaderboard!`;

    const freshMsg: ChatMessage = {
      id: `fresh-${Date.now()}`,
      role: 'model',
      content: freshGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([freshMsg]);
    saveChatMessages([freshMsg], user?.id);
    setHasSelectedSuggestion(false);
    setShowClearConfirm(false);
    resetMind();
  };

  // Set language from Settings
  const handleSelectLanguage = (newLang: 'en' | 'so') => {
    setLanguage(newLang);
    try {
      localStorage.setItem('taskiye_ai_language', newLang);
    } catch {
    }

    const langNotification =
      newLang === 'so'
        ? 'Af-Soomaali ayaad dooratay! Waa diyaar inaan af-Soomaali kuugu jawaabo.'
        : 'Language preference saved to English! Ready to assist you.';

    setMessages((prev) => [
      ...prev,
      {
        id: `lang-switch-${Date.now()}`,
        role: 'model',
        content: langNotification,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Send message to Gemini API (with ChatMind scope guardrail & agentic action handling)
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setHasSelectedSuggestion(true);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputValue('');
    resetTextareaHeight();

    // 1. Process via ChatMind: Scope check, Identity/Profile, Task/Habit creation, Rescheduling, Today inspection
    const mindResult = await processMessage(text);
    if (mindResult.handled && mindResult.reply) {
      const botMessageId = `model-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: botMessageId,
          role: 'model',
          content: mindResult.reply!,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdTaskId: mindResult.createdTaskId,
          createdTaskDate: mindResult.createdTaskDate,
          targetPage: mindResult.targetPage,
          taskDraft: mindResult.taskDraft,
          profileCard: mindResult.profileCard,
          suggestedRoute: mindResult.suggestedRoute,
        },
      ]);
      setTimeout(() => {
        scrollToTopOfLatestMessage();
      }, 50);
      return;
    }

    // 2. Forward to conversational Gemini API for contextual productivity discussions
    setIsLoading(true);

    const botMessageId = `model-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: botMessageId,
        role: 'model',
        content: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setTimeout(() => {
      scrollToTopOfLatestMessage();
    }, 50);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          language,
          stream: true,
          user: {
            name: displayName,
            username: user?.username,
            email: user?.email,
            isGuest,
          },
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Chat API returned an error');
      }

      if (res.body && res.headers.get('Content-Type')?.includes('text/event-stream')) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedReply = '';
        let streamBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split('\n');
          // Keep the last partial line in buffer
          streamBuffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.replace('data:', '').trim();
              if (dataStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  accumulatedReply += parsed.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMessageId ? { ...msg, content: accumulatedReply } : msg
                    )
                  );
                }
              } catch {
                // Ignore parse errors from partial chunks
              }
            }
          }
        }
      } else {
        const json = await res.json();
        const replyText =
          json?.data?.reply ||
          (language === 'so'
            ? 'Waan ka xumahay, qalad baa dhacay. Fadlan ku celi.'
            : 'Sorry, I encountered an issue. Please try again.');

        setMessages((prev) =>
          prev.map((msg) => (msg.id === botMessageId ? { ...msg, content: replyText } : msg))
        );
      }
    } catch (err) {
      console.error('Chat error:', err);
      const fallbackNotice =
        language === 'so'
          ? 'Waan ka xumahay, adeega hadda lama xiriiri karo. Fadlan hubi khadkaaga internetka.'
          : 'Sorry, unable to connect to the assistant right now. Please check your connection and try again.';

      setMessages((prev) =>
        prev.map((msg) => (msg.id === botMessageId ? { ...msg, content: fallbackNotice } : msg))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Background Dim Overlay (Mobile always, and Desktop when Expanded) */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 ${
          isExpanded ? 'block' : 'md:hidden'
        }`}
      />

      {/* Main Chat Container - Strictly fixed dimensions on desktop (w-[410px] h-[580px]), mobile h-[100dvh] */}
      <div
        ref={modalRef}
        className={`fixed z-50 flex flex-col transition-all duration-300 ease-out inset-0 md:inset-auto md:bottom-[4.75rem] md:left-[6.25rem] w-full animate-in slide-in-from-bottom duration-200 ${
          isExpanded
            ? 'h-[100dvh] md:w-[720px] md:h-[720px] md:max-h-[86vh]'
            : 'h-[100dvh] md:w-[410px] md:h-[580px] md:max-h-[85vh]'
        }`}
      >
        {/* Speech Bubble Pointer Tail (Desktop bottom-left) - sits outside inner overflow-hidden to point at Chat Button */}
        {!isExpanded && (
          <div
            className="hidden md:block absolute bottom-3.5 -left-2 w-4 h-4 bg-white dark:bg-[#10192D] border-l border-b border-slate-200 dark:border-white/[0.1] rotate-45 transform pointer-events-none shadow-[-3px_3px_6px_rgba(0,0,0,0.04)] z-20"
            aria-hidden="true"
          />
        )}

        {/* Inner Card Container (with rounded corners, border, shadow, and overflow-hidden for chat scroll) */}
        <div
          className={`relative flex flex-col w-full h-full bg-white dark:bg-[#10192D] border border-slate-200 dark:border-white/[0.1] shadow-2xl rounded-none md:rounded-3xl overflow-hidden ${
            isExpanded
              ? 'md:shadow-[0_25px_60px_rgba(0,0,0,0.6)]'
              : 'md:shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
          }`}
        >

        {/* Top Header */}
        <div className="flex items-center justify-between px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3.5 border-b border-slate-100 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0B132B]/80 backdrop-blur-md shrink-0 md:rounded-t-3xl">
          {view === 'settings' ? (
            /* Settings Header View */
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setView('chat')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-amber-500" />
                <span>{language === 'so' ? 'Ku noqo Sheekada' : 'Back to Chat'}</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Standard Chat Header View (Clean: No 'Gemini' badge) */
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md shrink-0">
                  <Bot className="w-5 h-5" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#10192D]" />
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                    Taskiye AI
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    {language === 'so' ? 'Kaaliyahaaga Wax-soosaarka' : 'Productivity Assistant'}
                  </span>
                </div>
              </div>

              {/* Header Controls: Settings button, Clear History, Expand, Close */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setView('settings')}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title={language === 'so' ? 'Hagaajinta Kaaliyaha' : 'Assistant Settings & Language'}
                >
                  <Settings className="w-4 h-4 text-amber-500 hover:rotate-45 transition-transform duration-200" />
                </button>

                <button
                  type="button"
                  onClick={handleRequestClear}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Clear conversation history"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Expand / Minimize Toggle */}
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-white/10"
                  title={isExpanded ? 'Minimize chat window' : 'Expand chat window'}
                  aria-label={isExpanded ? 'Minimize chat' : 'Expand chat'}
                >
                  {isExpanded ? (
                    <Minimize2 className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* View Switch: Settings Screen vs Conversation Feed */}
        {view === 'settings' ? (
          /* =========================================================================
             SETTINGS SCREEN (Clean: No extra AI model / XP detailing)
             ========================================================================= */
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar bg-slate-50/50 dark:bg-transparent">
            {/* 1. User Profile Information Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0B132B] border border-slate-200 dark:border-white/[0.08] shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                {language === 'so' ? 'Xogta Isticmaalaha' : 'User Information'}
              </span>

              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-12 h-12 rounded-xl object-cover border border-amber-500/30 shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold text-base flex items-center justify-center shadow-md">
                    {userInitial}
                  </div>
                )}

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {displayName}
                    </span>
                    {isGuest ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        Guest
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Member
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user?.email || (language === 'so' ? 'Kalfadhiga Martida' : 'Local Guest Session')}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Language Switcher Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0B132B] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'so' ? 'Dooro Luqadda AI' : 'AI Assistant Language'}
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  {language === 'so' ? 'Af-Soomaali' : 'English (Default)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* English Option */}
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('en')}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    language === 'en'
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-800 dark:text-amber-300 shadow-sm'
                      : 'bg-slate-100/70 hover:bg-slate-200/70 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🇬🇧</span>
                    <span>English</span>
                  </div>
                  {language === 'en' && <Check className="w-4 h-4 text-amber-500" />}
                </button>

                {/* Somali Option */}
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('so')}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    language === 'so'
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-800 dark:text-amber-300 shadow-sm'
                      : 'bg-slate-100/70 hover:bg-slate-200/70 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🇸🇴</span>
                    <span>Af-Soomaali</span>
                  </div>
                  {language === 'so' && <Check className="w-4 h-4 text-amber-500" />}
                </button>
              </div>

              <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                {language === 'so'
                  ? 'Luqadda aad doorato si toos ah ayaa loo keydiyaa, kaaliyuhuna wuxuu kuugu jawaabi doonaa luqaddan.'
                  : 'Your chosen language is saved automatically and the assistant will answer in this preferred language.'}
              </p>
            </div>

            {/* 3. Conversation History Card (Cleaned: No AI Model / XP details) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0B132B] border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {language === 'so' ? 'Taariikhda Sheekada' : 'Conversation History'}
              </span>

              <button
                type="button"
                onClick={handleRequestClear}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === 'so' ? 'Nadiifi Sheekada oo bilow cusub' : 'Clear Chat & Start Fresh'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* =========================================================================
             CONVERSATION VIEW
             ========================================================================= */
          <>
            {/* Message Feed Area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleFeedScroll}
              className="relative flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar bg-slate-50/50 dark:bg-transparent"
            >
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const isLatestModelMessage = !isUser && idx === messages.length - 1;
                return (
                  <div
                    key={msg.id}
                    ref={isLatestModelMessage ? latestMessageTopRef : undefined}
                    className={`flex gap-2.5 items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar Badge */}
                    <div className="shrink-0 mt-0.5">
                      {isUser ? (
                        avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="w-7 h-7 rounded-lg object-cover border border-amber-500/40 shadow-sm"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold text-xs shadow-sm">
                            {userInitial}
                          </div>
                        )
                      ) : (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-amber-500 dark:text-amber-400 border border-slate-300 dark:border-white/10 shadow-sm">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div
                      className={`max-w-[88%] sm:max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-tr-none shadow-sm'
                          : 'bg-white dark:bg-[#0B132B] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/[0.08] rounded-tl-none shadow-sm'
                      }`}
                    >
                      {msg.content ? (
                        <div className="animate-in fade-in duration-150">
                          <RichMessageContent content={msg.content} isUser={isUser} onNavigateRoute={handleNavigateRoute} />
                          {isLatestModelMessage && isLoading && (
                            <span className="inline-block w-1.5 h-3.5 bg-amber-500 dark:bg-amber-400 ml-1 translate-y-[2px] animate-pulse rounded-sm" />
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-400 italic">
                          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                          <span>{language === 'so' ? 'Wuu fikirayaa...' : 'Thinking...'}</span>
                        </span>
                      )}

                      {/* Interactive Action: View Task Link (Checklist vs Task History) */}
                      {msg.createdTaskId && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-start">
                          <button
                            type="button"
                            onClick={() => handleViewTask(msg.createdTaskId!, msg.targetPage)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-400/15 dark:hover:bg-amber-400/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 dark:border-amber-400/30 text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
                          >
                            <span>
                              {msg.targetPage === 'history'
                                ? language === 'so'
                                  ? 'Ka arag Taariikhda Hawlaha'
                                  : 'View in Task History'
                                : language === 'so'
                                ? 'Ka arag Dashboard-ka'
                                : 'View in Checklist'}
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Interactive Route Navigation Card */}
                      {!isUser && (() => {
                        const route = msg.suggestedRoute || extractSuggestedRoute(msg.content, language);
                        if (!route) return null;
                        return (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.08] flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-200">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Compass className="w-3 h-3 text-amber-500" />
                              <span>{language === 'so' ? 'Bogga Laguu Taliyay' : 'Suggested Destination'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleNavigateRoute(route.path)}
                              className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-400/10 dark:hover:bg-amber-400/20 border border-amber-500/30 dark:border-amber-400/30 text-amber-900 dark:text-amber-200 transition-all text-left group cursor-pointer active:scale-[0.98]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-8 h-8 rounded-lg bg-amber-500/20 dark:bg-amber-400/20 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                                  {getRouteIcon(route.path)}
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-bold truncate group-hover:text-amber-700 dark:group-hover:text-amber-100">
                                    {route.label}
                                  </span>
                                  {route.description && (
                                    <span className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                                      {route.description}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 shrink-0 group-hover:translate-x-0.5 transition-transform">
                                <span>{language === 'so' ? 'Tag Hada' : 'Go Now'}</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          </div>
                        );
                      })()}

                      {/* Interactive Task Draft Preview Card */}
                      {msg.taskDraft && (
                        <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 dark:border-amber-400/30 shadow-sm flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Sparkles className="w-3 h-3" />
                              </span>
                              <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                {language === 'so' ? 'Horudhaca Hawsha' : 'Task Preview'}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                              {language === 'so' ? 'Sugaya Xaqiijin' : 'Needs Confirmation'}
                            </span>
                          </div>

                          {/* Task Info Details */}
                          <div className="p-2.5 rounded-xl bg-white/90 dark:bg-[#0B132B]/90 border border-slate-200/60 dark:border-white/[0.08] flex flex-col gap-2 shadow-xs">
                            {/* Title */}
                            <div className="flex items-start gap-2">
                              <span className="text-[11px] font-semibold text-slate-400 shrink-0 mt-0.5">
                                {language === 'so' ? 'Hawsha:' : 'Task:'}
                              </span>
                              <span className="text-xs font-black text-slate-900 dark:text-white leading-snug break-words">
                                {msg.taskDraft.title}
                              </span>
                            </div>

                            {/* Date & Destination */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <span className="font-semibold text-slate-400 shrink-0">
                                {language === 'so' ? 'Taariikhda:' : 'Date:'}
                              </span>
                              <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                                <Calendar className="w-3 h-3 text-amber-500" />
                                {formatDraftDate(msg.taskDraft.targetDate, language)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                {msg.taskDraft.targetDate === new Date().toLocaleDateString('en-CA')
                                  ? (language === 'so' ? '📍 Checklist (Maanta)' : '📍 Today’s Checklist')
                                  : (language === 'so' ? '📍 Taariikhda Hawlaha (/tasks)' : '📍 Task History (/tasks)')}
                              </span>
                            </div>

                            {/* Category */}
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="font-semibold text-slate-400 shrink-0">
                                {language === 'so' ? 'Qaybta:' : 'Category:'}
                              </span>
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25">
                                {msg.taskDraft.category}
                              </span>
                            </div>
                          </div>

                          {/* Confirm & Cancel Actions */}
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleSendMessage(language === 'so' ? 'Haa, abuur hawsha' : 'Confirm and create task')}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{language === 'so' ? 'Xaqiiji & Abuur' : 'Confirm & Create'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleSendMessage(language === 'so' ? 'Jooji' : 'Cancel')}
                              className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 font-bold text-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>{language === 'so' ? 'Jooji' : 'Cancel'}</span>
                            </button>
                          </div>

                          {/* Quick natural-language edit tips */}
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                            {language === 'so'
                              ? '💡 Waxaad qori kartaa tusaale "taariikhda ka dhig berri" ama "cinwaanka ka dhig..." si aad wax uga beddesho.'
                              : '💡 Reply with "change date to tomorrow" or "change title to..." to adjust, or click Confirm.'}
                          </p>
                        </div>
                      )}

                      {/* Interactive Profile Card */}
                      {msg.profileCard && (
                        <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-sm flex flex-col gap-3">
                          {/* User Header */}
                          <div className="flex items-center gap-3">
                            {msg.profileCard.avatarUrl ? (
                              <img
                                src={msg.profileCard.avatarUrl}
                                alt={msg.profileCard.name}
                                className="w-12 h-12 rounded-xl object-cover border-2 border-amber-500/40 shadow-sm shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold text-base flex items-center justify-center shadow-md shrink-0">
                                {msg.profileCard.initial}
                              </div>
                            )}

                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                                  {msg.profileCard.name}
                                </span>
                                {msg.profileCard.isGuest ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                                    Guest
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                                    Member
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {msg.profileCard.email ||
                                  (msg.profileCard.username
                                    ? `@${msg.profileCard.username}`
                                    : language === 'so'
                                    ? 'Kalfadhiga Martida'
                                    : 'Local Guest Session')}
                              </span>
                            </div>
                          </div>

                          {/* Quick Productivity Stats Grid */}
                          {msg.profileCard.stats && (
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
                              <div className="p-2 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05] flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  {language === 'so' ? 'Hawlaha Maanta' : "Today's Tasks"}
                                </span>
                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
                                  {msg.profileCard.stats.completedCount} / {msg.profileCard.stats.tasksCount}{' '}
                                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                    ({language === 'so' ? 'dhammaystiran' : 'done'})
                                  </span>
                                </span>
                              </div>

                              <div className="p-2 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05] flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  {language === 'so' ? 'Caadooyinka' : 'Habits Tracking'}
                                </span>
                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
                                  {msg.profileCard.stats.habitsCount}{' '}
                                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                    {language === 'so' ? 'firfircoon' : 'active'}
                                  </span>
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Action Button: Go to Profile Settings */}
                          <div className="flex items-center justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => setView('settings')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              <span>{language === 'so' ? 'Hagaajinta Profile-ka' : 'Profile & Settings'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div
                        className={`text-[9px] mt-1 text-right select-none ${
                          isUser ? 'text-amber-100/80' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />

              {/* Scroll-to-bottom indicator — sticky at bottom of feed when content overflows */}
              {showScrollIndicator && (
                <div className="sticky bottom-0 left-0 right-0 flex justify-center pb-1 pt-2 pointer-events-none">
                  <button
                    type="button"
                    onClick={() => {
                      messagesContainerRef.current?.scrollTo({
                        top: messagesContainerRef.current.scrollHeight,
                        behavior: 'smooth',
                      });
                    }}
                    className="pointer-events-auto flex items-center gap-1 pl-2.5 pr-3 py-1.5 rounded-full bg-white/90 dark:bg-[#10192D]/90 backdrop-blur-md border border-slate-200 dark:border-white/[0.1] shadow-lg text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-[#162032] transition-all active:scale-95 animate-in fade-in slide-in-from-bottom-2 duration-200 cursor-pointer"
                    aria-label="Scroll to latest"
                  >
                    <ChevronDown className="w-3 h-3" />
                    <span>More below</span>
                  </button>
                </div>
              )}
            </div>

            {/* Inline Clear Confirmation Alert in Chat */}
            {showClearConfirm && (
              <div className="mx-3.5 my-2 p-3.5 rounded-2xl bg-amber-50/90 dark:bg-[#162032] border border-amber-500/40 shadow-xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 shrink-0 select-none">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {language === 'so' ? 'Ma tirtirtaa sheekadan?' : 'Clear this conversation?'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDiscardClear}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title={language === 'so' ? 'Ka noqo' : 'Discard'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {language === 'so'
                    ? 'Tani waxay tirtiri doontaa dhammaan fariimaha hadda jira waxayna bilaabi doontaa sheeko cusub.'
                    : 'This will clear all current messages in this chat and start fresh.'}
                </p>

                <div className="flex items-center justify-end gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleDiscardClear}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-all cursor-pointer active:scale-95"
                  >
                    {language === 'so' ? 'Ka noqo (Discard)' : 'Discard'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClear}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    {language === 'so' ? 'Haa, Tirtir (Clear)' : 'Clear Chat'}
                  </button>
                </div>
              </div>
            )}

            {/* Quick Starter Suggestion Chips (Select-once design matching reference image, no XP) */}
            {!hasSelectedSuggestion && messages.length <= 2 && (
              <div className="px-3 py-2.5 bg-slate-100/70 dark:bg-[#0B132B]/60 border-t border-slate-100 dark:border-white/[0.04] shrink-0">
                <div className="flex flex-wrap gap-2 text-[11.5px]">
                  {STARTER_SUGGESTIONS[language].map((item, idx) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(item.text)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#162032] hover:bg-amber-50 dark:hover:bg-[#1f2b44] text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-300 border border-slate-200 dark:border-white/10 hover:border-amber-500/40 transition-all cursor-pointer active:scale-95 shadow-sm text-left"
                      >
                        <span className="w-4 h-4 rounded-full bg-amber-500/10 dark:bg-amber-400/15 flex items-center justify-center shrink-0 border border-amber-500/20">
                          <IconComponent className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                        </span>
                        <span className="truncate max-w-[240px] sm:max-w-[280px] font-medium">
                          {item.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Gemini-Style Input Footer */}
            <div className="border-t border-slate-100 dark:border-white/[0.08] bg-white dark:bg-[#10192D] shrink-0 md:rounded-b-3xl">
              {/* Expanded textarea mode — full-area editor */}
              {isInputExpanded ? (
                <div className="flex flex-col">
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      rows={8}
                      placeholder={
                        language === 'so'
                          ? 'I weydii wax ku saabsan Taskiye...'
                          : 'Ask about habits, tasks, streaks, or ranks...'
                      }
                      className="w-full resize-none p-4 bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none leading-relaxed custom-scrollbar"
                      style={{ height: '200px' }}
                    />
                  </div>
                  <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsInputExpanded(false)}
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <Shrink className="w-3 h-3" />
                      <span>Collapse</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputValue.trim() || isLoading}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                        inputValue.trim() && !isLoading
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-40'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal inline input row — wrapper IS the pill, buttons are flex siblings */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="p-3"
                >
                  <div className="flex items-end rounded-2xl bg-slate-100 dark:bg-[#0B132B] border border-slate-200/80 dark:border-white/[0.08] focus-within:border-amber-500/50 dark:focus-within:border-amber-400/50 transition-[border-color] min-h-[40px] overflow-hidden">
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      placeholder={
                        language === 'so'
                          ? 'I weydii wax ku saabsan Taskiye...'
                          : 'Ask about habits, tasks, streaks, or ranks...'
                      }
                      className="flex-1 resize-none py-2.5 pl-3.5 pr-2 bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none min-h-[40px] overflow-hidden custom-scrollbar leading-relaxed"
                    />

                    {/* Expand button — appears when textarea content overflows */}
                    {isTextareaOverflowing && inputValue.trim() && (
                      <button
                        type="button"
                        onClick={() => setIsInputExpanded(true)}
                        className="shrink-0 w-7 h-7 mb-[6.5px] mr-0.5 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200/60 dark:hover:bg-white/10 transition-all cursor-pointer animate-in fade-in duration-150"
                        title="Expand input"
                        aria-label="Expand input"
                      >
                        <Expand className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Send button — animates in only with real (non-whitespace) text */}
                    {inputValue.trim() && (
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="shrink-0 w-7 h-7 mb-[6.5px] mr-[6.5px] rounded-lg flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95 transition-all cursor-pointer animate-in fade-in zoom-in-75 duration-150"
                        title="Send message"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </>
        )}
        </div>
      </div>
    </>
  );
};
