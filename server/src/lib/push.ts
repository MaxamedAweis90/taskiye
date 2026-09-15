import webpush from 'web-push';
import { PushSubscription, IPushSubscription } from '../models/PushSubscription.js';

// Standard VAPID configuration with production env overrides
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BN8p6E37W3QeE_7fL3JqJ1Yc0Y4k1nB3A5_h8Z3z8b4J5X7g8V4p2_X6w0P1o9E4t3_x7Y1n8m5K4p2_X6w0P1o';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'k7_Y1n8m5K4p2X6w0P1o9E4t3x7Y1n8m5K4p2X6w0P0';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@taskiye.com';

let isConfigured = false;

export function configureWebPush(): boolean {
  if (isConfigured) return true;
  try {
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      isConfigured = true;
      return true;
    }
  } catch (err) {
    console.warn('[WebPush] VAPID initialization warning:', err);
  }
  return false;
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

export { VAPID_PUBLIC_KEY };
