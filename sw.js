const CACHE_PREFIX = "mahami-app-v2-";
const CACHE_NAME = `${CACHE_PREFIX}shell`;
const APP_FILES = [
  new URL("./", self.registration.scope).href,
  new URL("./index.html", self.registration.scope).href,
  new URL("./manifest.json", self.registration.scope).href,
  new URL("./icons/icon-192.png", self.registration.scope).href,
  new URL("./icons/icon-512.png", self.registration.scope).href
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const requestURL = new URL(request.url);
  const appScope = new URL(self.registration.scope);

  if (
    request.method !== "GET" ||
    requestURL.origin !== self.location.origin ||
    !requestURL.pathname.startsWith(appScope.pathname)
  ) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (request.mode === "navigate") {
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return cached || await cache.match(APP_FILES[1]) || Response.error();
      }
    }

    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return new Response("هذا المورد غير متاح دون اتصال بالإنترنت.", {
        status: 503,
        statusText: "Offline"
      });
    }
  })());
});
