import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getAdInsights, MetaOAuthTokens, type MetaAdInsights } from "@/lib/services/meta-ads";
import { logger } from "@/lib/utils/logger";
import { validateBody, metaCostsBodySchema } from "@/lib/validation/schemas";
import { rpcWithTimeout } from "@/lib/supabase/query-with-timeout";
import { unsafeRpc } from "@/lib/supabase/unsafe-rpc";
import { handleApiError, handleUnauthorized, handleValidationError, handleNotFound, apiSuccess, ErrorCode } from "@/lib/utils/api-error-handler";

type AdminClient = ReturnType<typeof createAdminClient>;

// ============================================
// Helper: Get days that need syncing
// ============================================
interface SyncDay {
  date: string;
  needsSync: boolean;
  reason: "missing" | "incomplete" | "today";
}

async function getDaysToSync(
  supabase: AdminClient,
  tenantId: string,
  accountId: string,
  dateStart: string,
  dateEnd: string
): Promise<SyncDay[]> {
  const today = new Date().toISOString().split("T")[0];
  const daysToSync: SyncDay[] = [];

  // Get existing sync status for this tenant/account
  const { data: syncStatus } = await supabase
    .from("meta_sync_status")
    .select("sync_date, is_complete, synced_at")
    .eq("tenant_id", tenantId)
    .eq("account_id", accountId)
    .gte("sync_date", dateStart)
    .lte("sync_date", dateEnd);

  interface SyncStatusRow {
    sync_date: string;
    is_complete: boolean;
    synced_at: string;
  }
  const syncStatusArray = Array.isArray(syncStatus) ? syncStatus : [];
  const syncMap = new Map<string, SyncStatusRow>(
    syncStatusArray.map((s: SyncStatusRow) => [s.sync_date, s])
  );

  // Generate all dates in range
  const start = new Date(dateStart);
  const end = new Date(dateEnd);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const existing = syncMap.get(dateStr);

    if (dateStr === today) {
      // Today always needs sync (data is incomplete)
      daysToSync.push({ date: dateStr, needsSync: true, reason: "today" });
    } else if (!existing) {
      // Day not in sync status - needs sync
      daysToSync.push({ date: dateStr, needsSync: true, reason: "missing" });
    } else if (!existing.is_complete) {
      // Day marked as incomplete - needs sync
      daysToSync.push({ date: dateStr, needsSync: true, reason: "incomplete" });
    } else {
      // Day is complete - skip
      daysToSync.push({ date: dateStr, needsSync: false, reason: "missing" });
    }
  }

  return daysToSync;
}

// ============================================
// Helper: Update sync status for days
// ============================================
async function updateSyncStatus(
  supabase: AdminClient,
  tenantId: string,
  accountId: string,
  days: string[],
  recordCounts: Map<string, number>
) {
  const today = new Date().toISOString().split("T")[0];
  
  const records = days.map(date => ({
    tenant_id: tenantId,
    account_id: accountId,
    sync_date: date,
    is_complete: date !== today, // Only past days are complete
    records_synced: recordCounts.get(date) || 0,
    synced_at: new Date().toISOString(),
  }));

  await supabase
    .from("meta_sync_status")
    .upsert(records, {
      onConflict: "tenant_id,account_id,sync_date",
      ignoreDuplicates: false,
    });
}

// ============================================
// Helper: Invalidate revenue cache for synced days
// ============================================
async function invalidateRevenueCache(
  supabase: AdminClient,
  tenantId: string,
  days: string[]
) {
  if (days.length === 0) return;

  await supabase
    .from("revenue_daily_cache")
    .delete()
    .eq("tenant_id", tenantId)
    .in("cache_date", days);
}

// ============================================
// POST /api/integrations/meta/costs - Smart Sync
// ============================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return handleUnauthorized("Autenticación requerida");
    }

    // Validate request body
    const bodyValidation = await validateBody(request, metaCostsBodySchema);
    
    if (!bodyValidation.success) {
      return handleValidationError(bodyValidation.error);
    }
    
    const { tenant_id, account_id, date_start, date_end, force_refresh = false } = bodyValidation.data;

    // Default to last 30 days if no dates provided
    const endDate = date_end || new Date().toISOString().split("T")[0];
    const startDate =
      date_start ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Get Meta integration for this tenant (or global)
    let integration;
    
    // First try tenant-specific integration
    const { data: tenantIntegration } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("integration_type", "META_ADS")
      .eq("is_active", true)
      .maybeSingle();

    if (tenantIntegration) {
      integration = tenantIntegration;
    } else {
      // Try global integration
      const { data: globalIntegration } = await supabase
        .from("tenant_integrations")
        .select("*")
        .is("tenant_id", null)
        .eq("integration_type", "META_ADS")
        .eq("is_active", true)
        .maybeSingle();

      integration = globalIntegration;
    }

    if (!integration) {
      return handleNotFound("Meta Ads no conectado");
    }

    const tokens = integration.oauth_tokens as MetaOAuthTokens;

    if (!tokens?.access_token) {
      return handleValidationError("No se encontró access token");
    }

    // Check if token is expired
    if (tokens.expires_at && Date.now() > tokens.expires_at) {
      return handleUnauthorized("Access token expirado. Reconectá Meta.");
    }

    // Determine which days need syncing (smart sync)
    let daysToSync: SyncDay[];
    
    if (force_refresh) {
      // Force refresh - sync all days
      const days: SyncDay[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push({ 
          date: d.toISOString().split("T")[0], 
          needsSync: true, 
          reason: "missing" 
        });
      }
      daysToSync = days;
    } else {
      // Smart sync - only sync incomplete/missing days
      daysToSync = await getDaysToSync(admin, tenant_id, account_id, startDate, endDate);
    }

    const daysNeedingSync = daysToSync.filter(d => d.needsSync);
    
    if (daysNeedingSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All days already synced",
        synced: 0,
        skipped: daysToSync.length,
        date_range: { start: startDate, end: endDate },
      });
    }

    // Group consecutive days into ranges for efficient API calls
    const ranges: Array<{ start: string; end: string }> = [];
    let currentRange: { start: string; end: string } | null = null;

    for (const day of daysNeedingSync.sort((a, b) => a.date.localeCompare(b.date))) {
      if (!currentRange) {
        currentRange = { start: day.date, end: day.date };
      } else {
        const prevDate: Date = new Date(currentRange.end);
        prevDate.setDate(prevDate.getDate() + 1);
        const expectedNext: string = prevDate.toISOString().split("T")[0];
        
        if (day.date === expectedNext) {
          currentRange.end = day.date;
        } else {
          ranges.push(currentRange);
          currentRange = { start: day.date, end: day.date };
        }
      }
    }
    if (currentRange) ranges.push(currentRange);

    // Fetch insights from Meta for each range
    const allInsights: MetaAdInsights[] = [];
    
    for (const range of ranges) {
      try {
        const insights = await getAdInsights(
          account_id,
          tokens.access_token,
          range.start,
          range.end
        );
        allInsights.push(...insights);
      } catch (err) {
        logger.error(`Error fetching insights for range ${range.start}-${range.end}`, err, { 
          tenant_id, 
          account_id,
          start: range.start,
          end: range.end 
        });
      }
    }

    if (allInsights.length === 0) {
      // Update sync status even if no data (to mark as synced)
      await updateSyncStatus(
        admin,
        tenant_id,
        account_id,
        daysNeedingSync.map(d => d.date),
        new Map()
      );

      return NextResponse.json({
        success: true,
        message: "No data found for the date range",
        synced: 0,
        days_checked: daysNeedingSync.length,
        date_range: { start: startDate, end: endDate },
      });
    }

    // Get ad mappings to link costs to offers
    const { data: adMappings } = await supabase
      .from("ad_offer_map")
      .select("ad_id, offer_id")
      .eq("tenant_id", tenant_id);

    interface AdMappingRow {
      ad_id: string;
      offer_id: string | null;
    }
    const adToOfferMap = new Map<string, string | null>(
      (adMappings || []).map((m: AdMappingRow) => [m.ad_id, m.offer_id])
    );

    // Track records per day for sync status
    const recordCountByDay = new Map<string, number>();

    // Prepare cost records
    const costRecords = allInsights.map((insight) => {
      // Extract lead count from actions
      const leadAction = insight.actions?.find(
        (a: { action_type: string; value: string }) =>
          a.action_type === "lead" ||
          a.action_type === "leadgen_grouped" ||
          a.action_type === "onsite_conversion.lead_grouped"
      );
      const leadsRaw = leadAction ? parseInt(leadAction.value) || 0 : 0;

      // Track count per day
      const day = insight.date_start;
      recordCountByDay.set(day, (recordCountByDay.get(day) || 0) + 1);

      return {
        tenant_id,
        offer_id: adToOfferMap.get(insight.ad_id) || null,
        platform: "META" as const,
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        adset_id: insight.adset_id,
        adset_name: insight.adset_name,
        ad_id: insight.ad_id,
        ad_name: insight.ad_name,
        spend: insight.spend,
        impressions: insight.impressions,
        clicks: insight.clicks,
        leads_raw: leadsRaw,
        date_start: insight.date_start,
        date_end: insight.date_stop,
        synced_at: new Date().toISOString(),
        platform_data: {
          actions: insight.actions,
        },
      };
    });

    // Upsert cost records
    const { error: upsertError } = await admin
      .from("platform_costs")
      .upsert(costRecords, {
        onConflict: "tenant_id,platform,ad_id,date_start,date_end",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      logger.error("Error upserting platform costs", upsertError, { tenant_id, account_id, recordCount: costRecords.length });
      throw new Error("Error al guardar datos de costos");
    }

    // Update sync status
    await updateSyncStatus(
      admin,
      tenant_id,
      account_id,
      daysNeedingSync.map(d => d.date),
      recordCountByDay
    );

    // Invalidate revenue cache for affected days
    await invalidateRevenueCache(
      admin,
      tenant_id,
      daysNeedingSync.map(d => d.date)
    );

    // Recalculate attributed costs for leads that may have been affected
    // This is done via trigger on lead_sources, but we should update existing ones
    try {
      await rpcWithTimeout<unknown>(
        unsafeRpc<unknown>(admin, "recalculate_attributed_costs_for_tenant", {
          p_tenant_id: tenant_id,
          p_date_start: startDate,
          p_date_end: endDate,
        }),
        30000,
        "recalculate_attributed_costs_for_tenant",
        false
      );
    } catch {
      // Function may not exist yet, ignore
    }

    // Calculate totals
    const totalSpend = allInsights.reduce((sum, i) => sum + i.spend, 0);
    const totalImpressions = allInsights.reduce((sum, i) => sum + i.impressions, 0);
    const totalClicks = allInsights.reduce((sum, i) => sum + i.clicks, 0);

    return apiSuccess({
      synced: costRecords.length,
      days_synced: daysNeedingSync.length,
      days_skipped: daysToSync.filter(d => !d.needsSync).length,
      date_range: { start: startDate, end: endDate },
      totals: {
        spend: totalSpend,
        impressions: totalImpressions,
        clicks: totalClicks,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      context: { route: "POST /api/integrations/meta/costs" },
    });
  }
}

// ============================================
// GET /api/integrations/meta/costs - Get synced costs
// ============================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return handleUnauthorized("Autenticación requerida");
    }

    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get("tenant_id");
    const offerId = searchParams.get("offer_id");
    const includeSyncStatus = searchParams.get("include_sync_status") === "true";

    let query = supabase
      .from("platform_costs")
      .select("*")
      .eq("platform", "META")
      .order("date_start", { ascending: false });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    if (offerId) {
      query = query.eq("offer_id", offerId);
    }

    const { data: costs, error } = await query;

    if (error) {
      logger.error("Error fetching costs", error, { tenantId, offerId });
      throw new Error("Error al obtener costos");
    }

    // Optionally include sync status
    let syncStatus = null;
    if (includeSyncStatus && tenantId) {
      const { data } = await supabase
        .from("meta_sync_status")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sync_date", { ascending: false })
        .limit(90); // Last 90 days

      syncStatus = data;
    }

    return apiSuccess({ 
      costs,
      sync_status: syncStatus,
    });
  } catch (error) {
    return handleApiError(error, {
      code: ErrorCode.INTERNAL_ERROR,
      context: { route: "GET /api/integrations/meta/costs" },
    });
  }
}
