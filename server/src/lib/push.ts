import webpush from 'web-push';
import { PushSubscription, IPushSubscription } from '../models/PushSubscription.js';

// Standard VAPID configuration with auto-generated fallback
let activeVapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
};

if (!activeVapidKeys.publicKey || !activeVapidKeys.privateKey) {
  try {
    activeVapidKeys = webpush.generateVAPIDKeys();
  } catch (err) {
    console.warn('[WebPush] Default VAPID key generation warning:', err);
  }
}

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@taskiye.com';

let isConfigured = false;

export function configureWebPush(): boolean {
  if (isConfigured) return true;
  try {
    if (activeVapidKeys.publicKey && activeVapidKeys.privateKey) {
      webpush.setVapidDetails(VAPID_SUBJECT, activeVapidKeys.publicKey, activeVapidKeys.privateKey);
      isConfigured = true;
      return true;
    }
  } catch (err) {
    console.warn('[WebPush] VAPID initialization warning:', err);
  }
  return false;
}

export function getVapidPublicKey(): string {
  return activeVapidKeys.publicKey;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    type?: string;
    [key: string]: unknown;
  };
}

/**
 * Send a push notification to a specific stored subscription.
 * Handles 410 Gone / 404 Not Found by pruning the expired subscription.
 */
export async function sendPushNotification(
  sub: IPushSubscription,
  payload: PushNotificationPayload
): Promise<boolean> {
  configureWebPush();

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return true;
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    // 410 Gone or 404 indicates the user unsubscribed or revoked permission on their device
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      console.log(`[WebPush] Pruning expired subscription for endpoint: ${sub.endpoint.slice(0, 30)}...`);
      try {
        await PushSubscription.deleteOne({ _id: sub._id });
      } catch (dbErr) {
        console.warn('[WebPush] Failed to prune subscription:', dbErr);
      }
    } else {
      console.warn('[WebPush] Push dispatch error:', err?.message || error);
    }
    return false;
  }
}

export const VAPID_PUBLIC_KEY = activeVapidKeys.publicKey;
