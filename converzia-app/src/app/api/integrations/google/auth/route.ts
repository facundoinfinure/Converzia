import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

// ============================================
// Google OAuth - Initiate Auth Flow
// ============================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file", // To create new spreadsheets
  "https://www.googleapis.com/auth/userinfo.email", // To get user email
];

export async function GET(request: NextRequest) {
  try {
    // Validate environment variables
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("[Google OAuth] Missing environment variables:", {
        hasClientId: !!GOOGLE_CLIENT_ID,
        hasClientSecret: !!GOOGLE_CLIENT_SECRET,
      });
      return NextResponse.json(
        { error: "Google OAuth no está configurado" },
        { status: 500 }
      );
    }

    // Get tenant_id from query params (passed from frontend)
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenant_id");
    const integrationId = searchParams.get("integration_id");
    const returnUrl = searchParams.get("return_url"); // For portal redirects

    if (!tenantId) {
      console.error("[Google OAuth] Missing tenant_id in request");
      return NextResponse.json(
        { error: "tenant_id es requerido" },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("[Google OAuth] Auth error:", {
        error: authError,
        hasUser: !!user,
        endpoint: request.url,
        tenantId,
      });
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    
    console.log("[Google OAuth] User authenticated:", {
      userId: user.id,
      email: user.email,
      tenantId,
      integrationId,
    });

    // Verify user has access to this tenant
    const { data: membership, error: membershipError } = await supabase
      .from("tenant_members")
      .select("role, status")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .single();

    if (membershipError || !membership) {
      console.error("[Google OAuth] Membership check failed:", {
        userId: user.id,
        tenantId,
        error: membershipError,
        hasMembership: !!membership,
      });
      return NextResponse.json({ 
        error: "No tiene acceso a este tenant" 
      }, { status: 403 });
    }

    console.log("[Google OAuth] Membership verified:", {
      userId: user.id,
      tenantId,
      role: membership.role,
    });

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      `${APP_URL}/api/integrations/google/callback`
    );

    // Generate auth URL with state (to pass tenant_id and return_url back in callback)
    const state = JSON.stringify({ tenantId, integrationId, returnUrl });
    const encodedState = Buffer.from(state).toString("base64");

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Required for refresh_token
      scope: SCOPES,
      prompt: "consent", // Force consent to always get refresh_token
      state: encodedState,
    });

    console.log("[Google OAuth] Generating auth URL:", {
      tenantId,
      integrationId,
      returnUrl,
      scopes: SCOPES,
    });

    // Return the auth URL for frontend to redirect
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("[Google OAuth] Unexpected error:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Error al iniciar autenticación con Google" },
      { status: 500 }
    );
  }
}

