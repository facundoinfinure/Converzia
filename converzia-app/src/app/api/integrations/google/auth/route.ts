import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

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
      return NextResponse.json(
        { error: "Google OAuth no está configurado" },
        { status: 500 }
      );
    }

    // Get tenant_id from query params (passed from frontend)
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenant_id");
    const integrationId = searchParams.get("integration_id");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenant_id es requerido" },
        { status: 400 }
      );
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      `${APP_URL}/api/integrations/google/callback`
    );

    // Generate auth URL with state (to pass tenant_id back in callback)
    const state = JSON.stringify({ tenantId, integrationId });
    const encodedState = Buffer.from(state).toString("base64");

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // Required for refresh_token
      scope: SCOPES,
      prompt: "consent", // Force consent to always get refresh_token
      state: encodedState,
    });

    // Return the auth URL for frontend to redirect
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Error generating Google auth URL:", error);
    return NextResponse.json(
      { error: "Error al iniciar autenticación con Google" },
      { status: 500 }
    );
  }
}

