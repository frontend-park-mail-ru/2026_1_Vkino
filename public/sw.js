const CACHE_NAME = "vkino-offline-v1";
const APP_SHELL_URLS = ["/", "/index.html", "/img/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigateRequest(request));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (shouldCacheStaticAsset(request)) {
    event.respondWith(handleStaticRequest(request));
  }
});

async function handleNavigateRequest(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put("/index.html", response.clone());
    return response;
  } catch {
    return (
      (await caches.match("/index.html")) ||
      (await caches.match("/")) ||
      Response.error()
    );
  }
}

async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    return cachedResponse || Response.error();
  }
}

function shouldCacheStaticAsset(request) {
  return ["script", "style", "image", "font"].includes(request.destination);
}
