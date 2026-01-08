/**
 * E2E Test: Tenant Onboarding Flow
 * Tests the complete flow from registration to approval
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Note: These tests require a test database
// Run with: npm run test:e2e

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || "";

const hasEnvVars = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY;

if (!hasEnvVars) {
  console.warn("E2E tests require SUPABASE_URL and SUPABASE_SECRET_KEY");
}

describe.skipIf(!hasEnvVars)("Tenant Onboarding E2E", () => {
  // Only create client if env vars are available (checked by skipIf above)
  const supabase = hasEnvVars ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null as any;
  let testUserId: string;
  let testTenantId: string;

  beforeAll(async () => {
    // Create test user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `test-${Date.now()}@converzia.test`,
      password: "TestPassword123!",
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    // Create user profile
    await supabase.from("user_profiles").insert({
      id: testUserId,
      email: authData.user.email!,
      full_name: "Test User",
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testTenantId) {
      await supabase.from("tenants").delete().eq("id", testTenantId);
    }
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
      await supabase.from("user_profiles").delete().eq("id", testUserId);
    }
  });

  it("should register a new tenant", async () => {
    const { data, error } = await supabase.rpc("register_tenant", {
      p_name: "Test Tenant E2E",
      p_slug: `test-tenant-${Date.now()}`,
      p_contact_email: "test@example.com",
      p_contact_phone: "+5491112345678",
      p_website: "https://test.com",
      p_description: "Test tenant for E2E",
      p_vertical: "PROPERTY",
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data).toHaveLength(1);
    
    testTenantId = (data as any)[0].tenant_id;
    expect(testTenantId).toBeDefined();
  });

  it("should have tenant in PENDING status", async () => {
    const { data, error } = await supabase
      .from("tenants")
      .select("status")
      .eq("id", testTenantId)
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("PENDING");
  });

  it("should have membership in PENDING_APPROVAL status", async () => {
    const { data, error } = await supabase
      .from("tenant_members")
      .select("status")
      .eq("tenant_id", testTenantId)
      .eq("user_id", testUserId)
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("PENDING_APPROVAL");
  });

  it("should approve tenant and activate membership", async () => {
    // Get admin user for approval
    const { data: admin } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("is_converzia_admin", true)
      .limit(1)
      .single();

    if (!admin) {
      console.warn("No admin user found, skipping approval test");
      return;
    }

    // Approve tenant
    await supabase
      .from("tenants")
      .update({
        status: "ACTIVE",
        activated_at: new Date().toISOString(),
      })
      .eq("id", testTenantId);

    // Approve membership
    await supabase
      .from("tenant_members")
      .update({
        status: "ACTIVE",
        approved_by: admin.id,
        approved_at: new Date().toISOString(),
      })
      .eq("tenant_id", testTenantId)
      .eq("user_id", testUserId);

    // Verify
    const { data: tenant } = await supabase
      .from("tenants")
      .select("status")
      .eq("id", testTenantId)
      .single();

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("status")
      .eq("tenant_id", testTenantId)
      .eq("user_id", testUserId)
      .single();

    expect(tenant?.status).toBe("ACTIVE");
    expect(membership?.status).toBe("ACTIVE");
  });

  it("should create default pricing on approval", async () => {
    const { data, error } = await supabase
      .from("tenant_pricing")
      .select("*")
      .eq("tenant_id", testTenantId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.charge_model).toBe("PER_LEAD");
  });
});

