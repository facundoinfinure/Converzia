/**
 * E2E Test: Billing Flow
 * Tests credit consumption and Stripe payment flow
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("E2E tests require SUPABASE_URL and SUPABASE_SECRET_KEY");
}

describe("Billing Flow E2E", () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let testTenantId: string;
  let initialBalance: number;

  beforeAll(async () => {
    // Create test tenant
    const { data: tenantData } = await supabase.rpc("register_tenant", {
      p_name: "Test Tenant Billing",
      p_slug: `test-billing-${Date.now()}`,
      p_contact_email: "test@example.com",
      p_contact_phone: "+5491112345678",
      p_vertical: "PROPERTY",
    });

    if (tenantData && (tenantData as any[]).length > 0) {
      testTenantId = (tenantData as any)[0].tenant_id;

      // Activate tenant
      await supabase
        .from("tenants")
        .update({ status: "ACTIVE", activated_at: new Date().toISOString() })
        .eq("id", testTenantId);

      // Get initial balance
      const { data: tenant } = await supabase
        .from("tenants")
        .select("credit_balance")
        .eq("id", testTenantId)
        .single();

      initialBalance = (tenant as any)?.credit_balance || 0;
    }
  });

  afterAll(async () => {
    if (testTenantId) {
      await supabase.from("tenants").delete().eq("id", testTenantId);
    }
  });

  it("should consume credits on delivery", async () => {
    // Add credits first
    await supabase.rpc("add_credits", {
      p_tenant_id: testTenantId,
      p_amount: 5,
      p_reason: "Test credits",
    });

    // Get balance before
    const { data: before } = await supabase
      .from("tenants")
      .select("credit_balance")
      .eq("id", testTenantId)
      .single();

    const balanceBefore = (before as any)?.credit_balance || 0;

    // Simulate credit consumption
    const { error } = await supabase.rpc("consume_credit", {
      p_tenant_id: testTenantId,
      p_amount: 1,
      p_reason: "Test delivery",
    });

    expect(error).toBeNull();

    // Get balance after
    const { data: after } = await supabase
      .from("tenants")
      .select("credit_balance")
      .eq("id", testTenantId)
      .single();

    const balanceAfter = (after as any)?.credit_balance || 0;

    expect(balanceAfter).toBe(balanceBefore - 1);
  });

  it("should create billing order for credit purchase", async () => {
    const { data: order, error } = await supabase
      .from("billing_orders")
      .insert({
        tenant_id: testTenantId,
        package_id: "starter",
        credits: 50,
        price: 400,
        currency: "USD",
        status: "PENDING",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(order).toBeDefined();
    expect((order as any).status).toBe("PENDING");
  });

  it("should update billing order on Stripe webhook", async () => {
    // Create pending order
    const { data: order } = await supabase
      .from("billing_orders")
      .insert({
        tenant_id: testTenantId,
        package_id: "starter",
        credits: 50,
        price: 400,
        currency: "USD",
        status: "PENDING",
      })
      .select()
      .single();

    if (!order) return;

    const orderId = (order as any).id;

    // Simulate Stripe webhook - mark as completed
    await supabase
      .from("billing_orders")
      .update({
        status: "completed",
        paid_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    // Verify order is completed
    const { data: updated } = await supabase
      .from("billing_orders")
      .select("status")
      .eq("id", orderId)
      .single();

    expect((updated as any)?.status).toBe("completed");
  });

  it("should add credits when order is completed", async () => {
    // Get balance before
    const { data: before } = await supabase
      .from("tenants")
      .select("credit_balance")
      .eq("id", testTenantId)
      .single();

    const balanceBefore = (before as any)?.credit_balance || 0;

    // Create and complete order
    const { data: order } = await supabase
      .from("billing_orders")
      .insert({
        tenant_id: testTenantId,
        package_id: "starter",
        credits: 10,
        price: 400,
        currency: "USD",
        status: "completed",
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (order) {
      // Add credits (simulating webhook behavior)
      await supabase.rpc("add_credits", {
        p_tenant_id: testTenantId,
        p_amount: (order as any).credits,
        p_reason: `Purchase: ${(order as any).package_id}`,
      });

      // Verify balance increased
      const { data: after } = await supabase
        .from("tenants")
        .select("credit_balance")
        .eq("id", testTenantId)
        .single();

      const balanceAfter = (after as any)?.credit_balance || 0;
      expect(balanceAfter).toBe(balanceBefore + 10);
    }
  });
});

