/* Astra service worker: caches only the app shell. Live data (news, rates, AI, images) is never cached or faked.
   3.1.0: same-origin requests bypass the HTTP cache (cache:'no-cache' → always revalidated), a new worker activates at once,
   and old shell caches are deleted, so the app can never get stuck on an old version. */
const CACHE = 'astra-shell-3.1.0';
const SHELL = ['./', 'index.html', 'app.css', 'astra.css', 'icons/astra-mark.svg', 'icons/astra-mascot.svg', 'core.js', 'tools.js', 'app.js', 'update.js',
  'reel/reel-core.js', 'reel/reel.js', 'reel/reel.css', 'builder/builder-core.js', 'builder/builder.js',
  'scan/pdfwriter.js', 'scan/scanstore.js', 'scan/lookup.js', 'scan/scanpdf.js', 'scan/zxing.min.js', 'VERSION', 'manifest.webmanifest', 'apple-touch-icon.png',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon-64.png', 'icons/icon-32.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((r) => (r.ok ? c.put(u, r) : null)).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;   // cross-origin live APIs go straight to the network
  if (/\/(VERSION|version\.json)$/.test(u.pathname) || u.pathname.includes('/extensions/')) {          // version + extension lists: always live
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || new Response('', { status: 504 }))));
    return;
  }
  // network-first (revalidated past the HTTP cache) so updates show up at once; fall back to the cached shell when offline
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => {
    if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || (e.request.mode === 'navigate' ? caches.match('index.html') : new Response('', { status: 504 })))));
});
