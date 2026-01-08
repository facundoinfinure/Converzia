/**
 * Converzia Service Worker
 * Provides offline support and caching for PWA functionality
 */

const CACHE_NAME = "converzia-v1";
const STATIC_CACHE = "converzia-static-v1";
const DYNAMIC_CACHE = "converzia-dynamic-v1";

// Static assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/login",
  "/offline",
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
  console.log("[SW] Installing service worker...");
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  // Force activation
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
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
  
  // API requests - network first, cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Static assets - cache first, network fallback
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }
  
  // Pages - stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Cache-first strategy (for static assets)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      return caches.match("/offline");
    }
    throw error;
  }
}

// Network-first strategy (for API calls)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && shouldCacheApiResponse(request.url)) {
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

// Stale-while-revalidate (for pages)
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const cache = caches.open(DYNAMIC_CACHE);
      cache.then((c) => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(() => null);
  
  // Return cached response immediately, update in background
  if (cachedResponse) {
    fetchPromise; // Fire and forget
    return cachedResponse;
  }
  
  // No cache, wait for network
  const networkResponse = await fetchPromise;
  
  if (networkResponse) {
    return networkResponse;
  }
  
  // Network failed, return offline page
  if (request.mode === "navigate") {
    return caches.match("/offline");
  }
  
  throw new Error("Network unavailable");
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", 
    ".woff", ".woff2", ".ttf", ".eot", ".ico"
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
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
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

console.log("[SW] Service worker loaded");
