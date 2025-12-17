import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ============================================
// Supabase Middleware
// Uses publishable key (sb_publishable_*) or legacy anon key
// Note: Edge Runtime has limited Node.js API support
// See: https://supabase.com/docs/guides/api/api-keys
// ============================================

// Publishable key - supports both new and legacy formats
const getPublishableKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Routes that don't require authentication
const publicRoutes = [
  "/login",
  "/forgot-password",
  "/register",
  "/pending-approval",
  "/auth/callback",
  "/api/webhooks",
];

// Routes that require Converzia admin
const adminRoutes = ["/admin"];

// Routes that require tenant membership
const portalRoutes = ["/portal"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getPublishableKey()!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get the current path
  const path = request.nextUrl.pathname;

  // Check if it's a public route
  const isPublicRoute = publicRoutes.some(
    (route) => path === route || path.startsWith(route + "/")
  );

  // Check if it's a webhook route (always public)
  const isWebhookRoute = path.startsWith("/api/webhooks");

  // Check if it's the auth callback route
  const isAuthCallback = path.startsWith("/auth/callback");

  if (isWebhookRoute || isAuthCallback) {
    return supabaseResponse;
  }

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not authenticated and not on public route, redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // If authenticated and on login page, redirect appropriately
  if (user && path === "/login") {
    // Get user profile to check if admin
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_converzia_admin")
      .eq("id", user.id)
      .single();

    if (profile?.is_converzia_admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // Check memberships
    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("id, status")
      .eq("user_id", user.id);

    const url = request.nextUrl.clone();

    if (!memberships || memberships.length === 0) {
      // No memberships - redirect to register
      url.pathname = "/register";
    } else {
      const hasActive = memberships.some((m) => m.status === "ACTIVE");
      if (hasActive) {
        url.pathname = "/portal";
      } else {
        const hasPending = memberships.some((m) => m.status === "PENDING_APPROVAL");
        url.pathname = hasPending ? "/pending-approval" : "/no-access";
      }
    }
    return NextResponse.redirect(url);
  }

  // If on register page and already has tenant, redirect
  if (user && path === "/register") {
    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("id, status")
      .eq("user_id", user.id);

    if (memberships && memberships.length > 0) {
      const url = request.nextUrl.clone();
      const hasActive = memberships.some((m) => m.status === "ACTIVE");
      if (hasActive) {
        url.pathname = "/portal";
      } else {
        url.pathname = "/pending-approval";
      }
      return NextResponse.redirect(url);
    }
  }

  // If on pending-approval and now approved, redirect to portal
  if (user && path === "/pending-approval") {
    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE");

    if (memberships && memberships.length > 0) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      return NextResponse.redirect(url);
    }
  }

  // Check admin routes
  const isAdminRoute = adminRoutes.some(
    (route) => path === route || path.startsWith(route + "/")
  );

  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_converzia_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_converzia_admin) {
      // Not an admin, redirect to portal
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      return NextResponse.redirect(url);
    }
  }

  // Check portal routes
  const isPortalRoute = portalRoutes.some(
    (route) => path === route || path.startsWith(route + "/")
  );

  if (isPortalRoute && user) {
    // Check if user has any active tenant membership
    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("id, tenant_id, status")
      .eq("user_id", user.id);

    const hasActiveMembership = memberships?.some((m) => m.status === "ACTIVE");

    if (!hasActiveMembership) {
      // Check if they're a Converzia admin (can access portal too)
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_converzia_admin) {
        const url = request.nextUrl.clone();
        
        // Check if pending approval
        const hasPending = memberships?.some((m) => m.status === "PENDING_APPROVAL");
        if (hasPending) {
          url.pathname = "/pending-approval";
        } else if (!memberships || memberships.length === 0) {
          url.pathname = "/register";
        } else {
          url.pathname = "/no-access";
        }
        return NextResponse.redirect(url);
      }
    }
  }

  // Redirect root to appropriate dashboard
  if (path === "/" && user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_converzia_admin")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    if (profile?.is_converzia_admin) {
      url.pathname = "/admin";
    } else {
      // Check memberships
      const { data: memberships } = await supabase
        .from("tenant_members")
        .select("id, status")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) {
        url.pathname = "/register";
      } else {
        const hasActive = memberships.some((m) => m.status === "ACTIVE");
        if (hasActive) {
          url.pathname = "/portal";
        } else {
          const hasPending = memberships.some((m) => m.status === "PENDING_APPROVAL");
          url.pathname = hasPending ? "/pending-approval" : "/no-access";
        }
      }
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
