/**
 * Converzia Service Worker v2
 * Provides offline support and caching for PWA functionality
 * 
 * Fixed: Proper handling of redirected responses from Next.js auth
 */

const CACHE_VERSION = "v2";
const STATIC_CACHE = `converzia-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `converzia-dynamic-${CACHE_VERSION}`;

// Static assets to cache immediately
// NOTE: Do NOT cache pages that redirect (/, /login) - causes ERR_FAILED
const STATIC_ASSETS = [
  "/manifest.json",
];

// API routes to cache with network-first strategy
const API_CACHE_ROUTES = [
  "/api/portal/leads/stats",
  "/api/portal/funnel",
  "/api/tenants/credits",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker v2...");
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    }).catch((error) => {
      console.error("[SW] Failed to cache static assets:", error);
    })
  );
  
  // Force activation
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker v2...");
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete any cache that doesn't match current version
            return name.startsWith("converzia-") && 
                   name !== STATIC_CACHE && 
                   name !== DYNAMIC_CACHE;
          })
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Skip Supabase requests (they need fresh data)
  if (url.hostname.includes("supabase")) {
    return;
  }
  
  // Skip Next.js internal requests
  if (url.pathname.startsWith("/_next/")) {
    return;
  }
  
  // API requests - network first, cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Static assets (js, css, images) - cache first, network fallback
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }
  
  // Navigation requests (pages) - network only to avoid redirect issues
  // Falls back to offline page if network fails
  if (request.mode === "navigate") {
    event.respondWith(networkOnlyWithOfflineFallback(request));
    return;
  }
  
  // Other requests - just fetch normally
  return;
});

// Network-only strategy with offline fallback (for navigation/pages)
async function networkOnlyWithOfflineFallback(request) {
  try {
    // Always use redirect: follow for navigation requests
    const response = await fetch(request, { redirect: "follow" });
    return response;
  } catch (error) {
    console.log("[SW] Navigation failed, showing offline page");
    const offlinePage = await caches.match("/offline");
    if (offlinePage) {
      return offlinePage;
    }
    // Return a basic offline response if no cached offline page
    return new Response(
      `<!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sin conexión - Converzia</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0f1c; color: white; }
          .container { text-align: center; padding: 2rem; }
          h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
          p { color: #9ca3af; margin-bottom: 1.5rem; }
          button { background: #6366f1; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-size: 1rem; }
          button:hover { background: #4f46e5; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Sin conexión</h1>
          <p>No se pudo conectar al servidor. Verifica tu conexión a internet.</p>
          <button onclick="location.reload()">Reintentar</button>
        </div>
      </body>
      </html>`,
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}

// Cache-first strategy (for static assets like JS, CSS, images)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request, { redirect: "follow" });
    
    // Only cache successful, non-redirected responses
    if (networkResponse.ok && !networkResponse.redirected) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error("[SW] Cache-first fetch failed:", error);
    throw error;
  }
}

// Network-first strategy (for API calls)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful, non-redirected API responses
    if (networkResponse.ok && !networkResponse.redirected && shouldCacheApiResponse(request.url)) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log("[SW] Returning cached API response");
      return cachedResponse;
    }
    
    // Return JSON error for API requests
    return new Response(
      JSON.stringify({ error: "Offline", cached: false }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", 
    ".woff", ".woff2", ".ttf", ".eot", ".ico", ".webp"
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

// Check if API response should be cached
function shouldCacheApiResponse(url) {
  return API_CACHE_ROUTES.some((route) => url.includes(route));
}

// Push notification handling
self.addEventListener("push", (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || data.message,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/portal",
        ...data,
      },
      actions: data.actions || [
        { action: "view", title: "Ver" },
        { action: "dismiss", title: "Cerrar" },
      ],
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || "Converzia", options)
    );
  } catch (error) {
    console.error("[SW] Error handling push:", error);
  }
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  if (event.action === "dismiss") return;
  
  const url = event.notification.data?.url || "/portal";
  
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync for failed requests
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-leads") {
    event.waitUntil(syncLeads());
  }
});

async function syncLeads() {
  // Retry failed lead submissions when back online
  console.log("[SW] Syncing leads...");
  // Implementation would queue and retry failed API calls
}

console.log("[SW] Service worker v2 loaded");
