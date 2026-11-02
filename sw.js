/**
 * sw.js — offline service worker.
 *
 * Strategy: pre-cache the whole app shell on install, then answer every same-origin GET
 * stale-while-revalidate (cached copy immediately, refreshed in the background). The app makes no
 * cross-origin requests, so anything off-origin is ignored.
 *
 * IMPORTANT: bump CACHE whenever a file in SHELL changes, otherwise returning visitors keep the old
 * version until their second reload.
 */
const CACHE = 'cogarcade-v5';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './src/runtime.js',
  './src/engine.js',
  './src/games.js',
  './src/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return refresh.then(
        (res) => res || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()),
      );
    }),
  );
});
