import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Using 'any' to bypass strict type checking for tables not in Database types
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as any;
}

