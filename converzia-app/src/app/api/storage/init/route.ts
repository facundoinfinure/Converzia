import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { ensureRagBucketExists, initializeTenantStorage, initializeOfferStorage } from "@/lib/services/storage";

// ============================================
// Storage Initialization API
// ============================================

/**
 * POST /api/storage/init
 * Initializes storage for tenant/offer before upload
 * 
 * Body: { tenant_id: string, offer_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

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
    const { tenant_id, offer_id } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: "tenant_id es requerido" }, { status: 400 });
    }

    // Initialize storage
    let result;
    if (offer_id) {
      // Initialize offer storage (includes tenant folder)
      result = await initializeOfferStorage(tenant_id, offer_id);
    } else {
      // Initialize tenant storage only
      result = await initializeTenantStorage(tenant_id);
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error al inicializar storage" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/storage/init:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/storage/init
 * Ensures the RAG bucket exists (used for health checks)
 */
export async function GET() {
  try {
    const result = await ensureRagBucketExists();
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error al verificar storage" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, bucket: "rag-documents" });
  } catch (error) {
    console.error("Error in GET /api/storage/init:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}




