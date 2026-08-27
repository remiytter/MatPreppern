function createUpdateBanner(registration) {
  if (document.querySelector("#appUpdateBanner")) return;
  const banner = document.createElement("aside");
  banner.id = "appUpdateBanner";
  banner.className = "app-update-banner";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.innerHTML = `
    <p><strong>En ny versjon er klar.</strong> Oppdater for å få de siste forbedringene.</p>
    <div class="item-actions">
      <button class="primary-button" type="button" data-apply-update>Oppdater nå</button>
      <button class="secondary-button" type="button" data-dismiss-update>Senere</button>
    </div>`;
  banner.querySelector("[data-apply-update]").addEventListener("click", () => {
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  });
  banner.querySelector("[data-dismiss-update]").addEventListener("click", () => banner.remove());
  document.body.appendChild(banner);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
  let isRefreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isRefreshing) return;
    isRefreshing = true;
    window.location.reload();
  });

  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    if (registration.waiting && navigator.serviceWorker.controller) createUpdateBanner(registration);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          createUpdateBanner(registration);
        }
      });
    });
  } catch (error) {
    console.error("Kunne ikke aktivere offline-støtte:", error);
  }
}

registerServiceWorker();
