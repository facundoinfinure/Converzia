import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import type { Database } from "@/types/database";

// Publishable key - supports both new and legacy formats
const getPublishableKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const cookieStore = await cookies();
    
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getPublishableKey()!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
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

    // Exchange code for session
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !user) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // Check if user profile exists
    const { data: profileData } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("id, is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "get user profile in callback"
    );
    
    const profile = profileData as { id: string; is_converzia_admin: boolean } | null;

    // If profile doesn't exist, create it
    if (!profile) {
      const { error: profileError } = await queryWithTimeout(
        supabase
          .from("user_profiles")
          .insert({
            id: user.id,
            email: user.email || "",
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          }),
        10000,
        "create user profile in callback"
      );

      if (profileError) {
        console.error("Error creating profile:", profileError);
      }

      // New user - redirect to register to complete business info
      return NextResponse.redirect(`${origin}/register`);
    }

    // Check if user is Converzia admin
    if (profile.is_converzia_admin) {
      return NextResponse.redirect(`${origin}/admin`);
    }

    // Check for active tenant memberships
    const { data: memberships } = await queryWithTimeout(
      supabase
        .from("tenant_members")
        .select("id, status")
        .eq("user_id", user.id),
      10000,
      "get tenant memberships in callback"
    ) as { data: { id: string; status: string }[] | null };

    if (!memberships || memberships.length === 0) {
      // No memberships - redirect to register to create tenant
      return NextResponse.redirect(`${origin}/register`);
    }

    // Check if any membership is active
    const hasActiveMembership = memberships.some((m: { id: string; status: string }) => m.status === "ACTIVE");
    
    if (hasActiveMembership) {
      return NextResponse.redirect(`${origin}/portal`);
    }

    // Has memberships but none active - pending approval
    const hasPendingMembership = memberships.some((m: { id: string; status: string }) => m.status === "PENDING_APPROVAL");
    
    if (hasPendingMembership) {
      return NextResponse.redirect(`${origin}/pending-approval`);
    }

    // All memberships suspended/revoked
    return NextResponse.redirect(`${origin}/no-access`);
  }

  // No code provided - redirect to login
  return NextResponse.redirect(`${origin}/login`);
}








