import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/tenants/[id]/trial-credits - Grant trial credits to a tenant
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: tenantId } = await context.params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a Converzia admin
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "CONVERZIA_ADMIN") {
      return NextResponse.json(
        { error: "Only Converzia admins can grant trial credits" },
        { status: 403 }
      );
    }

    // Get request body for optional custom amount
    let amount = 5; // Default
    try {
      const body = await request.json();
      if (body.amount && typeof body.amount === "number" && body.amount > 0) {
        amount = body.amount;
      }
    } catch {
      // Use default amount if no body provided
    }

    // Check if tenant exists and hasn't received trial credits
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, trial_credits_granted, status")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (tenant.trial_credits_granted) {
      return NextResponse.json(
        { error: "Trial credits already granted to this tenant" },
        { status: 400 }
      );
    }

    // Get current balance
    const { data: currentBalance } = await supabase.rpc("get_tenant_credits", {
      p_tenant_id: tenantId,
    } as any);

    const newBalance = (currentBalance || 0) + amount;

    // Insert credit bonus entry
    const { error: ledgerError } = await supabase.from("credit_ledger").insert({
      tenant_id: tenantId,
      transaction_type: "CREDIT_BONUS",
      amount: amount,
      balance_after: newBalance,
      description: "Trial credits - Free leads to try the platform",
      created_by: user.id,
    });

    if (ledgerError) {
      console.error("Error inserting credit ledger:", ledgerError);
      return NextResponse.json(
        { error: "Failed to grant trial credits" },
        { status: 500 }
      );
    }

    // Update tenant with trial info
    const { error: updateError } = await supabase
      .from("tenants")
      .update({
        trial_credits_granted: true,
        trial_credits_amount: amount,
        trial_granted_at: new Date().toISOString(),
        trial_granted_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (updateError) {
      console.error("Error updating tenant:", updateError);
      return NextResponse.json(
        { error: "Failed to update tenant trial status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      amount,
      new_balance: newBalance,
      message: `${amount} trial credits granted to ${tenant.name}`,
    });
  } catch (error) {
    console.error("Error granting trial credits:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/tenants/[id]/trial-credits - Get trial credits status
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: tenantId } = await context.params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tenant trial status
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select(
        "trial_credits_granted, trial_credits_amount, trial_granted_at, trial_granted_by"
      )
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get default trial credits from pricing
    const { data: pricing } = await supabase
      .from("tenant_pricing")
      .select("default_trial_credits")
      .eq("tenant_id", tenantId)
      .single();

    return NextResponse.json({
      trial_credits_granted: tenant.trial_credits_granted,
      trial_credits_amount: tenant.trial_credits_amount,
      trial_granted_at: tenant.trial_granted_at,
      default_trial_credits: pricing?.default_trial_credits || 5,
    });
  } catch (error) {
    console.error("Error getting trial credits status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

