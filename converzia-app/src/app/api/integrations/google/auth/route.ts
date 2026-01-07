import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, handleUnauthorized, handleValidationError, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";

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
      return handleApiError(new Error("Google OAuth not configured"), {
        code: ErrorCode.INTERNAL_ERROR,
        status: 503,
        message: "Google OAuth no está configurado en el servidor",
        context: { operation: "google_auth" },
      });
    }

    // Get tenant_id from query params (passed from frontend)
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenant_id");
    const integrationId = searchParams.get("integration_id");
    const returnUrl = searchParams.get("return_url"); // For portal redirects

    if (!tenantId) {
      return handleValidationError(new Error("tenant_id es requerido"), {
        field: "tenant_id",
      });
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para conectar Google");
    }
    
    logger.info("[Google OAuth] User authenticated", {
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
      logger.error("[Google OAuth] Membership check failed", membershipError, {
        userId: user.id,
        tenantId,
        hasMembership: !!membership,
      });
      return NextResponse.json({ 
        error: "No tiene acceso a este tenant" 
      }, { status: 403 });
    }

    logger.info("[Google OAuth] Membership verified", {
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

    logger.info("[Google OAuth] Generating auth URL", {
      tenantId,
      integrationId,
      returnUrl,
      scopes: SCOPES,
    });

    // Return the auth URL for frontend to redirect
    return NextResponse.json({ authUrl });
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al iniciar autenticación con Google",
      context: { operation: "google_auth" },
    });
  }
}

