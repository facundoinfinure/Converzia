import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

// ============================================
// GET /api/admin/revenue
// Returns revenue metrics for a date range
// ============================================

interface RevenueSummary {
  payments_received: number;
  leads_ready_count: number;
  leads_ready_value: number;
  leads_delivered_count: number;
  leads_delivered_value: number;
  attributed_spend: number;
  platform_spend: number;
  leads_raw_count: number;
  profit: number;
  margin_pct: number;
  pending_credits: number;
}

interface TenantRevenue {
  tenant_id: string;
  tenant_name: string;
  payments_received: number;
  leads_ready_count: number;
  leads_ready_value: number;
  leads_delivered_count: number;
  leads_delivered_value: number;
  attributed_spend: number;
  platform_spend: number;
  leads_raw_count: number;
  profit: number;
  margin_pct: number;
  cost_per_lead: number;
  cpl_attributed: number;
}

interface OfferRevenue {
  offer_id: string;
  offer_name: string;
  tenant_id: string;
  tenant_name: string;
  leads_ready_count: number;
  leads_ready_value: number;
  attributed_spend: number;
  profit: number;
  margin_pct: number;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_converzia_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_converzia_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const dateStartParam = searchParams.get("date_start");
    const dateEndParam = searchParams.get("date_end");
    const tenantId = searchParams.get("tenant_id");
    const refresh = searchParams.get("refresh") === "true";

    // Default to last 30 days if no dates provided
    const dateEnd = dateEndParam 
      ? new Date(dateEndParam) 
      : new Date();
    const dateStart = dateStartParam 
      ? new Date(dateStartParam) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Format dates for SQL
    const dateStartStr = dateStart.toISOString().split("T")[0];
    const dateEndStr = dateEnd.toISOString().split("T")[0];

    // Use admin client for RPC calls
    const admin = createAdminClient();

    // If refresh is requested, invalidate cache for the date range
    if (refresh) {
      await admin
        .from("revenue_daily_cache")
        .delete()
        .gte("cache_date", dateStartStr)
        .lte("cache_date", dateEndStr);
    }

    // Call the get_revenue_summary function
    const { data: tenantData, error: summaryError } = await admin
      .rpc("get_revenue_summary", {
        p_date_start: dateStartStr,
        p_date_end: dateEndStr,
        p_tenant_id: tenantId || null,
      });

    if (summaryError) {
      console.error("Error fetching revenue summary:", summaryError);
      
      // Fallback to direct calculation if function doesn't exist yet
      return await fallbackCalculation(admin, dateStartStr, dateEndStr, tenantId);
    }

    // Calculate totals
    const summary: RevenueSummary = {
      payments_received: 0,
      leads_ready_count: 0,
      leads_ready_value: 0,
      leads_delivered_count: 0,
      leads_delivered_value: 0,
      attributed_spend: 0,
      platform_spend: 0,
      leads_raw_count: 0,
      profit: 0,
      margin_pct: 0,
      pending_credits: 0,
    };

    const byTenant: TenantRevenue[] = (tenantData || []).map((row: any) => {
      // Accumulate totals
      summary.payments_received += Number(row.payments_received) || 0;
      summary.leads_ready_count += Number(row.leads_ready_count) || 0;
      summary.leads_ready_value += Number(row.leads_ready_value) || 0;
      summary.leads_delivered_count += Number(row.leads_delivered_count) || 0;
      summary.leads_delivered_value += Number(row.leads_delivered_value) || 0;
      summary.attributed_spend += Number(row.attributed_spend) || 0;
      summary.platform_spend += Number(row.platform_spend) || 0;
      summary.leads_raw_count += Number(row.leads_raw_count) || 0;
      summary.profit += Number(row.profit) || 0;

      return {
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name,
        payments_received: Number(row.payments_received) || 0,
        leads_ready_count: Number(row.leads_ready_count) || 0,
        leads_ready_value: Number(row.leads_ready_value) || 0,
        leads_delivered_count: Number(row.leads_delivered_count) || 0,
        leads_delivered_value: Number(row.leads_delivered_value) || 0,
        attributed_spend: Number(row.attributed_spend) || 0,
        platform_spend: Number(row.platform_spend) || 0,
        leads_raw_count: Number(row.leads_raw_count) || 0,
        profit: Number(row.profit) || 0,
        margin_pct: Number(row.margin_pct) || 0,
        cost_per_lead: 0, // Will be fetched separately
        cpl_attributed: row.leads_ready_count > 0 
          ? Number(row.attributed_spend) / Number(row.leads_ready_count) 
          : 0,
      };
    });

    // Calculate overall margin
    summary.margin_pct = summary.leads_ready_value > 0
      ? ((summary.profit / summary.leads_ready_value) * 100)
      : 0;

    // Fetch pending credits (total balance across all tenants)
    const { data: creditData } = await admin
      .from("credit_ledger")
      .select("tenant_id, balance_after")
      .order("created_at", { ascending: false });

    // Get latest balance per tenant
    const latestBalances = new Map<string, number>();
    (creditData || []).forEach((row: any) => {
      if (!latestBalances.has(row.tenant_id)) {
        latestBalances.set(row.tenant_id, Number(row.balance_after) || 0);
      }
    });
    
    summary.pending_credits = Array.from(latestBalances.values()).reduce((sum, bal) => sum + bal, 0);

    // Fetch cost_per_lead for each tenant
    const { data: pricingData } = await admin
      .from("tenant_pricing")
      .select("tenant_id, cost_per_lead");

    const pricingMap = new Map(
      (pricingData || []).map((p: any) => [p.tenant_id, Number(p.cost_per_lead) || 0])
    );

    byTenant.forEach(t => {
      t.cost_per_lead = pricingMap.get(t.tenant_id) || 0;
    });

    // Fetch revenue by offer
    const { data: offerData } = await admin
      .from("lead_offers")
      .select(`
        offer_id,
        tenant_id,
        offers(name),
        tenants(name),
        lead_sources(attributed_cost)
      `)
      .in("status", ["LEAD_READY", "SENT_TO_DEVELOPER"])
      .gte("status_changed_at", dateStartStr)
      .lte("status_changed_at", dateEndStr + "T23:59:59");

    // Aggregate by offer
    const offerMap = new Map<string, OfferRevenue>();
    (offerData || []).forEach((row: any) => {
      if (!row.offer_id) return;
      
      const existing = offerMap.get(row.offer_id);
      const cpl = pricingMap.get(row.tenant_id) || 0;
      const attrCost = Number(row.lead_sources?.attributed_cost) || 0;
      
      if (existing) {
        existing.leads_ready_count += 1;
        existing.leads_ready_value += cpl;
        existing.attributed_spend += attrCost;
        existing.profit = existing.leads_ready_value - existing.attributed_spend;
        existing.margin_pct = existing.leads_ready_value > 0
          ? ((existing.profit / existing.leads_ready_value) * 100)
          : 0;
      } else {
        offerMap.set(row.offer_id, {
          offer_id: row.offer_id,
          offer_name: row.offers?.name || "Unknown",
          tenant_id: row.tenant_id,
          tenant_name: row.tenants?.name || "Unknown",
          leads_ready_count: 1,
          leads_ready_value: cpl,
          attributed_spend: attrCost,
          profit: cpl - attrCost,
          margin_pct: cpl > 0 ? (((cpl - attrCost) / cpl) * 100) : 0,
        });
      }
    });

    const byOffer = Array.from(offerMap.values()).sort((a, b) => b.leads_ready_value - a.leads_ready_value);

    return NextResponse.json({
      success: true,
      date_range: {
        start: dateStartStr,
        end: dateEndStr,
      },
      summary,
      by_tenant: byTenant,
      by_offer: byOffer,
    });
  } catch (error: any) {
    console.error("Error in revenue API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Fallback calculation when the RPC function doesn't exist yet
async function fallbackCalculation(
  supabase: any,
  dateStart: string,
  dateEnd: string,
  tenantId: string | null
) {
  try {
    // Get tenants with pricing
    let tenantsQuery = supabase
      .from("tenants")
      .select("id, name, tenant_pricing(cost_per_lead)")
      .eq("status", "ACTIVE");

    if (tenantId) {
      tenantsQuery = tenantsQuery.eq("id", tenantId);
    }

    const { data: tenants } = await tenantsQuery;

    const summary: RevenueSummary = {
      payments_received: 0,
      leads_ready_count: 0,
      leads_ready_value: 0,
      leads_delivered_count: 0,
      leads_delivered_value: 0,
      attributed_spend: 0,
      platform_spend: 0,
      leads_raw_count: 0,
      profit: 0,
      margin_pct: 0,
      pending_credits: 0,
    };

    const byTenant: TenantRevenue[] = [];

    for (const tenant of tenants || []) {
      const cpl = tenant.tenant_pricing?.[0]?.cost_per_lead || 0;

      // Get payments received
      const { data: payments } = await supabase
        .from("billing_orders")
        .select("total")
        .eq("tenant_id", tenant.id)
        .eq("status", "completed")
        .gte("paid_at", dateStart)
        .lte("paid_at", dateEnd + "T23:59:59");

      const paymentsReceived = (payments || []).reduce(
        (sum: number, p: any) => sum + Number(p.total),
        0
      );

      // Get leads ready
      const { data: leadsReady, count: leadsReadyCount } = await supabase
        .from("lead_offers")
        .select("id, lead_sources(attributed_cost)", { count: "exact" })
        .eq("tenant_id", tenant.id)
        .in("status", ["LEAD_READY", "SENT_TO_DEVELOPER"])
        .gte("status_changed_at", dateStart)
        .lte("status_changed_at", dateEnd + "T23:59:59");

      const leadCount = leadsReadyCount || 0;
      const leadsValue = leadCount * cpl;
      const attrSpend = (leadsReady || []).reduce(
        (sum: number, l: any) => sum + (Number(l.lead_sources?.attributed_cost) || 0),
        0
      );

      // Get platform spend
      const { data: platformCosts } = await supabase
        .from("platform_costs")
        .select("spend, leads_raw")
        .eq("tenant_id", tenant.id)
        .gte("date_start", dateStart)
        .lte("date_end", dateEnd);

      const platformSpend = (platformCosts || []).reduce(
        (sum: number, c: any) => sum + Number(c.spend),
        0
      );
      const leadsRaw = (platformCosts || []).reduce(
        (sum: number, c: any) => sum + Number(c.leads_raw),
        0
      );

      const profit = leadsValue - attrSpend;
      const margin = leadsValue > 0 ? (profit / leadsValue) * 100 : 0;

      const tenantRevenue: TenantRevenue = {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        payments_received: paymentsReceived,
        leads_ready_count: leadCount,
        leads_ready_value: leadsValue,
        leads_delivered_count: 0, // Simplified
        leads_delivered_value: 0,
        attributed_spend: attrSpend,
        platform_spend: platformSpend,
        leads_raw_count: leadsRaw,
        profit,
        margin_pct: margin,
        cost_per_lead: cpl,
        cpl_attributed: leadCount > 0 ? attrSpend / leadCount : 0,
      };

      byTenant.push(tenantRevenue);

      // Accumulate totals
      summary.payments_received += paymentsReceived;
      summary.leads_ready_count += leadCount;
      summary.leads_ready_value += leadsValue;
      summary.attributed_spend += attrSpend;
      summary.platform_spend += platformSpend;
      summary.leads_raw_count += leadsRaw;
      summary.profit += profit;
    }

    summary.margin_pct = summary.leads_ready_value > 0
      ? (summary.profit / summary.leads_ready_value) * 100
      : 0;

    return NextResponse.json({
      success: true,
      date_range: {
        start: dateStart,
        end: dateEnd,
      },
      summary,
      by_tenant: byTenant,
      by_offer: [],
    });
  } catch (error: any) {
    console.error("Fallback calculation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate revenue" },
      { status: 500 }
    );
  }
}

