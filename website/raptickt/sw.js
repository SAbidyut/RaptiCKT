// RaptiCKT offline cache. A new build changes VERSION, so visitors get the update
// on their next visit and old caches are removed.
const VERSION = 'raptickt-5b3fa7da3d';
const FILES = ["./","index.html","css/styles.css?v=5b3fa7da3d","js/app.js?v=5b3fa7da3d","js/boot.js","manifest.webmanifest","assets/apple-touch-icon.png","assets/icon-192.png","assets/icon-512.png","assets/icon.svg"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('raptickt-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // the page: fresh from the network when online, the cached copy when offline
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(VERSION).then((cc) => cc.put(req, c)); return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
