/* ===========================================================================
 * Service worker — network-first so an installed (Add-to-Home-Screen) app on
 * iOS/Android always shows the latest deploy when online, while still working
 * offline from the last cached copy. Without this, iOS standalone apps pin a
 * stale snapshot of index.html and the in-app pull-to-refresh just reloads the
 * same cached page.
 *
 * Strategy:
 *   - Same-origin GET (our HTML/JS/CSS): try the network, cache a copy, and
 *     fall back to cache only when offline. Updates therefore land immediately.
 *   - Cross-origin (Openverse photos, OSM tiles, Open-Meteo, fonts, Leaflet):
 *     not intercepted — the browser handles them as usual.
 * Bump VERSION when you want to drop old caches on activate.
 * ========================================================================== */
const VERSION = "v20260702";
const CACHE = "asia-trip-" + VERSION;

self.addEventListener("install", (e) => {
  self.skipWaiting(); // a new SW takes over without waiting for old tabs to close
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html"]).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("asia-trip-") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim(); // control already-open pages right away
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin requests alone
  e.respondWith((async () => {
    try {
      const fresh = await fetch(req); // network-first: always prefer the latest
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch {
      const cached = await caches.match(req);
      return cached || caches.match("./index.html"); // offline fallback to the app shell
    }
  })());
});

// Let the page trigger an immediate cache wipe (used by pull-to-refresh).
self.addEventListener("message", (e) => {
  if (e.data === "clear-caches") {
    e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
  }
});
