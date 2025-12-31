import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { initializeTenantStorage } from "@/lib/services/storage";

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
      name,
      slug,
      contact_email,
      contact_phone,
      timezone = "America/Argentina/Buenos_Aires",
      default_score_threshold = 80,
      duplicate_window_days = 90,
    } = body;

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: "Nombre y slug son requeridos" },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "El slug solo puede contener letras minúsculas, números y guiones" },
        { status: 400 }
      );
    }

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
      console.error("Error creating tenant:", tenantError);
      if (tenantError.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un tenant con ese slug" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: tenantError.message || "Error al crear tenant" },
        { status: 500 }
      );
    }

    if (!tenant) {
      return NextResponse.json(
        { error: "No se recibió respuesta del servidor" },
        { status: 500 }
      );
    }

    const tenantId = (tenant as any).id;

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
      console.error("Error creating default pricing:", pricingError);
      // Don't fail - pricing can be added later
    }

    // Initialize storage for tenant
    const storageResult = await initializeTenantStorage(tenantId);
    if (!storageResult.success) {
      console.error("Error initializing tenant storage:", storageResult.error);
      // Don't fail - storage can be initialized later, but log the warning
    }

    return NextResponse.json({
      success: true,
      tenant,
      storage_initialized: storageResult.success,
    });
  } catch (error) {
    console.error("Error in POST /api/tenants:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}




