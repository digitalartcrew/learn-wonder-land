/* =============================================================
   WonderWorld — sw.js  (service worker)

   Makes the game work offline once it has been opened, so an
   "Add to Home Screen" copy behaves like a real app on a plane
   or a patchy connection.

   Two Cloudflare Pages specifics are baked in here:

   1. Pages 308-redirects /index.html -> / and /privacy.html ->
      /privacy. A cached *redirected* response can never satisfy a
      navigation (those use redirect mode "manual"), so caching
      "index.html" would silently break offline launch. We cache the
      canonical URLs instead, and refuse to store any redirected
      response.

   2. The files are not content-hashed (there is no build step), so
      HTML and code must not fall out of sync. Navigations AND
      .js/.css are network-first; _headers already serves them with
      `max-age=0, must-revalidate`, so the round-trip is usually a
      cheap 304 and a deploy can never leave new HTML calling into
      old JavaScript.

   BUMP `VERSION` on every deploy. Old caches are deleted on
   activate, which is what makes updates reliable.
   ============================================================= */
const VERSION = 'ww-v4';

/* Canonical URLs only — no .html suffixes that Pages would redirect. */
const SHELL = [
  './',
  'privacy',
  'terms',
  'style.css',
  'game.js',
  'js/core.js',
  'js/env.js',
  'js/events.js',
  'js/entitlements.js',
  'js/billing.js',
  'js/profiles.js',
  'js/sync.js',
  'js/parentgate.js',
  'js/art.js',
  'js/screens.js',
  'js/plus.js',
  'js/devtools.js',
  'js/worlds/math.js',
  'js/worlds/story.js',
  'js/worlds/science.js',
  'js/worlds/city.js',
  'js/worlds/business.js',
  'js/tutor/languages.js',
  'js/tutor/taxonomy.js',
  'js/tutor/profile.js',
  'js/tutor/content.js',
  'js/tutor/safety.js',
  'js/tutor/emotion.js',
  'js/tutor/avatar.js',
  'js/tutor/voice.js',
  'js/tutor/provider.js',
  'js/tutor/assessment.js',
  'js/tutor/engine.js',
  'js/tutor/session.js',
  'js/tutor/screen.js',
  'assets/icon.svg',
  'assets/favicon-32.png',
  'assets/apple-touch-icon.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-512-maskable.png',
  'assets/manifest.webmanifest'
];

const CODE = /\.(?:js|css)$/;

/* Never store a redirect, an error page, or an opaque cross-origin response */
function cacheable(res) {
  return res && res.ok && !res.redirected && res.type === 'basic';
}

function put(req, res) {
  if (!cacheable(res)) return;
  const copy = res.clone();
  caches.open(VERSION).then((c) => c.put(req, copy));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      /* Added one at a time: addAll fails the entire install if a single
         entry 404s, and 'privacy' only exists once deployed to Pages. */
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

  /* Page loads and code: network first, so a deploy lands immediately and
     HTML can never be newer than the JavaScript it depends on. */
  if (req.mode === 'navigate' || CODE.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => { put(req, res); return res; })
        .catch(() => caches.match(req).then(
          (hit) => hit || (req.mode === 'navigate' ? caches.match('./') : undefined)
        ))
    );
    return;
  }

  /* Icons, the manifest, anything else: instant from cache, refreshed quietly */
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => { put(req, res); return res; })
        .catch(() => hit);
      return hit || network;
    })
  );
});
