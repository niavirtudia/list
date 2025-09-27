const CACHE_NAME = "pwa-cache-v4";
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
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

// MESSAGE handler for SKIP_WAITING
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// FETCH handler
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isPrecached = PRECACHE_ASSETS.some((asset) => url.pathname === asset);

  if (event.request.method === "POST") {
    event.respondWith(
      fetch(event.request)
        .catch(async (err) => {
          const requestClone = event.request.clone();
          const body = await requestClone.json();
          const cache = await caches.open("bg-sync-queue");
          await cache.put(event.request, new Response(JSON.stringify(body)));
          return new Response(JSON.stringify({ status: "queued" }));
        })
    );
  } else {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (url.protocol === "https:" && event.request.method === "GET" && isPrecached) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, respClone);
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((resp) => resp || caches.match(OFFLINE_URL))
        )
    );
  }
});

// PUSH handler
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.warn("Push data bukan JSON valid", e);
  }

  const title = data.title || "Notifikasi Baru";
  const options = {
    body: data.body || "Kamu punya pesan baru!",
    icon: "/icon/app-icon-192.png",
    badge: "/icon/app-icon-192.png",
    tag: "general-push",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// NOTIFICATION CLICK handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// SYNC handler
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
