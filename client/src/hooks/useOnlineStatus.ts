import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushOutboxQueue, getPendingOutbox } from '../lib/offlineDb';

const OFFLINE_STORAGE_KEY = 'taskiye_is_offline';

function getStoredOffline(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const val = localStorage.getItem(OFFLINE_STORAGE_KEY);
    if (val !== null) return val === 'true';
  } catch {}
  return typeof navigator !== 'undefined' ? !navigator.onLine : false;
}

function setStoredOffline(offline: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_STORAGE_KEY, offline ? 'true' : 'false');
  } catch {}
}

// Shared singleton state across all pages and components
let globalIsOffline = getStoredOffline();
let globalIsNetworkReconnected = false;
let globalIsChecking = false;
let globalIsSyncing = false;
let globalPendingCount = 0;

const listeners = new Set<() => void>();

function notifyAll() {
  listeners.forEach((listener) => listener());
}

// Exportable helper: allows any failing query / API call to immediately flag offline mode
export function reportNetworkFailure() {
  if (!globalIsOffline) {
    globalIsOffline = true;
    globalIsNetworkReconnected = false;
    setStoredOffline(true);
    notifyAll();
  }
}

// Perform a real network ping check to verify true internet reachability
export async function pingConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.status === 200;
  } catch {
    return false;
  }
}

// Global browser event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    globalIsOffline = true;
    globalIsNetworkReconnected = false;
    setStoredOffline(true);
    notifyAll();
  });

  window.addEventListener('online', () => {
    // When internet comes back, do NOT auto-refresh the page!
    // Instead, update the bottom indicator to "You are online. Retry"
    // and wait for the user to explicitly click the button.
    if (globalIsOffline) {
      globalIsNetworkReconnected = true;
      notifyAll();
    }
  });

  // Re-verify network status when the PWA is resumed from background
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pingConnection().then((reachable) => {
        if (!reachable) {
          if (!globalIsOffline) {
            globalIsOffline = true;
            globalIsNetworkReconnected = false;
            setStoredOffline(true);
            notifyAll();
          }
        } else {
          // Internet restored while in background:
          // Do NOT auto-refresh! Mark as reconnected so user can click Retry.
          if (globalIsOffline) {
            globalIsNetworkReconnected = true;
            notifyAll();
          }
        }
      });
    }
  });

  window.addEventListener('taskiye:sync-status', (e: Event) => {
    const custom = e as CustomEvent<{ isSyncing: boolean }>;
    globalIsSyncing = Boolean(custom.detail?.isSyncing);
    notifyAll();
  });
}

export function useOnlineStatus() {
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    listeners.add(onChange);

    // Initial check of outbox count
    getPendingOutbox()
      .then((items) => {
        globalPendingCount = items.length;
        notifyAll();
      })
      .catch(() => {});

    // Initial verification of real network reachability on boot / refresh
    pingConnection().then((reachable) => {
      if (!reachable) {
        if (!globalIsOffline) {
          globalIsOffline = true;
          globalIsNetworkReconnected = false;
          setStoredOffline(true);
          notifyAll();
        }
      } else {
        if (globalIsOffline) {
          // It was marked offline, but internet is reachable now:
          // Indicate internet is back without auto-refreshing
          globalIsNetworkReconnected = true;
          notifyAll();
        } else {
          setStoredOffline(false);
        }
      }
    });

    return () => {
      listeners.delete(onChange);
    };
  }, []);

  // Action: manually verify and reconnect
  const retryConnection = useCallback(async (): Promise<boolean> => {
    globalIsChecking = true;
    notifyAll();

    const reachable = await pingConnection();

    globalIsChecking = false;

    if (reachable) {
      // Internet is available: exit offline mode and refresh content
      globalIsOffline = false;
      globalIsNetworkReconnected = false;
      setStoredOffline(false);
      notifyAll();

      // Flush any queued mutations in the background
      try {
        await flushOutboxQueue(queryClient);
        const items = await getPendingOutbox();
        globalPendingCount = items.length;
      } catch {
      }

      // Invalidate all active queries to refresh data
      queryClient.invalidateQueries();
      return true;
    } else {
      // Still offline
      globalIsOffline = true;
      globalIsNetworkReconnected = false;
      setStoredOffline(true);
      notifyAll();
      return false;
    }
  }, [queryClient]);

  const syncNow = useCallback(async () => {
    if (globalIsOffline) return;
    return await flushOutboxQueue(queryClient);
  }, [queryClient]);

  return {
    isOnline: !globalIsOffline,
    isOffline: globalIsOffline,
    isNetworkReconnected: globalIsNetworkReconnected,
    isChecking: globalIsChecking,
    isSyncing: globalIsSyncing,
    pendingCount: globalPendingCount,
    retryConnection,
    syncNow,
  };
}

