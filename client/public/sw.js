// Taskiye Native High-Performance Service Worker
const CACHE_NAME = 'taskiye-cache-v3';

// Critical Shell Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.png',
];

// 1. Install Event - Precache critical shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[PWA SW] Pre-cache warning:', err);
      })
  );
});

// 2. Activate Event - Clean up stale cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[PWA SW] Purging outdated cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event - Intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests (e.g. POST, PUT, DELETE shouldn't be cached directly)
  if (request.method !== 'GET') {
    return;
  }

  // A. Navigation / Page Loads (HTML): Network-First, fallback to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallbackShell = await caches.match('/index.html');
          return fallbackShell || Response.error();
        })
    );
    return;
  }

  // B. API endpoints (/api/): Always Live, never cache personalized API data across sessions
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            message: 'You are currently offline.',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      })
    );
    return;
  }

  // C. Static Assets & Fonts (JS, CSS, Images, Google Fonts): Stale-While-Revalidate
  const isStaticAsset =
    url.origin === self.location.origin ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// 4. Push Event - Display incoming native OS push notifications & sync in-app bell
self.addEventListener('push', (event) => {
  let data = {
    title: 'Taskiye Alert',
    body: 'You have a new update in Taskiye.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const origin = self.location.origin;
  const iconUrl = data.icon
    ? data.icon.startsWith('http')
      ? data.icon
      : `${origin}${data.icon.startsWith('/') ? '' : '/'}${data.icon}`
    : `${origin}/icons/icon-192.png`;

  const badgeUrl = data.badge
    ? data.badge.startsWith('http')
      ? data.badge
      : `${origin}${data.badge.startsWith('/') ? '' : '/'}${data.badge}`
    : `${origin}/icons/icon-192.png`;

  const options = {
    body: data.body,
    icon: iconUrl,
    badge: badgeUrl,
    tag: data.tag || `taskiye-notification-${Date.now()}`,
    renotify: true,
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'Open Taskiye' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  const handlePush = async () => {
    // 1. Check if user is currently focused on an open Taskiye window
    let clientList = [];
    try {
      clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    } catch {
      clientList = [];
    }

    const isAppFocused = clientList.some((c) => c.focused);

    // 2. Increment / set App Badge if supported
    if ('setAppBadge' in navigator) {
      try {
        await navigator.setAppBadge();
      } catch {
        // Badging API not supported or restricted
      }
    }

    // 3. Always display native OS notification to ensure delivery on iOS and Android
    try {
      await self.registration.showNotification(data.title, options);
    } catch (err) {
      console.warn('[PWA SW] showNotification warning:', err);
    }

    // 4. Always broadcast to active client windows to update in-app bell counter & toast
    clientList.forEach((client) => {
      client.postMessage({
        type: 'PUSH_NOTIFICATION_RECEIVED',
        payload: {
          title: data.title,
          body: data.body,
          type: data.data?.type || 'system',
          url: data.data?.url || '/',
          tag: options.tag,
          createdAt: new Date().toISOString(),
        },
      });
    });
  };

  event.waitUntil(handlePush());
});

// 5. Notification Click Event - Focus, navigate to target route, or dismiss
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // If user clicked 'dismiss' action, do nothing
  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  const handleClick = async () => {
    // Clear OS app badge upon notification interaction
    if ('clearAppBadge' in navigator) {
      try {
        await navigator.clearAppBadge();
      } catch {
        // ignore
      }
    }

    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // If a window is already open, focus it and navigate
    for (const client of clientList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client && client.url !== targetUrl) {
          await client.navigate(targetUrl);
        }
        return;
      }
    }

    // If no window is open, open a new browser window
    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  };

  event.waitUntil(handleClick());
});
