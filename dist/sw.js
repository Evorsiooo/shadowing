// Euno Shadowing service worker, served at /sw.js (scope: the whole site).
// It shows practice reminders sent by the server (Web Push) and opens the app when one is tapped.
// It also keeps the app's own files (the /app/ page, its script, styles and fonts) so the installed app
// opens without a connection. Those files hold no user data. Nothing else is cached: API, sign-in,
// OAuth and MCP requests, videos and everything else go straight to the network.

const BUILD = 'a94c1a953c'; // filled in by scripts/build.mjs; changes with every new version of the app files
const CACHE = `euno-app-${BUILD}`;
const SHELL = '/app/';
const HASHED = /^\/assets\/h\/[\w.-]+$/; // content-hashed files never change, so they're safe to keep

const cacheable = (res) => res && res.ok && res.type === 'basic' && !res.redirected;

// Keep the app page and what it loads. An install must never fail over this (push reminders matter
// more), so a missing network or a signed-out visitor (the page redirects to sign-in) just skips it.
async function precache() {
  try {
    const cache = await caches.open(CACHE);
    const page = await fetch(SHELL, { cache: 'reload', credentials: 'same-origin' });
    if (!cacheable(page)) return;
    const html = await page.clone().text();
    await cache.put(SHELL, page);
    const files = new Set();
    for (const m of html.matchAll(/(?:\.\.)?(\/assets\/h\/[\w.-]+)/g)) files.add(m[1]);
    for (const f of [...files]) {
      if (!f.endsWith('.css')) continue;
      const css = await (await fetch(f)).text(); // the fonts the styles name
      for (const m of css.matchAll(/url\((\/assets\/h\/[\w.-]+)\)/g)) files.add(m[1]);
    }
    await Promise.all([...files].map((f) => cache.add(f).catch(() => {})));
  } catch { /* offline or signed out: the next visit fills the cache */ }
}

self.addEventListener('install', (e) => { e.waitUntil(precache()); self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('euno-app-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' && (url.pathname === '/app' || url.pathname === '/app/' || url.pathname === '/app/index.html')) {
    // the page: the network when it can be reached (so a sign-in redirect or a new version comes through), else the kept copy
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (cacheable(res) && url.pathname === SHELL) (await caches.open(CACHE)).put(SHELL, res.clone());
        return res;
      } catch {
        const kept = await caches.match(SHELL, { cacheName: CACHE });
        if (kept) return kept;
        throw new Error('offline');
      }
    })());
  } else if (HASHED.test(url.pathname)) {
    e.respondWith((async () => {
      const kept = await caches.match(req, { cacheName: CACHE });
      if (kept) return kept;
      const res = await fetch(req);
      if (cacheable(res)) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
  }
});

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
