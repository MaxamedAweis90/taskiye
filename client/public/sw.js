// Taskiye Native High-Performance Service Worker
const CACHE_NAME = 'taskiye-cache-v1';

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

  // B. API endpoints (/api/): Network-First with offline resilience
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET API responses for offline preview
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Fallback offline JSON response
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              message: 'You are currently offline. Local changes remain cached.',
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
