const CACHE_NAME = "pwa-cache-v3.3";
const OFFLINE_URL = "/offline.html";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/app.js",
  "/manifest.json",
  "/icon/app-icon-192.png",
  "/icon/app-icon-512.png"
];

// Install → cache aset dasar
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting(); // auto update langsung aktif
});

// Activate → bersihkan cache lama
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener("fetch", event => {
  const request = event.request;

  // HTML → network first (update terbaru)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(resp => {
          caches.open(CACHE_NAME).then(cache => cache.put(request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(request).then(r => r || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Aset statis → cache first
  if (request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(resp =>
        resp ||
        fetch(request).then(netResp => {
          if (netResp.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, netResp.clone()));
          }
          return netResp;
        })
      )
    );
    return;
  }

  // Default → network dengan fallback cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
