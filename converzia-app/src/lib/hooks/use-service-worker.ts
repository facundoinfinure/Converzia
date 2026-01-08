"use client";

import { useEffect, useState } from "react";

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  registration: ServiceWorkerRegistration | null;
  error: string | null;
}

/**
 * Hook to manage service worker registration and status
 */
export function useServiceWorker(): ServiceWorkerState {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isOnline: true,
    registration: null,
    error: null,
  });

  useEffect(() => {
    // Check if service workers are supported
    const isSupported = "serviceWorker" in navigator;
    setState((prev) => ({
      ...prev,
      isSupported,
      isOnline: navigator.onLine,
    }));

    if (!isSupported) {
      return;
    }

    // Register service worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.log("[PWA] Service worker registered:", registration.scope);

        setState((prev) => ({
          ...prev,
          isRegistered: true,
          registration,
        }));

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New version available
                console.log("[PWA] New version available");
                // Could show a toast notification here
              }
            });
          }
        });
      } catch (error) {
        console.error("[PWA] Service worker registration failed:", error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Registration failed",
        }));
      }
    };

    registerSW();

    // Handle online/offline events
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return state;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!("Notification" in window)) {
    console.warn("[PWA] Notifications not supported");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    console.log("[PWA] Notification permission:", permission);
    return permission;
  } catch (error) {
    console.error("[PWA] Error requesting notification permission:", error);
    return null;
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  try {
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    console.log("[PWA] Push subscription:", subscription.endpoint);
    return subscription;
  } catch (error) {
    console.error("[PWA] Error subscribing to push:", error);
    return null;
  }
}

/**
 * Convert base64 to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
