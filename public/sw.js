// Offline-first app shell. Bump VERSION when files are added to / removed from SHELL.
const VERSION = 'mathmind-v10';
const SHELL = [
  './',
  'css/style.css',
  'js/app.js',
  'js/state.js',
  'js/util.js',
  'js/mascot.js',
  'js/nav.js',
  'js/game.js',
  'js/pwa.js',
  'js/views/home.js',
  'js/views/learn.js',
  'js/views/progress.js',
  'js/views/awards.js',
  'js/views/settings.js',
  'js/views/summary.js',
  'js/engine.js',
  'js/lessons.js',
  'js/store.js',
  'js/progress.js',
  'js/fx.js',
  'js/i18n.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'fonts/mali-500.woff2',
  'fonts/mali-600.woff2',
  'fonts/mali-700.woff2',
  'fonts/mplus-rounded-ja.woff2',
  'fonts/nunito.woff2',
  'img/awards.webp',
  'img/mascot.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: answer instantly from cache (works offline) and refresh the cache in the
// background, so edits show up on the next load without having to bump VERSION.
// Bump VERSION only when files are added or removed from SHELL.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const refresh = fetch(req)
        .then((res) => {
          // never cache redirects: a redirected response can't answer a navigation
          if (res.ok && !res.redirected) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (hit) {
        event.waitUntil(refresh);
        return hit;
      }
      return (await refresh) || (req.mode === 'navigate' ? cache.match('./') : Response.error());
    }),
  );
});

// Update check, requested by pwa.js on launch and whenever the app returns to the foreground.
// Revalidates the whole shell, and only if every file came back does it swap them in together
// (no mix of old and new modules). Tells the page when anything changed so it can offer a reload.
self.addEventListener('message', (event) => {
  if (event.data !== 'check-update') return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const urls = SHELL.map((p) => new URL(p, self.registration.scope).href);
      const fresh = await Promise.all(urls.map((u) => fetch(u, { cache: 'no-cache' }).catch(() => null)));
      if (fresh.some((r) => !r || !r.ok || r.redirected)) return;
      let changed = false;
      for (let i = 0; i < urls.length; i++) {
        const old = await cache.match(urls[i]);
        const tag = fresh[i].headers.get('etag');
        if (!old || !tag || old.headers.get('etag') !== tag) changed = true;
      }
      if (!changed) return;
      await Promise.all(urls.map((u, i) => cache.put(u, fresh[i])));
      event.source?.postMessage('updated');
    })(),
  );
});
