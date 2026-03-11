const CACHE_NAME = 'portal-cap-v2';
const STATIC_ASSETS = ['/'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Push: show notification — kept simple for maximum iOS/Android compatibility
self.addEventListener('push', event => {
  if (!event.data) return;

  let title = 'Portal Cap';
  let body = 'New update on a watched claim.';
  let url = '/';
  let tag = 'claim-update';

  try {
    const data = event.data.json();
    title = data.title || title;
    body = data.body || body;
    url = data.url || url;
    tag = data.tag || tag;
  } catch {
    body = event.data.text() || body;
  }

  // Keep options minimal — actions are not supported on iOS and some Android browsers
  const options = {
    body,
    icon: '/icon-light-32x32.png',
    badge: '/icon-light-32x32.png',
    tag,
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return client.navigate(urlToOpen);
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('notificationclose', event => {
  console.log('[SW] Notification dismissed:', event.notification.tag);
});
