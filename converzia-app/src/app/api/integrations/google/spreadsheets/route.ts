import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import type { GoogleOAuthTokens } from "@/types";
import {
  validateQuery,
  validateBody,
  googleSpreadsheetsQuerySchema,
  googleSpreadsheetsPostBodySchema,
} from "@/lib/validation/schemas";
import { handleApiError, handleUnauthorized, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logger } from "@/lib/utils/logger";

// ============================================
// Google Spreadsheets - List & Create
// ============================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SpreadsheetInfo {
  id: string;
  name: string;
  url: string;
  sheets: { id: number; title: string }[];
}

/**
 * GET - List user's spreadsheets
 */
export async function GET(request: NextRequest) {
  try {
    // Validate query params
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(searchParams, googleSpreadsheetsQuerySchema);
    
    if (!queryValidation.success) {
      return handleValidationError(new Error(queryValidation.error), {
        validationError: queryValidation.error,
      });
    }
    
    const { tenant_id: tenantId } = queryValidation.data;

    // Validate environment variables first
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return handleApiError(new Error("Missing Google OAuth config"), {
        code: ErrorCode.INTERNAL_ERROR,
        status: 503,
        message: "Google OAuth no está configurado en el servidor",
        context: { connected: false },
      });
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para acceder a Google Spreadsheets");
    }
    
    logger.info("[Google Spreadsheets] User authenticated", {
      userId: user.id,
      email: user.email,
      tenantId,
    });

    // Verify user has access to this tenant
    const { data: membership, error: membershipError } = await queryWithTimeout<{ role: string; status: string }>(
      supabase
        .from("tenant_members")
        .select("role, status")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .single(),
      5000,
      "check membership"
    );

    if (membershipError || !membership) {
      logger.error("[Google Spreadsheets] Membership check failed", membershipError, {
        userId: user.id,
        tenantId,
      });
      return NextResponse.json({ 
        error: "No tiene acceso a este tenant",
        connected: false 
      }, { status: 403 });
    }

    logger.info("[Google Spreadsheets] Membership verified", {
      userId: user.id,
      tenantId,
      role: membership.role,
    });

    // Get OAuth tokens from database
    const { data: integration, error: integrationError } = await queryWithTimeout<{ id: string; oauth_tokens: unknown; config: unknown }>(
      supabase
        .from("tenant_integrations")
        .select("id, oauth_tokens, config")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "GOOGLE_SHEETS")
        .single(),
      5000,
      "get integration"
    );

    if (integrationError) {
      logger.error("[Google Spreadsheets] Integration query failed", integrationError, {
        code: integrationError.code,
        details: integrationError.details,
        hint: integrationError.hint,
        tenantId,
      });
      
      if (integrationError.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json({
          error: "No hay cuenta de Google conectada",
          connected: false
        }, { status: 401 });
      }
      
      return NextResponse.json({
        error: "Error al acceder a las integraciones",
        details: integrationError.message,
        connected: false
      }, { status: 500 });
    }

    if (!integration) {
      logger.warn("[Google Spreadsheets] No integration found for tenant", { tenantId });
      return NextResponse.json(
        { error: "No hay cuenta de Google conectada", connected: false },
        { status: 401 }
      );
    }

    if (!integration?.oauth_tokens) {
      return NextResponse.json(
        { error: "No hay cuenta de Google conectada", connected: false },
        { status: 401 }
      );
    }

    const tokens = integration.oauth_tokens as GoogleOAuthTokens;

    // Refresh token if needed
    const oauth2Client = await getAuthenticatedClient(tokens, integration.id);
    if (!oauth2Client) {
      return NextResponse.json(
        { error: "Token de Google expirado", connected: false },
        { status: 401 }
      );
    }

    // List spreadsheets from Google Drive
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: "files(id, name, webViewLink)",
      orderBy: "modifiedTime desc",
      pageSize: 50,
    });

    const spreadsheets: SpreadsheetInfo[] = [];
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // Get sheet names for each spreadsheet (limit to first 10 for performance)
    const filesToProcess = (response.data.files || []).slice(0, 10);
    
    for (const file of filesToProcess) {
      if (file.id && file.name) {
        try {
          const sheetInfo = await sheets.spreadsheets.get({
            spreadsheetId: file.id,
            fields: "sheets.properties",
          });

          spreadsheets.push({
            id: file.id,
            name: file.name,
            url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
            sheets: (sheetInfo.data.sheets || []).map((s) => ({
              id: s.properties?.sheetId || 0,
              title: s.properties?.title || "Sheet1",
            })),
          });
        } catch {
          // If we can't get sheet info, still include the spreadsheet
          spreadsheets.push({
            id: file.id,
            name: file.name,
            url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
            sheets: [{ id: 0, title: "Sheet1" }],
          });
        }
      }
    }

    // Add remaining files without fetching sheet details
    for (const file of (response.data.files || []).slice(10)) {
      if (file.id && file.name) {
        spreadsheets.push({
          id: file.id,
          name: file.name,
          url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`,
          sheets: [],
        });
      }
    }

    logger.info("[Google Spreadsheets] Successfully listed spreadsheets", {
      tenantId,
      count: spreadsheets.length,
      email: tokens.email,
    });

    return NextResponse.json({
      connected: true,
      email: tokens.email,
      spreadsheets,
      currentConfig: integration.config,
    });
  } catch (error: any) {
    logger.exception("[Google Spreadsheets] Unexpected error", error, {
      code: error?.code,
      tenantId: request.nextUrl.searchParams.get("tenant_id"),
    });
    
    if (error.code === 401 || error.message?.includes("invalid_grant")) {
      return NextResponse.json(
        { error: "Sesión de Google expirada", connected: false },
        { status: 401 }
      );
    }

    // Check if it's a configuration error
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        { 
          error: "Google OAuth no está configurado en el servidor",
          connected: false 
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        error: "Error al listar spreadsheets",
        details: error instanceof Error ? error.message : "Unknown error",
        connected: false 
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new spreadsheet
 */
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const bodyValidation = await validateBody(request, googleSpreadsheetsPostBodySchema);
    
    if (!bodyValidation.success) {
      return NextResponse.json(
        { error: bodyValidation.error },
        { status: 400 }
      );
    }
    
    const { tenant_id, name } = bodyValidation.data;

    // Get OAuth tokens from database
    const supabase = await createClient();
    const { data: integration } = await supabase
      .from("tenant_integrations")
      .select("id, oauth_tokens")
      .eq("tenant_id", tenant_id)
      .eq("integration_type", "GOOGLE_SHEETS")
      .single();

    if (!integration?.oauth_tokens) {
      return NextResponse.json(
        { error: "No hay cuenta de Google conectada" },
        { status: 401 }
      );
    }

    const tokens = integration.oauth_tokens as GoogleOAuthTokens;

    // Get authenticated client
    const oauth2Client = await getAuthenticatedClient(tokens, integration.id);
    if (!oauth2Client) {
      return NextResponse.json(
        { error: "Token de Google expirado" },
        { status: 401 }
      );
    }

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // Create new spreadsheet
    const spreadsheetName = name || `Converzia Leads - ${new Date().toLocaleDateString("es-AR")}`;
    
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: spreadsheetName,
        },
        sheets: [
          {
            properties: {
              title: "Leads",
              index: 0,
            },
          },
        ],
      },
    });

    const spreadsheetId = response.data.spreadsheetId;
    const spreadsheetUrl = response.data.spreadsheetUrl;

    if (!spreadsheetId) {
      throw new Error("No se pudo crear el spreadsheet");
    }

    // Add headers to the new sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Leads!A1:T1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          "Fecha/Hora",
          "Nombre",
          "Teléfono",
          "Email",
          "Presupuesto Min",
          "Presupuesto Max",
          "Zonas",
          "Tipología",
          "Timing",
          "Financiamiento",
          "Inversor",
          "Propiedad",
          "Score Total",
          "Score Presupuesto",
          "Score Zona",
          "Score Timing",
          "Score Completitud",
          "Resumen Conversación",
          "Lead ID",
          "Delivery ID",
        ]],
      },
    });

    return NextResponse.json({
      success: true,
      spreadsheet: {
        id: spreadsheetId,
        name: spreadsheetName,
        url: spreadsheetUrl,
        sheets: [{ id: 0, title: "Leads" }],
      },
    });
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Error al crear spreadsheet",
      context: { operation: "create_spreadsheet" },
    });
  }
}

/**
 * Helper: Get authenticated OAuth2 client with token refresh
 */
async function getAuthenticatedClient(
  tokens: GoogleOAuthTokens,
  integrationId: string
): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `${APP_URL}/api/integrations/google/callback`
  );

  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expires_at,
  });

  // Check if token needs refresh (expires in less than 5 minutes)
  const now = Date.now();
  const expiresAt = tokens.expires_at;
  const needsRefresh = expiresAt - now < 5 * 60 * 1000;

  if (needsRefresh && tokens.refresh_token) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update tokens in database
      const supabase = await createClient();
      await supabase
        .from("tenant_integrations")
        .update({
          oauth_tokens: {
            ...tokens,
            access_token: credentials.access_token,
            expires_at: credentials.expiry_date || Date.now() + 3600 * 1000,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", integrationId);

      oauth2Client.setCredentials(credentials);
    } catch (error) {
      logger.exception("Error refreshing Google token", error, { integrationId });
      return null;
    }
  }

  return oauth2Client;
}

