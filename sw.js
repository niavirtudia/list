const CACHE_NAME = "pwa-cache-v5.0";
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
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.error("[SW] Failed to cache assets:", err);
        throw err;
      })
    )
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

// MESSAGE
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// FETCH WITH TIMEOUT
async function fetchWithTimeout(request, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// FETCH HANDLER
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isPrecached = PRECACHE_ASSETS.some((asset) => url.pathname === asset);
  const isGoogleFonts =
    url.href.startsWith("https://fonts.googleapis.com") ||
    url.href.startsWith("https://fonts.gstatic.com");

  // 🔹 1. Network-first untuk halaman HTML
  if (event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetchWithTimeout(event.request)
        .then((response) => {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // 🔹 2. Skip caching untuk Google Fonts (biar tidak error)
  if (isGoogleFonts) {
    event.respondWith(
      fetchWithTimeout(event.request).catch((err) => {
        console.warn("[SW] Google Fonts fetch failed:", url.href, err);
        return new Response("", { status: 404, statusText: "Font not found" });
      })
    );
    return;
  }

  // 🔹 3. POST request dengan background sync
  if (event.request.method === "POST") {
    event.respondWith(
      fetchWithTimeout(event.request).catch(async (err) => {
        console.error("[SW] POST request failed:", err);
        const requestClone = event.request.clone();
        const body = await requestClone.json();
        const cache = await caches.open("bg-sync-queue");
        await cache.put(event.request, new Response(JSON.stringify(body)));
        return new Response(JSON.stringify({ status: "queued" }), {
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // 🔹 4. Default: cache-first untuk aset (CSS, JS, images)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetchWithTimeout(event.request)
        .then((response) => {
          if (url.protocol === "https:" && event.request.method === "GET" && isPrecached) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          }
          return response;
        })
        .catch(async (err) => {
          console.error("[SW] Fetch failed:", url.href, err);
          const offlineFallback = await caches.match(OFFLINE_URL);
          return offlineFallback;
        });
    })
  );
});

// PUSH NOTIFICATIONS
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.warn("[SW] Push data bukan JSON valid", e);
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

// NOTIFICATION CLICK
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

// BACKGROUND SYNC
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
