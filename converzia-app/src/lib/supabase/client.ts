"use client";

import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/database";

// ============================================
// Supabase Browser Client
// Uses publishable key (sb_publishable_*) or legacy anon key
// Safe to expose in browser - respects RLS policies
// Properly configured to handle cookies for session management
// See: https://supabase.com/docs/guides/api/api-keys
// ============================================

// Publishable key - supports both new and legacy formats
const getPublishableKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Using ReturnType to get the correct type from createBrowserClient
type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;
let clientInstance: BrowserClient | null = null;

export function createClient(): BrowserClient {
  // Reuse the same client instance to avoid creating multiple clients
  if (clientInstance) {
    return clientInstance;
  }

  // Create client with proper cookie handling
  const newClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getPublishableKey()!,
    {
      cookies: {
        getAll() {
          // Read cookies from document.cookie
          if (typeof document === "undefined") return [];
          return document.cookie.split("; ").map((cookie) => {
            const [name, ...rest] = cookie.split("=");
            return { name, value: decodeURIComponent(rest.join("=")) };
          });
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          // Write cookies to document.cookie
          if (typeof document === "undefined") return;
          cookiesToSet.forEach(({ name, value, options }) => {
            let cookieString = `${name}=${encodeURIComponent(value)}`;
            
            if (options) {
              if (options.path) cookieString += `; path=${options.path}`;
              if (options.domain) cookieString += `; domain=${options.domain}`;
              if (options.maxAge) cookieString += `; max-age=${options.maxAge}`;
              if (options.expires) cookieString += `; expires=${new Date(options.expires).toUTCString()}`;
              if (options.httpOnly) cookieString += `; HttpOnly`;
              if (options.secure) cookieString += `; Secure`;
              if (options.sameSite) {
                cookieString += `; SameSite=${options.sameSite}`;
              }
            }
            
            document.cookie = cookieString;
          });
        },
      },
    }
  );

  clientInstance = newClient as BrowserClient;
  return newClient as BrowserClient;
}

