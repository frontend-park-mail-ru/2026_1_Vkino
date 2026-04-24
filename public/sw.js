const CACHE_VERSION =
  new URL(self.location.href).searchParams.get("build") || "dev";
const CACHE_PREFIX = "vkino-offline";
const CACHE_NAMES = {
  shell: `${CACHE_PREFIX}-shell-${CACHE_VERSION}`,
  static: `${CACHE_PREFIX}-static-${CACHE_VERSION}`,
  api: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
};
const APP_SHELL_URLS = [
  "/index.html",
  "/img/logo.png",
  "/img/user-avatar.png",
  "/icons/logo.ico",
];
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font"]);
const API_TIMEOUT_MS = 8000;

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(cleanupOutdatedCaches());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (request.headers.has("range")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  const url = new URL(request.url);

  if (isMediaStreamRequest(request)) {
    return;
  }

  if (isCacheableApiRequest(request, url)) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  if (isCacheableStaticRequest(request, url)) {
    event.respondWith(handleStaticRequest(request, url));
  }
});

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAMES.shell);

  await Promise.allSettled(
    APP_SHELL_URLS.map(async (url) => {
      const response = await fetch(url, { cache: "no-store" });

      if (response.ok) {
        await cache.put(url, response.clone());
      }
    }),
  );
}

async function cleanupOutdatedCaches() {
  const expectedCaches = new Set(Object.values(CACHE_NAMES));
  const cacheKeys = await caches.keys();

  await Promise.all(
    cacheKeys
      .filter(
        (cacheKey) =>
          cacheKey.startsWith(CACHE_PREFIX) && !expectedCaches.has(cacheKey),
      )
      .map((cacheKey) => caches.delete(cacheKey)),
  );

  await self.clients.claim();
}

async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAMES.shell);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await Promise.allSettled([
        cache.put(request, response.clone()),
        cache.put("/index.html", response.clone()),
      ]);
      return response;
    }

    if (response.status >= 500) {
      const cachedResponse =
        (await cache.match(request)) || (await cache.match("/index.html"));

      if (cachedResponse) {
        return cachedResponse;
      }
    }

    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("/index.html")) ||
      createOfflineDocumentResponse()
    );
  }
}

async function handleStaticRequest(request, url) {
  const cache = await caches.open(CACHE_NAMES.static);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (shouldCacheStaticResponse(response)) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    if (request.destination === "image") {
      const imageFallback = await getImageFallbackResponse(url);

      if (imageFallback) {
        return imageFallback;
      }
    }

    return Response.error();
  }
}

async function handleApiRequest(request) {
  const cache = await caches.open(CACHE_NAMES.api);
  const cacheKey = request.url;
  const cachedResponse = await cache.match(cacheKey);

  try {
    const response = await fetchWithTimeout(request, API_TIMEOUT_MS);

    if (response.ok) {
      if (shouldCacheApiResponse(response)) {
        await cache.put(cacheKey, response.clone());
      }

      return response;
    }

    if (response.status >= 500 && cachedResponse) {
      return cachedResponse;
    }

    return response;
  } catch {
    return cachedResponse || createApiFallbackResponse();
  }
}

function isCacheableStaticRequest(request, url) {
  return (
    STATIC_DESTINATIONS.has(request.destination) &&
    isHttpRequest(url.protocol)
  );
}

function isCacheableApiRequest(request, url) {
  if (!isHttpRequest(url.protocol) || request.destination) {
    return false;
  }

  const acceptHeader = request.headers.get("accept") || "";

  if (!acceptHeader.includes("application/json")) {
    return false;
  }

  const pathSegments = getPathSegments(url);

  return (
    pathSegments.includes("movie") &&
    !pathSegments.includes("user") &&
    !pathSegments.includes("episode") &&
    !pathSegments.includes("auth")
  );
}

function isMediaStreamRequest(request) {
  return request.destination === "audio" || request.destination === "video";
}

function shouldCacheStaticResponse(response) {
  return (
    !hasNoStoreDirective(response) &&
    (response.ok || response.type === "opaque")
  );
}

function shouldCacheApiResponse(response) {
  return response.ok && !hasNoStoreDirective(response);
}

function hasNoStoreDirective(response) {
  const cacheControl = (response.headers.get("cache-control") || "")
    .toLowerCase()
    .trim();

  return cacheControl.includes("no-store");
}

function getPathSegments(url) {
  return url.pathname.toLowerCase().split("/").filter(Boolean);
}

function isHttpRequest(protocol) {
  return protocol === "http:" || protocol === "https:";
}

async function getImageFallbackResponse(url) {
  if (url.pathname.includes("avatar")) {
    return caches.match("/img/user-avatar.png");
  }

  return caches.match("/img/logo.png");
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestWithTimeout = new Request(request, {
      signal: controller.signal,
    });

    return await fetch(requestWithTimeout);
  } finally {
    clearTimeout(timeoutId);
  }
}

function createApiFallbackResponse() {
  return new Response(
    JSON.stringify({
      error:
        "Сервер временно недоступен, а подходящих данных в кеше для этого запроса нет",
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function createOfflineDocumentResponse() {
  return new Response(
    `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vkino</title>
  </head>
  <body>
    <main style="font-family: sans-serif; padding: 24px;">
      <h1>Vkino временно недоступен</h1>
      <p>Подключение к сети отсутствует, а локальная копия страницы ещё не была сохранена.</p>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
