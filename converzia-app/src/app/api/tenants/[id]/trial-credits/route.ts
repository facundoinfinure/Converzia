import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rpcWithTimeout } from "@/lib/supabase/query-with-timeout";
import { unsafeRpc } from "@/lib/supabase/unsafe-rpc";
import { logAuditEvent } from "@/lib/monitoring/audit";
import { isAdminProfile } from "@/types/supabase-helpers";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleForbidden, handleNotFound, handleConflict, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import type { Tenant } from "@/types/database";
import { validateBody, trialCreditsBodySchema } from "@/lib/validation/schemas";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/tenants/[id]/trial-credits - Grant trial credits to a tenant
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: tenantId } = await context.params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para otorgar créditos de prueba");
    }

    // Check if user is a Converzia admin
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("is_converzia_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !isAdminProfile(profile)) {
      return handleForbidden("Solo administradores de Converzia pueden otorgar créditos de prueba");
    }

    // Validate request body (optional - defaults to 5 credits)
    let amount = 5; // Default
    try {
      const bodyValidation = await validateBody(request, trialCreditsBodySchema.partial());
      if (bodyValidation.success && bodyValidation.data.amount) {
        amount = bodyValidation.data.amount;
      }
    } catch {
      // Use default amount if no body provided or validation fails
    }

    // Check if tenant exists and hasn't received trial credits
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, trial_credits_granted, status")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return handleNotFound("Tenant", { tenant_id: tenantId });
    }

    if (tenant.trial_credits_granted) {
      return handleConflict("Este tenant ya recibió créditos de prueba anteriormente", {
        tenant_id: tenantId,
        already_granted: true,
      });
    }

    // Get current balance
    const rpcResult = await rpcWithTimeout<number>(
      unsafeRpc<number>(supabase, "get_tenant_credits", {
        p_tenant_id: tenantId,
      }),
      10000,
      "get_tenant_credits",
      false
    );
    const currentBalance = rpcResult.data;

    const newBalance = (currentBalance || 0) + amount;

    // Insert credit bonus entry
    const { error: ledgerError } = await supabase.from("credit_ledger").insert({
      tenant_id: tenantId,
      transaction_type: "CREDIT_BONUS",
      amount: amount,
      balance_after: newBalance,
      description: "Trial credits - Free leads to try the platform",
      created_by: user.id,
    });

    if (ledgerError) {
      return handleApiError(ledgerError, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo registrar los créditos en el ledger",
        context: { tenantId, amount },
      });
    }

    // Update tenant with trial info
    const { error: updateError } = await supabase
      .from("tenants")
      .update({
        trial_credits_granted: true,
        trial_credits_amount: amount,
        trial_granted_at: new Date().toISOString(),
        trial_granted_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (updateError) {
      return handleApiError(updateError, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo actualizar el estado del tenant",
        context: { tenantId, amount },
      });
    }

    // Log audit event
    await logAuditEvent({
      user_id: user.id,
      tenant_id: tenantId,
      action: "trial_credits_granted",
      entity_type: "credit_ledger",
      entity_id: tenantId,
      new_values: { amount, new_balance: newBalance },
      metadata: { credits: amount },
      request,
    });

    return apiSuccess(
      {
        amount,
        new_balance: newBalance,
      },
      `${amount} créditos de prueba otorgados a ${tenant.name}`
    );
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al otorgar créditos de prueba",
      context: { operation: "grant_trial_credits" },
    });
  }
}

// GET /api/tenants/[id]/trial-credits - Get trial credits status
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: tenantId } = await context.params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para consultar créditos de prueba");
    }

    // Get tenant trial status
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select(
        "trial_credits_granted, trial_credits_amount, trial_granted_at, trial_granted_by"
      )
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return handleNotFound("Tenant", { tenant_id: tenantId });
    }

    // Get default trial credits from pricing
    const { data: pricing } = await supabase
      .from("tenant_pricing")
      .select("default_trial_credits")
      .eq("tenant_id", tenantId)
      .single();

    return NextResponse.json({
      trial_credits_granted: tenant.trial_credits_granted,
      trial_credits_amount: tenant.trial_credits_amount,
      trial_granted_at: tenant.trial_granted_at,
      default_trial_credits: pricing?.default_trial_credits || 5,
    });
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al consultar el estado de créditos de prueba",
      context: { operation: "get_trial_credits_status" },
    });
  }
}

