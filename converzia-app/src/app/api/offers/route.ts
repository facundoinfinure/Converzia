import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { initializeOfferStorage } from "@/lib/services/storage";
import { logAuditEvent } from "@/lib/monitoring/audit";
import { isAdminProfile } from "@/types/supabase-helpers";
import type { OfferWithRelations } from "@/types/supabase-helpers";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, handleNotFound, handleConflict, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { validateBody, createOfferSchema } from "@/lib/validation/schemas";

// ============================================
// Offers API
// ============================================

/**
 * POST /api/offers
 * Creates a new offer with storage initialization
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    // Verify user is authenticated and is Converzia admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para crear ofertas");
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
      return handleForbidden("Solo administradores de Converzia pueden crear ofertas");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, createOfferSchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(new Error(bodyValidation.error), {
        validationError: bodyValidation.error,
      });
    }
    
    const {
      tenant_id,
      name,
      slug,
      offer_type = "PROPERTY",
      status = "DRAFT",
      description,
      short_description,
      image_url,
      address,
      city,
      zone,
      country = "AR",
      latitude,
      longitude,
      price_from,
      price_to,
      currency = "USD",
      priority = 100,
      settings = {},
    } = bodyValidation.data;

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await queryWithTimeout(
      admin
        .from("tenants")
        .select("id")
        .eq("id", tenant_id)
        .single(),
      5000,
      "verificar tenant"
    );

    if (tenantError || !tenant) {
      return handleNotFound("Tenant", { tenant_id });
    }

    // Build offer data - only include non-null values
    const offerData: Record<string, any> = {
      tenant_id,
      name,
      slug,
      offer_type,
      status,
    };

    // Add optional fields if provided
    if (description) offerData.description = description;
    if (short_description) offerData.short_description = short_description;
    if (image_url) offerData.image_url = image_url;
    if (address) offerData.address = address;
    if (city) offerData.city = city;
    if (zone) offerData.zone = zone;
    if (country) offerData.country = country;
    if (latitude !== undefined && latitude !== null) offerData.latitude = latitude;
    if (longitude !== undefined && longitude !== null) offerData.longitude = longitude;
    if (price_from !== undefined && price_from !== null) offerData.price_from = price_from;
    if (price_to !== undefined && price_to !== null) offerData.price_to = price_to;
    if (currency) offerData.currency = currency;
    if (priority !== undefined) offerData.priority = priority;
    if (settings && Object.keys(settings).length > 0) offerData.settings = settings;

    // Create offer
    const { data: offer, error: offerError } = await queryWithTimeout(
      admin
        .from("offers")
        .insert(offerData)
        .select()
        .single(),
      30000,
      "crear offer"
    );

    if (offerError) {
      if (offerError.code === "23505") {
        return handleConflict("Ya existe una oferta con ese slug para este tenant. Por favor elige otro.", {
          tenant_id,
          slug,
        });
      }
      return handleApiError(offerError, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo crear la oferta",
        context: { tenant_id, name, slug },
      });
    }

    if (!offer) {
      return handleApiError(new Error("No response from server"), {
        code: ErrorCode.INTERNAL_ERROR,
        status: 500,
        message: "No se recibió respuesta del servidor",
        context: { tenant_id, name, slug },
      });
    }

    const typedOffer = offer as OfferWithRelations;
    const offerId = typedOffer.id;

    // Initialize storage for offer
    const storageResult = await initializeOfferStorage(tenant_id, offerId);
    if (!storageResult.success) {
      logger.error("Error initializing offer storage", new Error(storageResult.error || "Unknown error"), { tenant_id, offerId });
      // Don't fail - storage can be initialized later
    }

    // Log audit event
    await logAuditEvent({
      user_id: user.id,
      tenant_id,
      action: "offer_created",
      entity_type: "offer",
      entity_id: offerId,
      new_values: { name, slug, offer_type, status },
      request,
    });

    return apiSuccess(
      {
        offer,
        storage_initialized: storageResult.success,
      },
      "Oferta creada correctamente"
    );
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al crear la oferta",
      context: { operation: "create_offer" },
    });
  }
}








