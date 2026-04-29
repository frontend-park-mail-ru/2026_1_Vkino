const SERVICE_WORKER_PATH = "/sw.js";

/**
 * Регистрирует service worker после загрузки страницы.
 * Использует versioned URL, чтобы браузер гарантированно подхватывал новый worker после деплоя.
 */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const buildId = String(import.meta.env.VITE_APP_BUILD_ID || "dev").trim();
  const serviceWorkerUrl = buildId
    ? `${SERVICE_WORKER_PATH}?build=${encodeURIComponent(buildId)}`
    : SERVICE_WORKER_PATH;

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        serviceWorkerUrl,
        {
          scope: "/",
          updateViaCache: "none",
        },
      );

      setupServiceWorkerUpdates(registration);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Не удалось зарегистрировать service worker", error);
      }
    }
  };

  if (document.readyState === "complete") {
    void register();
    return;
  }

  window.addEventListener("load", () => void register(), { once: true });
}

function setupServiceWorkerUpdates(
  registration: ServiceWorkerRegistration,
): void {
  const checkForUpdates = () => {
    void registration.update().catch(() => {});
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForUpdates();
    }
  });

  window.addEventListener("online", checkForUpdates);
}
