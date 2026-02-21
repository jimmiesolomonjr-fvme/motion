// Service worker for PWA standalone mode
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// Push notification handler
self.addEventListener('push', (e) => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    const options = {
      body: data.body || 'You have a new message',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { conversationId: data.conversationId },
      vibrate: [200, 100, 200],
    };
    e.waitUntil(self.registration.showNotification(data.title || 'Motion', options));
  } catch {
    // Ignore malformed push data
  }
});

// Notification click handler
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const conversationId = e.notification.data?.conversationId;
  const url = conversationId ? `/chat/${conversationId}` : '/messages';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Try to focus an existing window
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
