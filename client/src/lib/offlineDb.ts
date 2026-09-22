import type { QueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

const DB_NAME = 'taskiye_offline_db';
const DB_VERSION = 1;

export interface OutboxItem {
  id: string;
  type: 'CREATE_TASK' | 'TOGGLE_TASK' | 'UPDATE_TASK' | 'DELETE_TASK' | 'CREATE_HABIT';
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  payload?: any;
  tempId?: string;
  createdAt: number;
  retryCount: number;
}

interface CacheRecord {
  key: string;
  data: any;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('cached_queries')) {
        db.createObjectStore('cached_queries', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('outbox_queue')) {
        const outboxStore = db.createObjectStore('outbox_queue', { keyPath: 'id' });
        outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// -------------------------------------------------------------
// Query Cache (Persists server state offline)
// -------------------------------------------------------------

export async function saveQueryCache(key: string, data: any): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cached_queries', 'readwrite');
      const store = tx.objectStore('cached_queries');
      const record: CacheRecord = { key, data, updatedAt: Date.now() };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to save query cache:', key, err);
  }
}

export async function getQueryCache<T = any>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('cached_queries', 'readonly');
      const store = tx.objectStore('cached_queries');
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.data !== undefined) {
          resolve(req.result.data as T);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Outbox Queue (Offline mutations to sync on reconnect)
// -------------------------------------------------------------

export async function addToOutbox(
  item: Omit<OutboxItem, 'id' | 'createdAt' | 'retryCount'> & { id?: string }
): Promise<string> {
  try {
    const db = await openDb();
    const id = item.id || `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fullItem: OutboxItem = {
      ...item,
      id,
      createdAt: Date.now(),
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('outbox_queue', 'readwrite');
      const store = tx.objectStore('outbox_queue');
      const req = store.put(fullItem);
      req.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('taskiye:outbox-updated'));
        resolve(id);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[OfflineDB] Failed to add to outbox:', err);
    throw err;
  }
}

export async function getPendingOutbox(): Promise<OutboxItem[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('outbox_queue', 'readonly');
      const store = tx.objectStore('outbox_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as OutboxItem[]);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removeOutboxItem(id: string): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('outbox_queue', 'readwrite');
      const store = tx.objectStore('outbox_queue');
      const req = store.delete(id);
      req.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('taskiye:outbox-updated'));
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to remove outbox item:', id, err);
  }
}

let isFlushing = false;

export async function flushOutboxQueue(
  queryClient?: QueryClient
): Promise<{ synced: number; failed: number }> {
  if (isFlushing) return { synced: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  isFlushing = true;
  window.dispatchEvent(new CustomEvent('taskiye:sync-status', { detail: { isSyncing: true } }));

  let synced = 0;
  let failed = 0;

  try {
    const items = await getPendingOutbox();
    if (items.length === 0) {
      return { synced: 0, failed: 0 };
    }

    // Process items in chronological order
    items.sort((a, b) => a.createdAt - b.createdAt);

    for (const item of items) {
      try {
        const response = await apiFetch(item.endpoint, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: item.payload ? JSON.stringify(item.payload) : undefined,
        });

        if (response.ok) {
          await removeOutboxItem(item.id);
          synced++;
        } else if (response.status >= 400 && response.status < 500) {
          // Client error (e.g. 404, 400) - drop item to avoid blocking queue
          console.warn('[OfflineDB] Dropping invalid outbox item:', item, response.status);
          await removeOutboxItem(item.id);
          failed++;
        } else {
          // 5xx Server error or offline again - break and retry later
          failed++;
          break;
        }
      } catch (err) {
        console.warn('[OfflineDB] Network error flushing item:', item.id, err);
        failed++;
        break; // Network lost during flush
      }
    }

    if (synced > 0 && queryClient) {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
    }
  } finally {
    isFlushing = false;
    window.dispatchEvent(
      new CustomEvent('taskiye:sync-status', { detail: { isSyncing: false, synced, failed } })
    );
  }

  return { synced, failed };
}
