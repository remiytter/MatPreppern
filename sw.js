const CACHE_NAME = "matpreppern-v13";
const SUPABASE_LIBRARY_URL =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";

const APP_SHELL = [
  "./",
  "./index.html",
  "./planner.html",
  "./account.html",
  "./add-recipe.html",
  "./community-notes.html",
  "./reports.html",
  "./recipe.html",
  "./profile.html",
  "./legal.html",
  "./offline.html",
  "./css/style.css",
  "./js/index.js",
  "./js/planner.js",
  "./js/account.js",
  "./js/add-recipe.js",
  "./js/community-notes.js",
  "./js/reports.js",
  "./js/auth-nav.js",
  "./js/recipe-page.js",
  "./js/recipe-utils.js",
  "./js/profile.js",
  "./js/pwa.js",
  "./js/supabase.js",
  "./js/supabase-config.js",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  SUPABASE_LIBRARY_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isAppAsset = requestUrl.origin === self.location.origin;
  const isPinnedDependency = event.request.url === SUPABASE_LIBRARY_URL;

  if (!isAppAsset && !isPinnedDependency) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || caches.match("./offline.html"))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cachedResponse) => {
    const networkResponse = fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => cachedResponse || Response.error());
    return cachedResponse || networkResponse;
  }));
});
