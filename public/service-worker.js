const CACHE_NAME = 'portal-cap-v1';
const STATIC_ASSETS = ['/'];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first strategy
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Only cache same-origin requests
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Push: show notification
self.addEventListener('push', event => {
  if (!event.data) {
    console.log('[Service Worker] Push event with no data');
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New update available',
      icon: '/icon-light-32x32.png',
      badge: '/icon-light-32x32.png',
      tag: data.tag || 'claim-update',
      requireInteraction: false,
      data: {
        url: data.url || '/',
        ...data.customData,
      },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Portal Cap', options)
    );
  } catch (error) {
    console.error('[Service Worker] Error handling push:', error);
    event.waitUntil(
      self.registration.showNotification('Portal Cap Alert', {
        body: event.data.text(),
        icon: '/icon-light-32x32.png',
        badge: '/icon-light-32x32.png',
      })
    );
  }
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close
self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] Notification dismissed:', event.notification.tag);
});
