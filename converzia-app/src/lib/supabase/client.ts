"use client";

import { createBrowserClient } from "@supabase/ssr";

// ============================================
// Supabase Browser Client
// Uses publishable key (sb_publishable_*) or legacy anon key
// Safe to expose in browser - respects RLS policies
// See: https://supabase.com/docs/guides/api/api-keys
// ============================================

// Publishable key - supports both new and legacy formats
const getPublishableKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // Reuse the same client instance to avoid creating multiple clients
  if (clientInstance) {
    return clientInstance;
  }

  clientInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getPublishableKey()!
  ) as any;

  return clientInstance;
}

