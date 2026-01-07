import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { initializeTenantStorage } from "@/lib/services/storage";
import { isAdminProfile } from "@/types/supabase-helpers";
import type { Tenant } from "@/types/database";
import { logger } from "@/lib/utils/logger";
import { validateBody, createTenantRequestSchema } from "@/lib/validation/schemas";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, handleConflict, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { logTenantCreated } from "@/lib/monitoring/audit";

// ============================================
// Tenants API
// ============================================

/**
 * POST /api/tenants
 * Creates a new tenant with storage initialization
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    // Verify user is authenticated and is Converzia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para crear tenants");
    }

    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "verificar perfil de admin"
    );

    if (!isAdminProfile(profile as { is_converzia_admin?: boolean } | null)) {
      return handleForbidden("Solo administradores de Converzia pueden crear tenants");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, createTenantRequestSchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const {
      name,
      slug,
      contact_email,
      contact_phone,
      timezone = "America/Argentina/Buenos_Aires",
      default_score_threshold = 80,
      duplicate_window_days = 90,
    } = bodyValidation.data;

    // Create tenant
    const { data: tenant, error: tenantError } = await queryWithTimeout(
      admin
        .from("tenants")
        .insert({
          name,
          slug,
          contact_email: contact_email || null,
          contact_phone: contact_phone || null,
          timezone,
          default_score_threshold,
          duplicate_window_days,
        })
        .select()
        .single(),
      30000,
      "crear tenant"
    );

    if (tenantError) {
      if (tenantError.code === "23505") {
        return handleConflict("Ya existe un tenant con ese slug. Por favor elige otro.", {
          slug,
        });
      }
      return handleApiError(tenantError, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo crear el tenant",
        context: { name, slug },
      });
    }

    if (!tenant) {
      return handleApiError(new Error("No se recibió respuesta del servidor"), {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: "No se pudo crear el tenant",
        context: { name, slug },
      });
    }

    const typedTenant = tenant as Tenant;
    const tenantId = typedTenant.id;

    // Create default pricing
    const { error: pricingError } = await queryWithTimeout(
      admin.from("tenant_pricing").insert({
        tenant_id: tenantId,
        charge_model: "PER_LEAD",
        cost_per_lead: 10,
        packages: [
          { id: "starter", name: "Starter", credits: 50, price: 400 },
          { id: "growth", name: "Growth", credits: 100, price: 700, discount_pct: 12.5, is_popular: true },
          { id: "scale", name: "Scale", credits: 250, price: 1500, discount_pct: 25 },
        ],
      }),
      10000,
      "crear pricing por defecto"
    );

    if (pricingError) {
      logger.error("Error creating default pricing", pricingError, { tenantId });
      // Don't fail - pricing can be added later
    }

    // Initialize storage for tenant
    const storageResult = await initializeTenantStorage(tenantId);
    if (!storageResult.success) {
      logger.error("Error initializing tenant storage", new Error(storageResult.error || "Unknown error"), { tenantId });
      // Don't fail - storage can be initialized later, but log the warning
    }

    // Log audit event
    await logTenantCreated(user.id, tenantId, {
      name: typedTenant.name,
      slug: typedTenant.slug,
    }, request);

    return apiSuccess(
      {
        tenant,
        storage_initialized: storageResult.success,
      },
      "Tenant creado correctamente"
    );
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al crear el tenant",
      context: { operation: "create_tenant" },
    });
  }
}








