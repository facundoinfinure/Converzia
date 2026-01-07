/**
 * RLS Policies Test Script
 * Tests that RLS policies are correctly enforcing tenant isolation
 * 
 * Usage:
 *   npx tsx scripts/test-rls-policies.ts
 * 
 * Requirements:
 *   - Test users created (see create-test-users.ts)
 *   - Supabase connection configured
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function createUserClient() {
  // IMPORTANT: use ANON key so RLS is enforced.
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Test that a user cannot access another tenant's data
 */
async function testTenantIsolation() {
  // Create admin client to set up test data
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Get test users
  const { data: users } = await adminClient
    .from("user_profiles")
    .select("id, email")
    .in("email", ["test1@example.com", "test2@example.com"])
    .limit(2);
  
  if (!users || users.length < 2) {
    results.push({
      name: "Tenant Isolation Setup",
      passed: false,
      error: "Test users not found. Run create-test-users.ts first.",
    });
    return;
  }
  
  const [user1, user2] = users;
  
  // Get tenants for each user
  const { data: memberships1 } = await adminClient
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user1.id)
    .eq("status", "ACTIVE")
    .limit(1);
  
  const { data: memberships2 } = await adminClient
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user2.id)
    .eq("status", "ACTIVE")
    .limit(1);
  
  if (!memberships1?.[0] || !memberships2?.[0]) {
    results.push({
      name: "Tenant Isolation Setup",
      passed: false,
      error: "Test users don't have tenant memberships",
    });
    return;
  }
  
  const tenant1Id = memberships1[0].tenant_id;
  const tenant2Id = memberships2[0].tenant_id;
  
  if (tenant1Id === tenant2Id) {
    results.push({
      name: "Tenant Isolation Setup",
      passed: false,
      error: "Test users belong to the same tenant",
    });
    return;
  }
  
  // Create test data for tenant1
  const { data: offer1 } = await adminClient
    .from("offers")
    .insert({
      tenant_id: tenant1Id,
      name: "Test Offer Tenant1",
      slug: `test-offer-${Date.now()}`,
      offer_type: "PROPERTY",
      status: "ACTIVE",
    })
    .select()
    .single();
  
  if (!offer1) {
    results.push({
      name: "Tenant Isolation Setup",
      passed: false,
      error: "Failed to create test offer for tenant1",
    });
    return;
  }
  
  // Test: User1 should see tenant1's offers
  const client1 = createUserClient();
  
  // Sign in as user1
  const { data: session1, error: signInError1 } = await client1.auth.signInWithPassword({
    email: user1.email!,
    password: "testpassword123", // Default test password
  });
  
  if (signInError1 || !session1) {
    results.push({
      name: "User1 Authentication",
      passed: false,
      error: signInError1?.message || "Failed to sign in as user1",
    });
    return;
  }
  
  // Test: User1 should see their tenant's offers
  const { data: user1Offers, error: user1Error } = await client1
    .from("offers")
    .select("id, name")
    .eq("tenant_id", tenant1Id);
  
  if (user1Error) {
    results.push({
      name: "User1 can see tenant1 offers",
      passed: false,
      error: user1Error.message,
    });
  } else if (!user1Offers || user1Offers.length === 0) {
    results.push({
      name: "User1 can see tenant1 offers",
      passed: false,
      error: "User1 cannot see their tenant's offers",
    });
  } else {
    results.push({
      name: "User1 can see tenant1 offers",
      passed: true,
    });
  }
  
  // Test: User1 should NOT see tenant2's offers
  const { data: user1Tenant2Offers, error: user1Tenant2Error } = await client1
    .from("offers")
    .select("id, name")
    .eq("tenant_id", tenant2Id);
  
  // Should return empty array, not error (RLS silently filters)
  if (user1Tenant2Offers && user1Tenant2Offers.length > 0) {
    results.push({
      name: "User1 cannot see tenant2 offers (cross-tenant isolation)",
      passed: false,
      error: `User1 can see ${user1Tenant2Offers.length} offers from tenant2`,
    });
  } else {
    results.push({
      name: "User1 cannot see tenant2 offers (cross-tenant isolation)",
      passed: true,
    });
  }
  
  // Test: User1 cannot update tenant2's offers
  const { error: updateError } = await client1
    .from("offers")
    .update({ name: "HACKED" })
    .eq("tenant_id", tenant2Id);
  
  if (!updateError) {
    results.push({
      name: "User1 cannot update tenant2 offers",
      passed: false,
      error: "User1 was able to update tenant2's offers",
    });
  } else {
    results.push({
      name: "User1 cannot update tenant2 offers",
      passed: true,
    });
  }
  
  // Test: User1 should NOT be able to read tenant_stats_mv directly (view should not be exposed to anon/auth)
  const { data: mvData, error: mvError } = await client1.from("tenant_stats_mv").select("tenant_id").limit(1);
  if (mvError) {
    results.push({
      name: "User1 cannot read tenant_stats_mv directly",
      passed: true,
    });
  } else if (mvData && mvData.length > 0) {
    results.push({
      name: "User1 cannot read tenant_stats_mv directly",
      passed: false,
      error: "User1 can read tenant_stats_mv (should be blocked; use SECURITY DEFINER function instead)",
    });
  } else {
    // Empty is acceptable (RLS/permissions may filter)
    results.push({
      name: "User1 cannot read tenant_stats_mv directly",
      passed: true,
    });
  }

  // Cleanup
  await adminClient.from("offers").delete().eq("id", offer1.id);
}

/**
 * Test that Converzia admins can access all data
 */
async function testAdminAccess() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Get an admin user
  const { data: adminUser } = await adminClient
    .from("user_profiles")
    .select("id, email")
    .eq("is_converzia_admin", true)
    .limit(1)
    .single();
  
  if (!adminUser) {
    results.push({
      name: "Admin Access Setup",
      passed: false,
      error: "No admin user found",
    });
    return;
  }
  
  // Get a regular user for comparison
  const { data: regularUser } = await adminClient
    .from("user_profiles")
    .select("id, email")
    .eq("is_converzia_admin", false)
    .limit(1)
    .single();
  
  if (!regularUser) {
    results.push({
      name: "Admin Access Setup",
      passed: false,
      error: "No regular user found",
    });
    return;
  }
  
  // Test admin can see all tenants
  const clientAdmin = createUserClient();
  
  // NOTE: in some environments admin users may not have a known test password.
  const { data: sessionAdmin, error: signInErrorAdmin } = await clientAdmin.auth.signInWithPassword({
    email: adminUser.email!,
    password: "adminpassword123",
  });
  
  if (signInErrorAdmin || !sessionAdmin) {
    results.push({
      name: "Admin Authentication",
      passed: false,
      error: signInErrorAdmin?.message || "Failed to sign in as admin (ensure a test admin user exists with known password)",
    });
    return;
  }
  
  // Admin should see all tenants
  const { data: adminTenants, error: adminTenantsError } = await clientAdmin
    .from("tenants")
    .select("id, name")
    .limit(10);
  
  if (adminTenantsError) {
    results.push({
      name: "Admin can see all tenants",
      passed: false,
      error: adminTenantsError.message,
    });
  } else if (!adminTenants || adminTenants.length === 0) {
    results.push({
      name: "Admin can see all tenants",
      passed: false,
      error: "Admin cannot see any tenants",
    });
  } else {
    results.push({
      name: "Admin can see all tenants",
      passed: true,
    });
  }
  
  // Regular user should only see their tenants
  const clientRegular = createUserClient();
  
  const { data: sessionRegular, error: signInErrorRegular } = await clientRegular.auth.signInWithPassword({
    email: regularUser.email!,
    password: "testpassword123",
  });
  
  if (signInErrorRegular || !sessionRegular) {
    results.push({
      name: "Regular User Authentication",
      passed: false,
      error: signInErrorRegular?.message || "Failed to sign in as regular user",
    });
    return;
  }
  
  // Regular user should only see their tenant's data
  const { data: regularTenants, error: regularTenantsError } = await clientRegular
    .from("tenants")
    .select("id, name");
  
  if (regularTenantsError) {
    results.push({
      name: "Regular user tenant access",
      passed: false,
      error: regularTenantsError.message,
    });
  } else {
    // Regular user should only see tenants they're a member of
    const { data: userMemberships } = await adminClient
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", regularUser.id)
      .eq("status", "ACTIVE");
    
    const userTenantIds = new Set(userMemberships?.map(m => m.tenant_id) || []);
    const visibleTenantIds = new Set(regularTenants?.map(t => t.id) || []);
    
    const hasExtraAccess = Array.from(visibleTenantIds).some(id => !userTenantIds.has(id));
    
    if (hasExtraAccess) {
      results.push({
        name: "Regular user only sees their tenants",
        passed: false,
        error: "Regular user can see tenants they're not a member of",
      });
    } else {
      results.push({
        name: "Regular user only sees their tenants",
        passed: true,
      });
    }
  }
}

/**
 * Test that tenant members cannot perform unauthorized operations
 */
async function testTenantMemberPermissions() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Get a VIEWER role user
  const { data: viewerUser } = await adminClient
    .from("user_profiles")
    .select("id, email")
    .eq("is_converzia_admin", false)
    .limit(1)
    .single();
  
  if (!viewerUser) {
    results.push({
      name: "Viewer Permissions Setup",
      passed: false,
      error: "No regular user found",
    });
    return;
  }
  
  // Get viewer's tenant and membership
  const { data: viewerMembership } = await adminClient
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", viewerUser.id)
    .eq("status", "ACTIVE")
    .eq("role", "VIEWER")
    .limit(1)
    .single();
  
  if (!viewerMembership) {
    results.push({
      name: "Viewer Permissions Setup",
      passed: false,
      error: "No VIEWER role user found",
    });
    return;
  }
  
  // IMPORTANT: use ANON key so RLS is enforced
  const viewerClientRls = createUserClient();
  
  const { data: viewerSession, error: viewerSignInError } = await viewerClientRls.auth.signInWithPassword({
    email: viewerUser.email!,
    password: "testpassword123",
  });
  
  if (viewerSignInError || !viewerSession) {
    results.push({
      name: "Viewer Authentication",
      passed: false,
      error: viewerSignInError?.message || "Failed to sign in as viewer",
    });
    return;
  }
  
  // Test: Viewer should NOT be able to create offers
  const { error: createOfferError } = await viewerClientRls
    .from("offers")
    .insert({
      tenant_id: viewerMembership.tenant_id,
      name: "Unauthorized Offer",
      slug: `unauthorized-${Date.now()}`,
      offer_type: "PROPERTY",
      status: "ACTIVE",
    });
  
  if (!createOfferError) {
    results.push({
      name: "VIEWER cannot create offers",
      passed: false,
      error: "VIEWER was able to create an offer",
    });
  } else {
    results.push({
      name: "VIEWER cannot create offers",
      passed: true,
    });
  }
}

/**
 * Run all RLS tests
 */
async function runTests() {
  console.log("🧪 Running RLS Policy Tests...\n");
  
  try {
    await testTenantIsolation();
    await testAdminAccess();
    await testTenantMemberPermissions();
  } catch (error) {
    console.error("❌ Test execution failed:", error);
    results.push({
      name: "Test Execution",
      passed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
  
  // Print results
  console.log("\n📊 Test Results:\n");
  let passedCount = 0;
  let failedCount = 0;
  
  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.passed) passedCount++;
    else failedCount++;
  }
  
  console.log(`\n📈 Summary: ${passedCount} passed, ${failedCount} failed\n`);
  
  if (failedCount > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);
