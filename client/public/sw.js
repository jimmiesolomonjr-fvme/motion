// Service worker for PWA standalone mode
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  // Clear old caches on activate so new deploys start fresh
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigation (HTML), so PWA launches always get the latest.
// All other requests (JS, CSS, images) pass through to browser defaults —
// Vite hashes asset filenames so they're already cache-safe.
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;

  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then((cached) => cached || caches.match('/'))
    )
  );
});

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
