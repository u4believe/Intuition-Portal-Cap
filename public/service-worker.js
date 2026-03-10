// Service Worker for handling push notifications
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
      tag: data.tag || 'default-notification',
      requireInteraction: data.requireInteraction || false,
      data: {
        url: data.url || '/',
        ...data.customData,
      },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Portal Cap', options)
    );
  } catch (error) {
    console.error('[Service Worker] Error handling push:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(
      clientList => {
        // Check if there's already a window/tab with the target URL open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window/tab with the target URL
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }
    )
  );
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('[Service Worker] Notification closed:', event.notification.tag);
});
