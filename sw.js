const CACHE_NAME = "pwa-cache-v3.2";
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

// INSTALL
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

// ACTIVATE
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// FETCH handler
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Fungsi untuk memeriksa skema yang didukung
  const isCacheableRequest = (url) => {
    return url.startsWith("http://") || url.startsWith("https://");
  };

  // Strategy: Network first untuk HTML
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (isCacheableRequest(request.url) && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => {
              console.log(`[SW] Caching: ${request.url}`);
              cache.put(request, clone).catch((err) => {
                console.error(`[SW] Cache put failed for ${request.url}:`, err);
              });
            });
          }
          return resp;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Strategy: Cache first untuk aset statis
  if (request.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((resp) =>
        resp ||
        fetch(request).then((netResp) => {
          if (isCacheableRequest(request.url) && netResp.ok) {
            const clone = netResp.clone();
            caches.open(CACHE_NAME).then((cache) => {
              console.log(`[SW] Caching: ${request.url}`);
              cache.put(request, clone).catch((err) => {
                console.error(`[SW] Cache put failed for ${request.url}:`, err);
              });
            });
          }
          return netResp;
        })
      )
    );
    return;
  }

  // Default: network fallback to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// SYNC (untuk background sync data offline)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-post-data") {
    event.waitUntil(syncQueuedRequests());
  }
});

async function syncQueuedRequests() {
  const queue = await caches.open("bg-sync-queue");
  const keys = await queue.keys();
  for (const request of keys) {
    const response = await queue.match(request);
    const body = await response.json();
    try {
      await fetch(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await queue.delete(request);
    } catch (err) {
      console.error("[SW] Sync failed:", err);
    }
  }
}

// MESSAGE handler sederhana
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    console.log("[SW] Skip waiting triggered via message");
  } else {
    console.log("[SW] Message received:", event.data);
  }
});
