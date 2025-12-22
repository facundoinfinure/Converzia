import { NextRequest, NextResponse } from "next/server";

// ============================================
// Cron Job Authentication Helper
// Validates CRON_SECRET for Vercel cron jobs
// ============================================

export interface CronAuthResult {
  authorized: boolean;
  response?: NextResponse;
}

/**
 * Validates the cron secret for protected cron job endpoints
 * Returns unauthorized response if validation fails
 * 
 * @example
 * export async function GET(request: NextRequest) {
 *   const auth = validateCronAuth(request);
 *   if (!auth.authorized) return auth.response!;
 *   // ... rest of cron job logic
 * }
 */
export function validateCronAuth(request: NextRequest): CronAuthResult {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // SECURITY: CRON_SECRET must be configured in production
  if (!cronSecret) {
    console.error("SECURITY: CRON_SECRET not configured - cron job rejected");
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Server configuration error: CRON_SECRET not set" },
        { status: 500 }
      ),
    };
  }

  // Validate the Bearer token
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("SECURITY: Unauthorized cron job access attempt", {
      hasAuthHeader: !!authHeader,
      path: request.nextUrl.pathname,
    });
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return { authorized: true };
}

/**
 * Middleware-style cron auth that returns null if authorized
 * or the error response if not
 */
export function withCronAuth(request: NextRequest): NextResponse | null {
  const result = validateCronAuth(request);
  return result.authorized ? null : result.response!;
}

