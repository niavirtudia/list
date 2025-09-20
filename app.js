if ("serviceWorker" in navigator) {
  // Register OneSignal SDK worker (untuk push notif)
  navigator.serviceWorker
    .register("/OneSignalSDKWorker.js")
    .then(() => console.log("[App] OneSignal SW registered"))
    .catch((err) => console.error("[App] OneSignal SW failed:", err));

  // Register PWA SW (untuk offline, cache, sync)
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      console.log("[App] PWA SW registered");

      // Update found handler
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // Buat tombol update
            const updateButton = document.createElement("button");
            updateButton.textContent = "Reload";
            updateButton.style.position = "fixed";
            updateButton.style.bottom = "10px";
            updateButton.style.right = "10px";
            updateButton.style.padding = "10px 20px";
            updateButton.style.backgroundColor = "#d0011b";
            updateButton.style.color = "#fff";
            updateButton.style.border = "none";
            updateButton.style.borderRadius = "5px";
            updateButton.style.cursor = "pointer";

            // Klik = trigger skipWaiting di SW
            updateButton.onclick = () => {
              newWorker.postMessage({ type: "SKIP_WAITING" });
              document.body.removeChild(updateButton);
            };

            document.body.appendChild(updateButton);
          }
        });
      });
    })
    .catch((err) => console.error("[App] PWA SW failed:", err));

  // Reload saat SW update aktif
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    console.log("[App] SW controller changed, reloading...");
    window.location.reload();
  });
} else {
  console.warn("[App] Service Worker not supported in this browser");
}
