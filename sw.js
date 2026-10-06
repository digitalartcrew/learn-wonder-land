/* =============================================================
   WonderWorld — sw.js  (service worker)

   Makes the game work offline once it has been opened, so an
   "Add to Home Screen" copy behaves like a real app on a plane
   or a patchy connection.

   Strategy:
     • navigations  → network first, fall back to the cached page
                      (so a new deploy is picked up straight away)
     • static files → stale-while-revalidate
                      (instant load, quietly updated in the background)
     • /api/*       → never cached

   BUMP `VERSION` whenever you deploy. Old caches are deleted on
   activate, which is what makes updates reliable.
   ============================================================= */
const VERSION = 'ww-v1';
const SHELL = [
  './',
  'index.html',
  'privacy.html',
  'style.css',
  'game.js',
  'js/core.js',
  'js/art.js',
  'js/screens.js',
  'js/worlds/math.js',
  'js/worlds/story.js',
  'js/worlds/science.js',
  'js/worlds/city.js',
  'js/worlds/business.js',
  'assets/icon.svg',
  'assets/favicon-32.png',
  'assets/apple-touch-icon.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      /* addAll fails the whole install if one file 404s, so add individually */
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      /* never touch other origins */
  if (url.pathname.includes('/api/')) return;           /* signups always go to the network */

  /* Page loads: prefer the network so deploys land immediately */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  /* Everything else: serve from cache, refresh in the background */
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
