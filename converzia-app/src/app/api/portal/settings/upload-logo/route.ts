import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

const TENANT_LOGOS_BUCKET = "tenant-logos";
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * POST /api/portal/settings/upload-logo
 * 
 * Uploads a tenant logo to Supabase Storage and updates the tenant record.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    
    // Get user's active tenant membership
    const { data: membershipData } = await queryWithTimeout(
      supabase
        .from("tenant_members")
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .single(),
      5000,
      "get tenant membership"
    );
    
    const membership = membershipData as { tenant_id: string; role: string } | null;
    
    if (!membership) {
      return NextResponse.json({ error: "No tiene acceso a ningún tenant" }, { status: 403 });
    }

    // Check permissions
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json({ error: "No tenés permisos para subir logos" }, { status: 403 });
    }
    
    const tenantId = membership.tenant_id;
    
    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }
    
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Solo se permiten JPG, PNG o WebP" },
        { status: 400 }
      );
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `El archivo es demasiado grande. Tamaño máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }
    
    // Ensure bucket exists
    const { data: buckets } = await adminSupabase.storage.listBuckets();
    const bucketExists = buckets?.some((b: { name: string }) => b.name === TENANT_LOGOS_BUCKET);
    
    if (!bucketExists) {
      // Create the bucket
      const { error: createError } = await adminSupabase.storage.createBucket(TENANT_LOGOS_BUCKET, {
        public: true, // Public bucket for logo URLs
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });
      
      if (createError) {
        console.error("Error creating bucket:", createError);
        return NextResponse.json(
          { error: "Error al inicializar storage" },
          { status: 500 }
        );
      }
    }
    
    // Generate file path: {tenant_id}/logo.{ext}
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `logo.${fileExt}`;
    const filePath = `${tenantId}/${fileName}`;
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Upload to storage (overwrite if exists)
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from(TENANT_LOGOS_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });
    
    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return NextResponse.json(
        { error: "Error al subir el archivo" },
        { status: 500 }
      );
    }
    
    // Get public URL
    const { data: urlData } = adminSupabase.storage
      .from(TENANT_LOGOS_BUCKET)
      .getPublicUrl(filePath);
    
    const logoUrl = urlData.publicUrl;
    
    // Update tenant record with logo_url
    // Check if logo_url column exists, otherwise store in settings JSONB
    const { error: updateError } = await queryWithTimeout(
      adminSupabase
        .from("tenants")
        .update({
          logo_url: logoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId),
      10000,
      "update tenant logo"
    );
    
    if (updateError) {
      // If logo_url column doesn't exist, try storing in settings
      console.warn("Error updating logo_url, trying settings:", updateError);
      
      // Get current settings
      const { data: tenantData } = await queryWithTimeout(
        adminSupabase
          .from("tenants")
          .select("settings")
          .eq("id", tenantId)
          .single(),
        5000,
        "get tenant settings"
      );
      
      const currentSettings = (tenantData as any)?.settings || {};
      const updatedSettings = { ...currentSettings, logo_url: logoUrl };
      
      const { error: settingsError } = await queryWithTimeout(
        adminSupabase
          .from("tenants")
          .update({
            settings: updatedSettings,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenantId),
        5000,
        "update tenant settings"
      );
      
      if (settingsError) {
        console.error("Error updating settings:", settingsError);
        return NextResponse.json(
          { error: "Error al guardar el logo" },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        logo_url: logoUrl,
      },
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
