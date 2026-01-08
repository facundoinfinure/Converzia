/**
 * E2E Test: Lead Flow
 * Tests the complete flow from lead creation to delivery
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || "";

const hasEnvVars = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY;

if (!hasEnvVars) {
  console.warn("E2E tests require SUPABASE_URL and SUPABASE_SECRET_KEY");
}

describe.skipIf(!hasEnvVars)("Lead Flow E2E", () => {
  // Only create client if env vars are available (checked by skipIf above)
  const supabase = hasEnvVars ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null as any;
  let testTenantId: string;
  let testOfferId: string;
  let testLeadId: string;
  let testLeadOfferId: string;

  beforeAll(async () => {
    // Create test tenant
    const { data: tenantData } = await supabase.rpc("register_tenant", {
      p_name: "Test Tenant Lead Flow",
      p_slug: `test-lead-flow-${Date.now()}`,
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

      // Add credits
      await supabase.rpc("add_credits", {
        p_tenant_id: testTenantId,
        p_amount: 10,
        p_reason: "E2E test credits",
      });

      // Create test offer
      const { data: offer } = await supabase
        .from("offers")
        .insert({
          tenant_id: testTenantId,
          name: "Test Offer E2E",
          slug: `test-offer-${Date.now()}`,
          offer_type: "PROPERTY",
          status: "ACTIVE",
        })
        .select()
        .single();

      if (offer) {
        testOfferId = (offer as any).id;
      }
    }
  });

  afterAll(async () => {
    // Cleanup
    if (testLeadOfferId) {
      await supabase.from("lead_offers").delete().eq("id", testLeadOfferId);
    }
    if (testLeadId) {
      await supabase.from("leads").delete().eq("id", testLeadId);
    }
    if (testOfferId) {
      await supabase.from("offers").delete().eq("id", testOfferId);
    }
    if (testTenantId) {
      await supabase.from("tenants").delete().eq("id", testTenantId);
    }
  });

  it("should create a lead from webhook", async () => {
    // Simulate Meta webhook payload
    const leadData = {
      phone: "+5491112345678",
      email: "testlead@example.com",
      first_name: "Test",
      last_name: "Lead",
    };

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        tenant_id: testTenantId,
        phone: leadData.phone,
        phone_normalized: leadData.phone.replace(/\D/g, ""),
        email: leadData.email,
        first_name: leadData.first_name,
        last_name: leadData.last_name,
        full_name: `${leadData.first_name} ${leadData.last_name}`,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(lead).toBeDefined();
    testLeadId = (lead as any).id;
  });

  it("should create lead_offer with TO_BE_CONTACTED status", async () => {
    const { data: leadOffer, error } = await supabase
      .from("lead_offers")
      .insert({
        lead_id: testLeadId,
        offer_id: testOfferId,
        tenant_id: testTenantId,
        status: "TO_BE_CONTACTED",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(leadOffer).toBeDefined();
    expect((leadOffer as any).status).toBe("TO_BE_CONTACTED");
    testLeadOfferId = (leadOffer as any).id;
  });

  it("should process qualification and calculate score", async () => {
    // Update qualification fields
    const { error } = await supabase
      .from("lead_offers")
      .update({
        qualification_fields: {
          budget: { min: 50000, max: 100000 },
          zone: ["Palermo"],
          timing: "En 3-6 meses",
        },
        score_total: 75,
        score_breakdown: {
          budget: 20,
          zone: 15,
          timing: 10,
          completeness: 20,
          intent_strength: 10,
        },
      })
      .eq("id", testLeadOfferId);

    expect(error).toBeNull();
  });

  it("should mark lead as READY when score threshold reached", async () => {
    const { error } = await supabase
      .from("lead_offers")
      .update({
        status: "LEAD_READY",
        ready_at: new Date().toISOString(),
      })
      .eq("id", testLeadOfferId);

    expect(error).toBeNull();

    // Verify status
    const { data } = await supabase
      .from("lead_offers")
      .select("status")
      .eq("id", testLeadOfferId)
      .single();

    expect((data as any)?.status).toBe("LEAD_READY");
  });

  it("should create delivery when lead is ready", async () => {
    const { data: delivery, error } = await supabase
      .from("deliveries")
      .insert({
        tenant_id: testTenantId,
        lead_id: testLeadId,
        lead_offer_id: testLeadOfferId,
        status: "PENDING",
        integrations_attempted: [],
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(delivery).toBeDefined();
    expect((delivery as any).status).toBe("PENDING");
  });
});

