import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'taskiye_theme';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveEffectiveTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') return getSystemTheme();
  return mode;
};

const applyThemeToDom = (resolved: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }

  // Update theme-color meta tag for mobile browsers and PWA status bar
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'dark' ? '#0A0F1D' : '#f8fafc');
  }
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'dark'; // default to Kinetic Midnight
};

const initialMode = getInitialTheme();
const initialResolved = resolveEffectiveTheme(initialMode);
applyThemeToDom(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => {
  // Listen to OS system color scheme changes if system mode is active
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      const currentMode = get().theme;
      if (currentMode === 'system') {
        const newResolved = getSystemTheme();
        applyThemeToDom(newResolved);
        set({ resolvedTheme: newResolved });
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      mediaQuery.addListener(handleMediaChange);
    }
  }

  return {
    theme: initialMode,
    resolvedTheme: initialResolved,

    setTheme: (mode: ThemeMode) => {
      const resolved = resolveEffectiveTheme(mode);
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // ignore storage errors
      }
      applyThemeToDom(resolved);
      set({ theme: mode, resolvedTheme: resolved });
    },

    toggleTheme: () => {
      const currentResolved = get().resolvedTheme;
      const nextTheme: ThemeMode = currentResolved === 'dark' ? 'light' : 'dark';
      get().setTheme(nextTheme);
    },
  };
});
