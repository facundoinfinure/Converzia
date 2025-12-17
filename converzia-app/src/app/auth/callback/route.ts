import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

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
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getPublishableKey()!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
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
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, is_converzia_admin")
      .eq("id", user.id)
      .single();

    // If profile doesn't exist, create it
    if (!profile) {
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        });

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
    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("id, status")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      // No memberships - redirect to register to create tenant
      return NextResponse.redirect(`${origin}/register`);
    }

    // Check if any membership is active
    const hasActiveMembership = memberships.some((m) => m.status === "ACTIVE");
    
    if (hasActiveMembership) {
      return NextResponse.redirect(`${origin}/portal`);
    }

    // Has memberships but none active - pending approval
    const hasPendingMembership = memberships.some((m) => m.status === "PENDING_APPROVAL");
    
    if (hasPendingMembership) {
      return NextResponse.redirect(`${origin}/pending-approval`);
    }

    // All memberships suspended/revoked
    return NextResponse.redirect(`${origin}/no-access`);
  }

  // No code provided - redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
