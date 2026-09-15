import { useState, useEffect, useCallback } from 'react';

const FALLBACK_VAPID_KEY =
  'BN8p6E37W3QeE_7fL3JqJ1Yc0Y4k1nB3A5_h8Z3z8b4J5X7g8V4p2_X6w0P1o9E4t3_x7Y1n8m5K4p2_X6w0P1o';

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

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState<PushSubscription | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
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
  }, []);

  const subscribe = useCallback(
    async (preferences: {
      dailyReminders: boolean;
      streakAlerts: boolean;
      dailyCadenceDigest: boolean;
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

        // 3. Register push subscription with Service Worker
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
          });
        }

        // 4. Send subscription & timezone to backend
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
        });

        setIsSubscribed(true);
        setActiveSubscription(sub);
        setIsSyncing(false);
        return true;
      } catch (err) {
        console.warn('[Push] Subscription failed:', err);
        setIsSyncing(false);
        return false;
      }
    },
    [isSupported]
  );

  const sendTestAlert = useCallback(async (): Promise<boolean> => {
    if (!activeSubscription) return false;
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: activeSubscription.endpoint }),
      });
      const json = await res.json();
      return json.success;
    } catch {
      return false;
    }
  }, [activeSubscription]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isSyncing,
    subscribe,
    sendTestAlert,
    playCelebrationChime,
  };
}
