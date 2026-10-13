// KMI service worker — offline APP SHELL only. API calls (Supabase, other origins) are never
// intercepted or cached: no stale business data, and no queued writes (a write either reaches
// the server, which is idempotent via client_request_id, or the user sees it failed).
const CACHE = 'kmi-shell-v2';
// './' is not precached: a static host may not map the directory to index.html, and one failed
// entry rejects the whole install. Navigations fall back to index.html instead.
const PRECACHE = ['./index.html', './manifest.webmanifest', './icon.svg', './assets/kurutlu-k-symbol.png', './assets/kurutlu-k-symbol-white.png', './assets/favicon-32.png', './assets/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // network only
  // Release 005: even when the API is served from the SAME origin (reverse proxy / local test shim) business data must never be cached or served stale offline.
  if (/\/(rest|auth|functions|storage|realtime)\/v1\//.test(url.pathname)) return;
  // network first (fresh code when online), cache fallback (shell works offline)
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
