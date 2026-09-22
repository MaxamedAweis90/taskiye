import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushOutboxQueue, getPendingOutbox } from '../lib/offlineDb';

export function useOnlineStatus() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [wasOffline, setWasOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Refresh pending outbox count
  const refreshPendingCount = useCallback(async () => {
    try {
      const items = await getPendingOutbox();
      setPendingCount(items.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    return await flushOutboxQueue(queryClient);
  }, [queryClient]);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Auto-flush outbox queue on network reconnect
      flushOutboxQueue(queryClient).then(() => {
        refreshPendingCount();
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingCount();
    };

    const handleOutboxUpdate = () => {
      refreshPendingCount();
    };

    const handleSyncStatus = (e: Event) => {
      const custom = e as CustomEvent<{ isSyncing: boolean }>;
      setIsSyncing(Boolean(custom.detail?.isSyncing));
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('taskiye:outbox-updated', handleOutboxUpdate);
    window.addEventListener('taskiye:sync-status', handleSyncStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('taskiye:outbox-updated', handleOutboxUpdate);
      window.removeEventListener('taskiye:sync-status', handleSyncStatus);
    };
  }, [queryClient, refreshPendingCount]);

  return {
    isOnline,
    wasOffline,
    isSyncing,
    pendingCount,
    syncNow,
  };
}
