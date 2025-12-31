import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { initializeOfferStorage } from "@/lib/services/storage";

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
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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

    if (!(profile as any)?.is_converzia_admin) {
      return NextResponse.json({ error: "Se requiere acceso de administrador" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
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
    } = body;

    // Validate required fields
    if (!tenant_id) {
      return NextResponse.json({ error: "tenant_id es requerido" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 });
    }
    if (!slug) {
      return NextResponse.json({ error: "slug es requerido" }, { status: 400 });
    }

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
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
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
      console.error("Error creating offer:", offerError);
      if (offerError.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe una oferta con ese slug para este tenant" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: offerError.message || "Error al crear oferta" },
        { status: 500 }
      );
    }

    if (!offer) {
      return NextResponse.json(
        { error: "No se recibió respuesta del servidor" },
        { status: 500 }
      );
    }

    const offerId = (offer as any).id;

    // Initialize storage for offer
    const storageResult = await initializeOfferStorage(tenant_id, offerId);
    if (!storageResult.success) {
      console.error("Error initializing offer storage:", storageResult.error);
      // Don't fail - storage can be initialized later
    }

    return NextResponse.json({
      success: true,
      offer,
      storage_initialized: storageResult.success,
    });
  } catch (error) {
    console.error("Error in POST /api/offers:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}




