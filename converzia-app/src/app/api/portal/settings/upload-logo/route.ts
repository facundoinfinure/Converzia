import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import type { MembershipWithRole } from "@/types/supabase-helpers";
import type { Tenant } from "@/types/database";

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
      return handleUnauthorized("Debes iniciar sesión para subir un logo");
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
    
    const membership = membershipData as MembershipWithRole | null;
    
    if (!membership) {
      return handleForbidden("No tienes acceso a ningún tenant activo");
    }

    // Check permissions
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return handleForbidden("Solo propietarios y administradores pueden subir logos");
    }
    
    const tenantId = membership.tenant_id;
    
    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return handleValidationError(new Error("No file provided"), {
        validationError: "No se proporcionó ningún archivo",
      });
    }
    
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return handleValidationError(new Error("Invalid file type"), {
        validationError: "Tipo de archivo no permitido. Solo se permiten JPG, PNG o WebP",
        allowedTypes: ALLOWED_MIME_TYPES,
      });
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return handleValidationError(new Error("File too large"), {
        validationError: `El archivo es demasiado grande. Tamaño máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        maxSize: MAX_FILE_SIZE,
        fileSize: file.size,
      });
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
        return handleApiError(createError, {
          code: ErrorCode.DATABASE_ERROR,
          status: 500,
          message: "No se pudo inicializar el almacenamiento",
          context: { bucket: TENANT_LOGOS_BUCKET, tenantId },
        });
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
      return handleApiError(uploadError, {
        code: ErrorCode.EXTERNAL_API_ERROR,
        status: 500,
        message: "No se pudo subir el archivo",
        context: { tenantId, filePath, fileSize: file.size },
      });
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
      logger.warn("Error updating logo_url, trying settings", {
        tenantId,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
      
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
      
      const typedTenant = tenantData as Tenant | null;
      const currentSettings = (typedTenant?.settings as Record<string, unknown>) || {};
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
        return handleApiError(settingsError, {
          code: ErrorCode.DATABASE_ERROR,
          status: 500,
          message: "No se pudo guardar el logo",
          context: { tenantId },
        });
      }
    }
    
    return apiSuccess(
      { logo_url: logoUrl },
      "Logo subido correctamente"
    );
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al subir el logo",
      context: { operation: "upload_logo" },
    });
  }
}
