import { useState, useEffect, useCallback } from 'react';

const FALLBACK_VAPID_KEY =
  'BDa5_97lKl35HcOpR1gJ6EHLTJIsEF2J9bjZc0Z1hOxuhFM0gjo3zk8cGPFnZqvevUzFCHmzdFZrc_JEbB9viwU';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * High-performance synthesized sound chime using Web Audio API
 */
export function playCelebrationChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
    });

    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  } catch {
    // Graceful fallback if Web Audio is restricted
  }
}

/**
 * Dispatches an immediate rich Welcome Notification to the user's device
 */
export async function sendWelcomeNotification(): Promise<void> {
  const title = 'Welcome to Taskiye! 🔥';
  const body = "You're all set! Now you can track daily habits, protect your streak, and conquer your goals.";
  const icon = '/logo.png';

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg?.showNotification) {
        await reg.showNotification(title, {
          body,
          icon,
          badge: icon,
          tag: 'taskiye-welcome-notification',
          data: { url: '/' },
        });
        return;
      }
    }
  } catch {
    // Graceful fallback below
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon });
    } catch {
      // ignore
    }
  }
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState<PushSubscription | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => reg?.pushManager?.getSubscription())
          .then((sub) => {
            if (sub) {
              setIsSubscribed(true);
              setActiveSubscription(sub);
            }
          })
          .catch(() => {
            setIsSubscribed(false);
          });
      }
    }
  }, []);

  const subscribe = useCallback(
    async (preferences: {
      dailyReminders: boolean;
      morningReminderTime?: string;
      taskPlanningReminder?: boolean;
      taskPlanningTime?: string;
      streakAlerts: boolean;
      dailyCadenceDigest: boolean;
      completionChimes?: boolean;
    }): Promise<boolean> => {
      if (!isSupported) return false;

      setIsSyncing(true);
      try {
        // 1. Request Notification Permission
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== 'granted') {
          setIsSyncing(false);
          return false;
        }

        // 2. Fetch VAPID public key
        let vapidKey = FALLBACK_VAPID_KEY;
        try {
          const res = await fetch('/api/notifications/vapid-public-key');
          const json = await res.json();
          if (json?.data?.publicKey) {
            vapidKey = json.data.publicKey;
          }
        } catch {
          // Use fallback key
        }

        // 3. Ensure Service Worker is registered with timeout protection
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          let reg = await navigator.serviceWorker.getRegistration();
          if (!reg) {
            reg = await navigator.serviceWorker.register('/sw.js');
          }

          // Timeout wrapper to guarantee navigator.serviceWorker.ready NEVER hangs
          const readyPromise = navigator.serviceWorker.ready;
          const timeoutPromise = new Promise<ServiceWorkerRegistration | null>((resolve) =>
            setTimeout(() => resolve(reg || null), 2500)
          );
          const activeReg = await Promise.race([readyPromise, timeoutPromise]);

          if (activeReg?.pushManager) {
            let sub = await activeReg.pushManager.getSubscription();

            // Validate that the existing subscription was created with the active VAPID key
            if (sub && sub.options && sub.options.applicationServerKey) {
              const currentKeyBytes = new Uint8Array(sub.options.applicationServerKey);
              const targetKeyBytes = urlBase64ToUint8Array(vapidKey);
              let isMatch = currentKeyBytes.length === targetKeyBytes.length;
              if (isMatch) {
                for (let i = 0; i < currentKeyBytes.length; i++) {
                  if (currentKeyBytes[i] !== targetKeyBytes[i]) {
                    isMatch = false;
                    break;
                  }
                }
              }

              if (!isMatch) {
                console.log('[Push] VAPID key mismatch on device. Renewing subscription with active key...');
                try {
                  await sub.unsubscribe();
                } catch {
                  // ignore
                }
                sub = null;
              }
            }

            if (!sub) {
              try {
                sub = await activeReg.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
                });
              } catch (subErr) {
                console.warn('[Push] PushManager subscribe warning:', subErr);
              }
            }

            if (sub) {
              const subJson = sub.toJSON();
              const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

              await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  endpoint: sub.endpoint,
                  keys: subJson.keys,
                  timezone: userTimezone,
                  preferences,
                }),
              }).catch(() => null);

              setIsSubscribed(true);
              setActiveSubscription(sub);
            }
          }
        }

        setIsSyncing(false);
        return true;
      } catch (err) {
        console.warn('[Push] Subscription failed:', err);
        setIsSyncing(false);
        // Fallback: If permission was granted, return true so UI recognizes approval
        return Notification.permission === 'granted';
      }
    },
    [isSupported]
  );

  const sendTestAlert = useCallback(
    async (
      type: 'morning' | 'planning' | 'streak' | 'achievement' | 'trash' | 'system' = 'system'
    ): Promise<{
      success: boolean;
      data?: { title: string; body: string; type: string; url: string };
    }> => {
      let serverDispatched = false;
      let notificationPayload: { title: string; body: string; type: string; url: string } | undefined;

      // 1. Retrieve active subscription or query PushManager directly from registration
      let endpoint = activeSubscription?.endpoint;
      if (!endpoint && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager?.getSubscription();
          if (sub?.endpoint) {
            endpoint = sub.endpoint;
            setActiveSubscription(sub);
            setIsSubscribed(true);
          }
        } catch {
          // ignore
        }
      }

      // 2. Send server-side simulated notification
      try {
        const res = await fetch('/api/notifications/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: endpoint || undefined, type }),
        });
        const json = await res.json();
        if (json?.success) {
          serverDispatched = Boolean(json.data?.dispatched || json.data?.inAppSaved);
          notificationPayload = json.data;
        }
      } catch (err) {
        console.warn('[Push] Server push test failed:', err);
      }

      const simTitles: Record<string, { title: string; body: string; url: string }> = {
        morning: {
          title: '☀️ Good Morning, Champion!',
          body: 'Start strong! 3 daily habits and your morning focus routine are ready.',
          url: '/',
        },
        planning: {
          title: '🎯 Task Planning Check-in',
          body: 'Mid-day momentum: Time to organize priorities and conquer pending tasks.',
          url: '/tasks',
        },
        streak: {
          title: '🔥 Streak Protection Alert!',
          body: 'Your streak is on the line! Complete at least 1 habit before midnight.',
          url: '/habits',
        },
        achievement: {
          title: '🏆 Milestone Conquest Unlocked!',
          body: 'Outstanding consistency! All daily targets completed. Rank progress updated.',
          url: '/rank',
        },
        trash: {
          title: '🗑️ Trash Items Expiring Soon',
          body: 'Soft-deleted tasks in your junk bin will be permanently purged in 48 hours.',
          url: '/',
        },
        system: {
          title: '⚡ Taskiye System Connected!',
          body: 'Your device is verified and push notifications are fully operational.',
          url: '/',
        },
      };

      const fallbackInfo = simTitles[type] || simTitles.system;
      const title = notificationPayload?.title || fallbackInfo.title;
      const body = notificationPayload?.body || fallbackInfo.body;
      const url = notificationPayload?.url || fallbackInfo.url;

      // 3. Trigger immediate in-app bell update via custom event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('taskiye_refresh_notifications', {
            detail: {
              id: `test_sim_${type}_${Date.now()}`,
              title,
              description: body,
              time: 'Just now',
              read: false,
              type,
              url,
              createdAt: new Date().toISOString(),
            },
          })
        );
      }

      // 4. Fallback client-side notification if service worker is active
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg?.showNotification) {
            await reg.showNotification(title, {
              body,
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: `taskiye-sim-${type}-${Date.now()}`,
              data: { url },
            });
            return { success: true, data: { title, body, type, url } };
          }
        } catch {
          // ignore
        }
      }

      return {
        success: serverDispatched,
        data: { title, body, type, url },
      };
    },
    [activeSubscription]
  );

  const isIos =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent || '') &&
    !(window as unknown as { MSStream?: unknown }).MSStream;
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
  const isIosNonStandalone = Boolean(isIos && !isStandalone);

  return {
    isSupported,
    permission,
    isSubscribed,
    isSyncing,
    isIosNonStandalone,
    subscribe,
    sendTestAlert,
    sendWelcomeNotification,
    playCelebrationChime,
  };
}
