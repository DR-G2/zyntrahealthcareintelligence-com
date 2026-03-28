// Zyntra Push Notification Service Worker
// This file MUST live at the root so it has scope over the entire origin.

self.addEventListener('push', (event) => {
  let data = { title: 'Zyntra', body: 'You have a new training insight.' };
  try {
    data = event.data?.json() || data;
  } catch {
    // fallback to defaults
  }

  const options = {
    body: data.body,
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    tag: data.tag || 'zyntra-notification',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
