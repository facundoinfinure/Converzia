import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// ============================================
// Supabase API Keys Configuration
// Supports both new (sb_publishable_, sb_secret_) and legacy (anon, service_role) keys
// See: https://supabase.com/docs/guides/api/api-keys
// ============================================

// Publishable key (client-safe) - new format or legacy anon key
const getPublishableKey = () => 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Secret key (server-only) - new format or legacy service_role key
const getSecretKey = () => 
  process.env.SUPABASE_SECRET_KEY || 
  process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Creates a Supabase client for authenticated user operations.
 * Uses the publishable key which respects RLS policies.
 * Safe for Server Components and Route Handlers with user context.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getPublishableKey()!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in Server Components
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase admin client with elevated privileges.
 * IMPORTANT: Only use in secure server-side code (API routes, webhooks, crons).
 * This client bypasses RLS - never expose to client-side code.
 * 
 * Uses secret key (sb_secret_*) or legacy service_role key.
 * See: https://supabase.com/docs/guides/api/api-keys#service_role-and-secret-keys
 */
export function createAdminClient() {
  const secretKey = getSecretKey();
  
  if (!secretKey) {
    throw new Error(
      "Missing Supabase secret key. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}

