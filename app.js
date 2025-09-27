if ("serviceWorker" in navigator) {
  // Register OneSignal SDK worker
  navigator.serviceWorker
    .register("/OneSignalSDKWorker.js", { scope: "/onesignal/" }) // Adjust scope if possible
    .then(() => console.log("[App] OneSignal SW registered"))
    .catch((err) => console.error("[App] OneSignal SW failed:", err));

  // Register PWA SW
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((reg) => {
      console.log("[App] PWA SW registered");

      // Update found handler
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            if (!document.querySelector("#update-button")) {
              const updateButton = document.createElement("button");
              updateButton.id = "update-button";
              updateButton.textContent = "Reload";
              updateButton.style.position = "fixed";
              updateButton.style.bottom = "10px";
              updateButton.style.right = "10px";
              updateButton.style.padding = "10px 20px";
              updateButton.style.backgroundColor = "#d0011b";
              updateButton.style.fontSize = "16px";
              updateButton.style.color = "#fff";
              updateButton.style.border = "none";
              updateButton.style.borderRadius = "5px";
              updateButton.style.cursor = "pointer";

              updateButton.onclick = () => {
                newWorker.postMessage({ type: "SKIP_WAITING" });
                document.body.removeChild(updateButton);
              };

              document.body.appendChild(updateButton);
            }
          }
        });
      });
    })
    .catch((err) => console.error("[App] PWA SW failed:", err));

  // Log controller change instead of reloading
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    console.log("[App] SW controller changed. New version activated.");
  });
} else {
  console.warn("[App] Service Worker not supported in this browser");
}
