import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";
import { handleApiError, handleUnauthorized, handleForbidden, handleValidationError, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";
import { isAdminProfile } from "@/types/supabase-helpers";
import { validateQuery } from "@/lib/validation/schemas";
import { z } from "zod";

// ============================================
// GET /api/admin/audit
// Returns paginated audit logs with filters
// ============================================

const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  action: z.string().optional(),
  entity_type: z.string().optional(),
  tenant_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  entity_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleUnauthorized("Debes iniciar sesión para ver audit logs");
    }

    // Verify admin access
    const { data: profile } = await queryWithTimeout(
      supabase
        .from("user_profiles")
        .select("is_converzia_admin")
        .eq("id", user.id)
        .single(),
      10000,
      "check admin status for audit logs"
    );

    if (!isAdminProfile(profile as { is_converzia_admin?: boolean } | null)) {
      return handleForbidden("Solo administradores de Converzia pueden ver audit logs");
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(searchParams, auditLogsQuerySchema);
    if (!queryValidation.success) {
      return handleValidationError(new Error(queryValidation.error), {
        validationError: queryValidation.error,
      });
    }

    const { page = 1, pageSize = 25, action, entity_type, tenant_id, user_id, entity_id, date_from, date_to } = queryValidation.data;
    const admin = createAdminClient();

    // Build query
    let query = admin
      .from("audit_logs")
      .select(
        `
        *,
        user:user_profiles!audit_logs_user_id_fkey(email),
        tenant:tenants!audit_logs_tenant_id_fkey(name)
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (action) {
      query = query.eq("action", action);
    }
    if (entity_type) {
      query = query.eq("entity_type", entity_type);
    }
    if (tenant_id) {
      query = query.eq("tenant_id", tenant_id);
    }
    if (user_id) {
      query = query.eq("user_id", user_id);
    }
    if (entity_id) {
      query = query.eq("entity_id", entity_id);
    }
    if (date_from) {
      query = query.gte("created_at", date_from);
    }
    if (date_to) {
      query = query.lte("created_at", date_to);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const result = await queryWithTimeout(
      query,
      30000,
      "fetch audit logs"
    );

    if (result.error) {
      return handleApiError(result.error, {
        code: ErrorCode.DATABASE_ERROR,
        status: 500,
        message: "No se pudieron obtener los audit logs",
        context: { operation: "fetch_audit_logs" },
      });
    }

    // Transform data to include joined fields
    type AuditLogResult = {
      id: string;
      user_id: string | null;
      tenant_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      old_values: Record<string, unknown> | null;
      new_values: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
      ip_address: string | null;
      user_agent: string | null;
      created_at: string;
      user: { email: string } | null;
      tenant: { name: string } | null;
    };
    const logs = (result.data as AuditLogResult[] || []).map((log) => ({
      id: log.id,
      user_id: log.user_id,
      tenant_id: log.tenant_id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      old_values: log.old_values,
      new_values: log.new_values,
      metadata: log.metadata,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      created_at: log.created_at,
      user_email: log.user?.email || null,
      tenant_name: log.tenant?.name || null,
    }));

    return apiSuccess(
      {
        data: logs,
        total: result.count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((result.count || 0) / pageSize),
      },
      "Audit logs obtenidos correctamente"
    );
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: "Ocurrió un error al obtener audit logs",
      context: { operation: "get_audit_logs" },
    });
  }
}
