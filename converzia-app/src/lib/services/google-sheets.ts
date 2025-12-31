import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import type { Delivery, QualificationFields, ScoreBreakdown, GoogleOAuthTokens } from "@/types";

// ============================================
// Google Sheets Integration Service
// ============================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export interface GoogleSheetsConfig {
  spreadsheet_id: string;
  sheet_name: string;
  service_account_json?: string; // Legacy: JSON string of service account credentials
  column_mapping?: Record<string, string>; // Custom column mapping
  include_headers?: boolean;
}

export interface SheetsAppendResult {
  success: boolean;
  row_number?: number;
  error?: string;
}

// ============================================
// OAuth Helper Functions
// ============================================

/**
 * Get authenticated OAuth2 client from tokens, with automatic refresh
 */
async function getOAuthClient(
  tokens: GoogleOAuthTokens,
  integrationId: string
): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error("Google OAuth not configured");
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
  const needsRefresh = tokens.expires_at - now < 5 * 60 * 1000;

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
      console.error("Error refreshing Google token:", error);
      return null;
    }
  }

  return oauth2Client;
}

/**
 * Create auth client - supports both OAuth tokens and legacy service account
 */
async function createSheetsAuth(
  config: GoogleSheetsConfig,
  oauthTokens?: GoogleOAuthTokens | null,
  integrationId?: string
): Promise<InstanceType<typeof google.auth.OAuth2> | InstanceType<typeof google.auth.GoogleAuth> | null> {
  // Prefer OAuth tokens if available
  if (oauthTokens && integrationId) {
    return getOAuthClient(oauthTokens, integrationId);
  }

  // Fall back to service account (legacy)
  if (config.service_account_json) {
    try {
      const credentials = JSON.parse(config.service_account_json);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    } catch {
      return null;
    }
  }

  return null;
}

// ============================================
// Main Functions
// ============================================

/**
 * Append a lead delivery to Google Sheets (supports OAuth and legacy service account)
 */
export async function appendToGoogleSheets(
  delivery: Delivery,
  config: GoogleSheetsConfig,
  oauthTokens?: GoogleOAuthTokens | null,
  integrationId?: string
): Promise<SheetsAppendResult> {
  try {
    // Create auth client (OAuth or service account)
    const auth = await createSheetsAuth(config, oauthTokens, integrationId);
    
    if (!auth) {
      return {
        success: false,
        error: "No se pudo autenticar con Google Sheets",
      };
    }

    const sheets = google.sheets({ version: "v4", auth });

    // Build row data
    const rowData = buildSheetRow(delivery, config.column_mapping);

    // Append to sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: config.spreadsheet_id,
      range: `${config.sheet_name}!A:Z`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [rowData],
      },
    });

    // Extract row number from response
    const updatedRange = response.data.updates?.updatedRange;
    const rowMatch = updatedRange?.match(/:(\d+)$/);
    const rowNumber = rowMatch ? parseInt(rowMatch[1]) : undefined;

    // Log sync
    await logSheetsSync(delivery, rowData, response.data, null);

    return {
      success: true,
      row_number: rowNumber,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Log error
    await logSheetsSync(delivery, null, null, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Build row data for Google Sheets
 */
function buildSheetRow(
  delivery: Delivery,
  customMapping?: Record<string, string>
): string[] {
  const payload = delivery.payload;
  const lead = payload.lead || {};
  const qualification = (payload.qualification || {}) as QualificationFields;
  const score = payload.score || {};
  const breakdown = (score.breakdown || {}) as ScoreBreakdown;

  // Default column order (can be customized via mapping)
  const defaultRow = [
    // A: Fecha/hora
    new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }),
    // B: Nombre
    lead.name || "",
    // C: Teléfono
    lead.phone || "",
    // D: Email
    lead.email || "",
    // E: Presupuesto Min
    qualification.budget?.min ? `USD ${qualification.budget.min.toLocaleString()}` : "",
    // F: Presupuesto Max
    qualification.budget?.max ? `USD ${qualification.budget.max.toLocaleString()}` : "",
    // G: Zonas
    qualification.zone?.join(", ") || "",
    // H: Tipología
    qualification.bedrooms ? `${qualification.bedrooms} ambientes` : "",
    // I: Timing
    qualification.timing || "",
    // J: Financiamiento
    qualification.financing !== undefined ? (qualification.financing ? "Sí" : "No") : "",
    // K: Inversor
    qualification.is_investor ? "Sí" : "No",
    // L: Propiedad
    payload.recommended_offer?.name || "",
    // M: Score Total
    String(score.total || 0),
    // N: Score Presupuesto
    String(breakdown.budget || 0),
    // O: Score Zona
    String(breakdown.zone || 0),
    // P: Score Timing
    String(breakdown.timing || 0),
    // Q: Score Completitud
    String(breakdown.completeness || 0),
    // R: Resumen conversación
    payload.conversation_summary || "",
    // S: ID Lead Converzia
    delivery.lead_id,
    // T: ID Delivery
    delivery.id,
  ];

  // If custom mapping provided, reorder/filter columns
  if (customMapping && Object.keys(customMapping).length > 0) {
    return applyCustomMapping(payload, customMapping);
  }

  return defaultRow;
}

/**
 * Apply custom column mapping
 */
function applyCustomMapping(
  payload: Delivery["payload"],
  mapping: Record<string, string>
): string[] {
  const result: string[] = [];

  // Sort by column letter/number
  const sortedColumns = Object.entries(mapping).sort(([a], [b]) => {
    const aNum = columnToNumber(a);
    const bNum = columnToNumber(b);
    return aNum - bNum;
  });

  for (const [, path] of sortedColumns) {
    const value = getNestedValue(payload, path);
    result.push(formatValue(value));
  }

  return result;
}

/**
 * Convert column letter to number (A=1, B=2, etc.)
 */
function columnToNumber(col: string): number {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + col.charCodeAt(i) - "A".charCodeAt(0) + 1;
  }
  return num;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): unknown {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Format value for spreadsheet
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Log Sheets sync to database
 */
async function logSheetsSync(
  delivery: Delivery,
  rowData: string[] | null,
  response: any,
  errorMessage: string | null
): Promise<void> {
  try {
    const supabase = await createClient();

    // Get integration ID
    const { data: integration } = await queryWithTimeout(
      supabase
        .from("tenant_integrations")
        .select("id")
        .eq("tenant_id", delivery.tenant_id)
        .eq("integration_type", "GOOGLE_SHEETS")
        .eq("is_active", true)
        .single(),
      10000,
      "get Google Sheets integration"
    );

    if (!integration) return;

    const startedAt = new Date();
    const completedAt = new Date();

    await queryWithTimeout(
      supabase.from("integration_sync_logs").insert({
        integration_id: integration.id,
        delivery_id: delivery.id,
        sync_type: "LEAD_DELIVERY",
        status: errorMessage ? "FAILED" : "SUCCESS",
        request_payload: rowData ? { row_data: rowData } : null,
        response_payload: response ? { updates: response.updates } : null,
        error_message: errorMessage,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      }),
      10000,
      "log Sheets sync"
    );
  } catch (error) {
    console.error("Error logging Sheets sync:", error);
  }
}

// ============================================
// Setup and Test Functions
// ============================================

/**
 * Test Google Sheets connection (supports OAuth and legacy service account)
 */
export async function testGoogleSheetsConnection(
  config: GoogleSheetsConfig,
  oauthTokens?: GoogleOAuthTokens | null,
  integrationId?: string
): Promise<{
  success: boolean;
  message: string;
  sheet_title?: string;
}> {
  try {
    // Create auth client (OAuth or service account)
    const auth = await createSheetsAuth(config, oauthTokens, integrationId);
    
    if (!auth) {
      return {
        success: false,
        message: "No se pudo autenticar con Google Sheets. Verificá tu conexión.",
      };
    }

    const sheets = google.sheets({ version: "v4", auth });

    // Try to get spreadsheet metadata
    const response = await sheets.spreadsheets.get({
      spreadsheetId: config.spreadsheet_id,
    });

    const sheetTitle = response.data.properties?.title;

    // Verify the sheet exists
    const sheetExists = response.data.sheets?.some(
      (s) => s.properties?.title === config.sheet_name
    );

    if (!sheetExists) {
      return {
        success: false,
        message: `La hoja "${config.sheet_name}" no existe en el spreadsheet`,
        sheet_title: sheetTitle || undefined,
      };
    }

    return {
      success: true,
      message: "Conexión exitosa con Google Sheets",
      sheet_title: sheetTitle || undefined,
    };
  } catch (error: any) {
    if (error.code === 404) {
      return {
        success: false,
        message: "Spreadsheet no encontrado. Verificá el ID.",
      };
    }
    if (error.code === 403) {
      return {
        success: false,
        message: "Sin permisos para acceder al spreadsheet.",
      };
    }
    return {
      success: false,
      message: error.message || "Error de conexión",
    };
  }
}

/**
 * Create headers row in sheet (supports OAuth and legacy service account)
 */
export async function createSheetHeaders(
  config: GoogleSheetsConfig,
  oauthTokens?: GoogleOAuthTokens | null,
  integrationId?: string
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const auth = await createSheetsAuth(config, oauthTokens, integrationId);
    
    if (!auth) {
      return {
        success: false,
        message: "No se pudo autenticar con Google Sheets",
      };
    }

    const sheets = google.sheets({ version: "v4", auth });

    const headers = [
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
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheet_id,
      range: `${config.sheet_name}!A1:T1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [headers],
      },
    });

    return {
      success: true,
      message: "Headers creados correctamente",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error creando headers",
    };
  }
}

// ============================================
// Helper: Get Sheets Config for Tenant
// ============================================

export interface GoogleSheetsIntegrationData {
  id: string;
  config: GoogleSheetsConfig;
  oauth_tokens: GoogleOAuthTokens | null;
}

export async function getGoogleSheetsConfig(tenantId: string): Promise<GoogleSheetsIntegrationData | null> {
  const supabase = await createClient();

  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select("id, config, oauth_tokens")
    .eq("tenant_id", tenantId)
    .eq("integration_type", "GOOGLE_SHEETS")
    .eq("is_active", true)
    .single();

  if (!integration) return null;

  return {
    id: integration.id,
    config: integration.config as GoogleSheetsConfig,
    oauth_tokens: integration.oauth_tokens as GoogleOAuthTokens | null,
  };
}

