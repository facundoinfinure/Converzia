import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { deleteFile } from "@/lib/services/storage";
import { logger } from "@/lib/utils/logger";
import { handleApiError, handleUnauthorized, handleForbidden, handleNotFound, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import type { MembershipWithRole } from "@/types/supabase-helpers";

// ============================================
// Delete Tenant Logo API
// DELETE /api/portal/settings/logo
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para realizar esta acción");
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
      "get tenant membership for logo deletion"
    );

    const membership = membershipData as MembershipWithRole | null;

    if (!membership) {
      return handleForbidden("No tienes acceso a ningún tenant activo");
    }

    // Check if user has permission to update tenant settings
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      return handleForbidden("Solo propietarios y administradores pueden eliminar el logo");
    }

    const tenantId = membership.tenant_id;

    // Get current tenant to find logo URL
    const { data: tenant, error: tenantError } = await queryWithTimeout(
      supabase
        .from("tenants")
        .select("id, logo_url")
        .eq("id", tenantId)
        .single(),
      5000,
      "get tenant for logo deletion"
    );

    if (tenantError || !tenant) {
      return handleApiError(tenantError || new Error("Tenant not found"), {
        code: ErrorCode.NOT_FOUND,
        status: 404,
        message: "No se encontró información del tenant",
        context: { tenantId },
      });
    }

    const logoUrl = (tenant as { logo_url?: string | null }).logo_url;

    // If no logo exists, return success
    if (!logoUrl) {
      return apiSuccess(null, "No hay logo para eliminar");
    }

    // Extract file path from URL
    // Logo URL format: https://<project>.supabase.co/storage/v1/object/public/tenant-logos/<tenant_id>/logo.<ext>
    const urlMatch = logoUrl.match(/\/tenant-logos\/([^\/]+)\/(.+)$/);
    
    if (urlMatch) {
      const [, folderPath, fileName] = urlMatch;
      const filePath = `${folderPath}/${fileName}`;

      // Delete file from storage
      const deleteResult = await deleteFile("tenant-logos", filePath);

      if (!deleteResult.success) {
        logger.warn("Error deleting logo file from storage", {
          tenantId,
          filePath,
          error: deleteResult.error,
        });
        // Continue anyway - we'll still update the tenant record
      }
    } else {
      logger.warn("Could not parse logo URL", { tenantId, logoUrl });
      // Continue anyway - we'll still update the tenant record
    }

    // Update tenant to remove logo_url
    const { error: updateError } = await queryWithTimeout(
      supabase
        .from("tenants")
        .update({
          logo_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId),
      10000,
      "update tenant to remove logo"
    );

    if (updateError) {
      return handleApiError(updateError, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudo actualizar la información del tenant",
        context: { tenantId },
      });
    }

    logger.info("Logo deleted successfully", { tenantId });

    return apiSuccess(null, "Logo eliminado correctamente");
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al eliminar el logo",
      context: { operation: "delete_logo" },
    });
  }
}
