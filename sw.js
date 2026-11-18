// Offline app shell for Harvest Notes. Same-origin GETs only;
// Firebase and CDN requests always go to the network.
//
// CACHE VERSION: bump this string on every deploy that changes the app
// shell, otherwise the cache-first fetch below keeps serving the old
// build forever. v2 (18 Nov 2026): network-first fetch so a new deploy
// reaches users on the next visit; cache is the offline fallback.
// v3 (18 Nov 2026): ui.js double-submit guard.
const CACHE = "harvest-notes-v3";
const SHELL = [
  "./",
  "./index.html",
  "./src/styles.css",
  "./src/main.js",
  "./src/config.js",
  "./src/router.js",
  "./src/ai.js",
  "./src/firebase.js",
  "./src/notes.js",
  "./src/ui.js",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== location.origin) return;
  // Network-first: a new deploy reaches the user on the next visit
  // instead of being shadowed by the old cache (the v1 bug, 18 Nov 2026).
  // Offline, the cache answers. Successful network responses refresh it.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});
