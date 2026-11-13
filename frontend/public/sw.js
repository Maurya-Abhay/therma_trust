/* ThermaTrust service worker.
 *
 * Gives the app a shell that opens offline and last-known data for reads.
 * It deliberately never touches writes (POST/PATCH/...): those go through the
 * in-app outbox, which can tell the user what is waiting and handle conflicts.
 *
 * Cached API responses are per-device, not per-user, so the page deletes the
 * `thermatrust-api-*` caches whenever tokens are cleared (logout / expiry).
 */
const VERSION = "v9";
const SHELL_CACHE = `thermatrust-shell-${VERSION}`;
const API_CACHE = `thermatrust-api-${VERSION}`;
const FONT_CACHE = `thermatrust-fonts-${VERSION}`;
const CURRENT = [SHELL_CACHE, API_CACHE, FONT_CACHE];

// Signed-in screens are all served by one Next.js route whose HTML is identical
// whatever the URL, so a single cached copy opens any of them offline. Any
// path that is not one of the public pages below falls under it.
const SHELL_KEY = "/app-shell";
const isPublicPage = (pathname) =>
  pathname === "/" ||
  pathname === "/login" ||
  pathname === "/register" ||
  pathname === "/forgot-password" ||
  pathname === "/reset-password" ||
  pathname.startsWith("/verify/");

self.addEventListener("install", (event) => {
  // Pre-caching is best effort: if storage is unavailable the worker should
  // still install and simply run without an offline shell.
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(["/", SHELL_KEY, "/manifest.webmanifest", "/icon-192.png"]))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("thermatrust-") && !CURRENT.includes(key)).map((key) => caches.delete(key)))
      )
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    // Public pages must always be live (a cached "valid passport" would defeat
    // the point), the health check must reflect the server right now, and CSV
    // exports are one-off downloads.
    if (url.pathname.startsWith("/api/public/") || url.pathname === "/api/health/" || url.pathname.endsWith("/export/")) return;
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|webmanifest|ico|woff2?)$/.test(url.pathname)) {
      event.respondWith(cacheFirst(request, SHELL_CACHE));
    }
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
  }
});

// Cache Storage can fail on real devices (quota full, private browsing, a
// corrupted store). The cache is a bonus: it must never be able to stop a
// request that the network could have answered, so the network goes first and
// every cache operation is wrapped so its failure is swallowed.
function remember(cacheName, key, response) {
  caches
    .open(cacheName)
    .then((cache) => cache.put(key, response))
    .catch(() => {});
}

async function recall(cacheName, key, options) {
  try {
    const cache = await caches.open(cacheName);
    return await cache.match(key, options);
  } catch {
    return undefined;
  }
}

// Answers served from the cache are tagged so the app can tell "this is the
// last copy we have" from "this is live" and say so, instead of showing stale
// data as if it were current.
function fromCache(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Served-From-Cache", "1");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Always prefer the live server; fall back to the last good copy only when the
// network itself fails. HTTP errors (401, 500, ...) pass straight through.
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) remember(cacheName, request, response.clone());
    // 502/503/504 means a gateway is up but the app behind it isn't (a sleeping
    // or restarting host) - same situation as being offline, so use the last good copy.
    if (response.status >= 502 && response.status <= 504) {
      const cached = await recall(cacheName, request, { ignoreVary: true });
      if (cached) return fromCache(cached);
    }
    return response;
  } catch (error) {
    const cached = await recall(cacheName, request, { ignoreVary: true });
    if (cached) return fromCache(cached);
    throw error;
  }
}

// Public pages are kept per URL (so the landing page opens offline); every
// other path is a signed-in screen and shares the one cached app shell.
// The verification page is never served from cache: a stale "valid" would
// defeat its purpose.
async function navigate(request) {
  const pathname = new URL(request.url).pathname;
  const key = isPublicPage(pathname) ? pathname : SHELL_KEY;
  try {
    const response = await fetch(request);
    if (response.ok && !pathname.startsWith("/verify/")) remember(SHELL_CACHE, key, response.clone());
    return response;
  } catch (error) {
    if (pathname.startsWith("/verify/")) throw error;
    const cached = await recall(SHELL_CACHE, key, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

// Build output under /_next/static/ is content-hashed, so a cached copy never goes stale.
async function cacheFirst(request, cacheName) {
  const cached = await recall(cacheName, request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) remember(cacheName, request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await recall(cacheName, request);
  const refresh = fetch(request).then((response) => {
    if (response.ok || response.type === "opaque") remember(cacheName, request, response.clone());
    return response;
  });
  if (cached) {
    refresh.catch(() => {}); // background refresh; offline is fine when we already have a copy
    return cached;
  }
  return refresh;
}

// ---- push alerts ------------------------------------------------------------
// The server sends a small JSON payload ({ title, body, url, kind, id }) for
// each new notification. If the app is open and in view the in-app bell is
// already the right place, so just tell it to refresh instead of also raising
// an OS notification on top of it.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ThermaTrust", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const visible = windows.some((client) => client.visibilityState === "visible");
      if (visible) {
        windows.forEach((client) => client.postMessage({ type: "notifications-changed" }));
        return undefined;
      }
      return self.registration.showNotification(data.title || "ThermaTrust", {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/badge-96.png",
        tag: data.id ? `tt-${data.id}` : undefined,
        data: { url: data.url || "/" },
      });
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Reuse an open tab when there is one rather than stacking a new window.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((focused) => ("navigate" in focused ? focused.navigate(target) : undefined));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
