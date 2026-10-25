// Service Worker von Life: nur für Mitteilungen. Kein Zwischenspeichern von Daten.
self.addEventListener('push', (e) => {
  let d = { title: 'Life', body: '', url: '/' };
  try { d = { ...d, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, tag: d.tag, data: { url: d.url }, icon: '/icon-192.png', badge: '/icon-192.png' }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ('focus' in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
