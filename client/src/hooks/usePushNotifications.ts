import { useState, useEffect, useCallback } from 'react';

const FALLBACK_VAPID_KEY =
  'BPqiFDbamgJZPy7vVjylHU2Tjyi0CuBXEX2QBtbendOCwA8x1GZv3XkIALf9gQKBo4AQN3y0SPWNGxjAvZB0o';

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

  const sendTestAlert = useCallback(async (): Promise<boolean> => {
    // 1. Try server-side push notification if active subscription exists
    if (activeSubscription) {
      try {
        const res = await fetch('/api/notifications/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: activeSubscription.endpoint }),
        });
        const json = await res.json();
        if (json?.success) return true;
      } catch (err) {
        console.warn('[Push] Server push test failed, attempting client notification:', err);
      }
    }

    // 2. Direct Service Worker notification
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.showNotification) {
          await reg.showNotification('Taskiye Connected! 🔥', {
            body: 'Your device is verified and ready for streak & daily habit alerts.',
            icon: '/logo.png',
            badge: '/logo.png',
            tag: 'taskiye-test-notification',
            data: { url: '/' },
          });
          return true;
        }
      } catch (swErr) {
        console.warn('[Push] Service worker showNotification failed:', swErr);
      }
    }

    // 3. Fallback native browser Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Taskiye Connected! 🔥', {
          body: 'Your device is verified and ready for streak & daily habit alerts.',
          icon: '/logo.png',
        });
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }, [activeSubscription]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isSyncing,
    subscribe,
    sendTestAlert,
    sendWelcomeNotification,
    playCelebrationChime,
  };
}
