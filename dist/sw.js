// Euno Shadowing service worker, served at /sw.js (scope: the whole site).
// It shows practice reminders sent by the server (Web Push) and opens the app when one is tapped.
// Having one also lets browsers offer to install the site as an app. It doesn't cache anything:
// every request still goes straight to the network.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let msg = {};
  try { msg = e.data ? e.data.json() : {}; } catch { msg = { body: e.data ? e.data.text() : '' }; }
  const url = new URL(msg.url || '/app/', self.location.origin);
  e.waitUntil(self.registration.showNotification(msg.title || 'Time for today’s shadowing', {
    body: msg.body || '',
    icon: '/assets/icon-192.png',
    tag: msg.tag || 'euno-reminder', // a new reminder replaces an unread one
    renotify: true,
    data: { url: url.origin === self.location.origin ? url.href : `${self.location.origin}/app/` },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || `${self.location.origin}/app/`;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = wins.find((w) => new URL(w.url).pathname.startsWith('/app'));
    if (app) return app.focus();
    return self.clients.openWindow(url);
  })());
});
