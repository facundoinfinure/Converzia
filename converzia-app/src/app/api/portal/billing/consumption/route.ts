import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

/**
 * GET /api/portal/billing/consumption
 * 
 * Returns credit consumption history with filters.
 * Query params:
 * - offer_id: Filter by specific offer (optional)
 * - from: Start date (optional)
 * - to: End date (optional)
 * - page: Page number (default 1)
 * - limit: Items per page (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
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
    
    const tenantId = membership.tenant_id;
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const offerId = searchParams.get("offer_id");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = (page - 1) * limit;
    
    // Build query
    let query = supabase
      .from("credit_consumption_details")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (offerId) {
      query = query.eq("offer_id", offerId);
    }
    
    if (fromDate) {
      query = query.gte("created_at", fromDate);
    }
    
    if (toDate) {
      query = query.lte("created_at", toDate);
    }
    
    const { data: transactions, error, count } = await queryWithTimeout(
      query,
      10000,
      "get credit consumption"
    );
    
    if (error) {
      console.error("Error fetching consumption:", error);
      return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 });
    }
    
    // Get current balance
    const { data: balanceData } = await queryWithTimeout(
      supabase
        .from("tenant_credit_balance")
        .select("current_balance")
        .eq("tenant_id", tenantId)
        .single(),
      5000,
      "get balance"
    );
    
    const balance = balanceData as { current_balance: number } | null;
    
    // Get summary stats
    const { data: summaryData } = await queryWithTimeout(
      supabase
        .from("credit_ledger")
        .select("transaction_type, amount")
        .eq("tenant_id", tenantId),
      10000,
      "get summary"
    );
    
    const summary = Array.isArray(summaryData) ? summaryData as Array<{ transaction_type: string; amount: number }> : [];
    
    const totalPurchased = summary
      .filter((s) => s.transaction_type === 'CREDIT_PURCHASE')
      .reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    const totalConsumed = summary
      .filter((s) => s.transaction_type === 'CREDIT_CONSUMPTION')
      .reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    const totalRefunded = summary
      .filter((s) => s.transaction_type === 'CREDIT_REFUND')
      .reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    return NextResponse.json({
      success: true,
      data: {
        balance: balance?.current_balance || 0,
        summary: {
          totalPurchased,
          totalConsumed,
          totalRefunded,
        },
        transactions: transactions || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        }
      }
    });
  } catch (error) {
    console.error("Consumption API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

