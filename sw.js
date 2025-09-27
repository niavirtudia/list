const CACHE_NAME = "pwa-cache-v3.5";
const OFFLINE_URL = "/offline.html";

// File yang akan di-cache saat install
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/app.js",
  "/manifest.json",
  "/icon/app-icon-192.png",
  "/icon/app-icon-512.png"
];

// Install Service Worker → caching awal
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting(); // langsung aktif tanpa nunggu reload
});

// Activate Service Worker → hapus cache lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim(); // langsung kontrol semua tab
});

// Fetch handler → network first, fallback ke cache/offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Simpan salinan response ke cache
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, copy);
        });
        return response;
      })
      .catch(() => {
        // Kalau offline → cek cache dulu
        return caches.match(event.request).then((cached) => {
          return cached || caches.match(OFFLINE_URL);
        });
      })
  );
});
