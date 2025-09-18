        if ("serviceWorker" in navigator) {
          navigator.serviceWorker
            .register("/OneSignalSDKWorker.js")
            .then((reg) => {
              console.log("[App] Service Worker registered successfully");
              reg.addEventListener("updatefound", () => {
                const newWorker = reg.installing;
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    const updateButton = document.createElement("button");
                    updateButton.textContent = "Update Tersedia! Klik untuk Reload";
                    updateButton.style.position = "fixed";
                    updateButton.style.bottom = "10px";
                    updateButton.style.right = "10px";
                    updateButton.style.padding = "10px 20px";
                    updateButton.style.backgroundColor = "#d0011b";
                    updateButton.style.color = "#fff";
                    updateButton.style.border = "none";
                    updateButton.style.borderRadius = "5px";
                    updateButton.style.cursor = "pointer";
                    updateButton.onclick = () => {
                      newWorker.postMessage({ action: "skipWaiting" });
                      document.body.removeChild(updateButton);
                    };
                    document.body.appendChild(updateButton);

                    if (window.confirm("Update tersedia! Reload halaman untuk menerapkannya?")) {
                      newWorker.postMessage({ action: "skipWaiting" });
                    }
                  }
                });
              });
            })
            .catch((err) => {
              console.error("[App] Service Worker registration failed:", err);
            });

          navigator.serviceWorker.addEventListener("controllerchange", () => {
            console.log("[App] Service Worker controller changed, reloading...");
            window.location.reload();
          });
        } else {
          console.warn("[App] Service Worker not supported in this browser");
        }
