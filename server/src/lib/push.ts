import webpush from 'web-push';
import { PushSubscription, IPushSubscription } from '../models/PushSubscription.js';
import { InAppNotification } from '../models/InAppNotification.js';

// Deterministic VAPID keypair fallback ensures serverless cold starts never diverge
const DEFAULT_VAPID_PUBLIC_KEY =
  'BPqiFDbamgJZPy7vVjylHU2Tjyi0CuBXEX2QBtbendOCwA8x1GZv3XkIALf9gQKBo4AQN3y0SPWNGxjApAvZB0o';
const DEFAULT_VAPID_PRIVATE_KEY =
  's6yeP5Gnv79idVx-jR3kZaJvHDlHPCD4JBms7h_dUqw';

const activeVapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY,
};

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

  const finalPayload = {
    ...payload,
    icon: payload.icon || '/logo-tight.png',
    badge: payload.badge || '/logo-tight.png',
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(finalPayload));
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

/**
 * Dispatches a dual notification:
 * 1. Creates an InAppNotification document in MongoDB (for the bell icon & activity feed)
 * 2. If a push subscription is provided, sends the native Web Push alert
 */
export async function dispatchUnifiedNotification(params: {
  sub?: IPushSubscription | null;
  userId?: string | null;
  endpoint?: string | null;
  title: string;
  body: string;
  type: 'morning' | 'planning' | 'streak' | 'achievement' | 'trash' | 'system';
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
}): Promise<{ pushSent: boolean; inAppSaved: boolean }> {
  let pushSent = false;
  let inAppSaved = false;

  const targetUserId = params.userId || params.sub?.userId || null;
  const targetEndpoint = params.endpoint || params.sub?.endpoint || null;

  // 1. Create InAppNotification in database
  try {
    await InAppNotification.create({
      userId: targetUserId,
      endpoint: targetEndpoint,
      title: params.title,
      body: params.body,
      type: params.type,
      data: {
        url: params.url || '/',
        tag: params.tag || `notif-${Date.now()}`,
        ...(params.data || {}),
      },
      isRead: false,
    });
    inAppSaved = true;
  } catch (err) {
    console.warn('[Notifications] Failed to save in-app notification:', err);
  }

  // 2. If sub provided, dispatch web push
  if (params.sub) {
    pushSent = await sendPushNotification(params.sub, {
      title: params.title,
      body: params.body,
      icon: '/logo-tight.png',
      badge: '/logo-tight.png',
      tag: params.tag || `notif-${Date.now()}`,
      data: {
        url: params.url || '/',
        type: params.type,
        ...(params.data || {}),
      },
    });
  }

  return { pushSent, inAppSaved };
}

export const VAPID_PUBLIC_KEY = activeVapidKeys.publicKey;
