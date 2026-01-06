# Supabase Security Fixes

## Overview

Supabase database linter has identified several security issues that need to be addressed:

- **20 ERROR level issues**: Security Definer Views and RLS disabled tables
- **42 WARN level issues**: Function search_path mutable and other security warnings

## Priority Classification

### 🔴 CRITICAL (ERROR Level) - Must Fix

1. **RLS Disabled on Public Tables** (3 tables)
   - `system_metrics`
   - `platform_costs`
   - `role_permissions`

2. **Security Definer Views** (17 views)
   - These views bypass RLS and run with creator's permissions
   - Could expose data across tenant boundaries

### 🟡 HIGH PRIORITY (WARN Level) - Should Fix

1. **Function Search Path Mutable** (40 functions)
   - Security risk: functions could be hijacked via search_path manipulation
   - Fix: Add `SECURITY DEFINER` and set `search_path` explicitly

2. **Extension in Public Schema** (1 extension)
   - `vector` extension in public schema

3. **Leaked Password Protection Disabled** (Auth config)
   - Should enable HaveIBeenPwned integration

## Detailed Analysis

### Issue 1: RLS Disabled on Public Tables

**Risk**: These tables are exposed via PostgREST without RLS, meaning anyone with the anon key can read/write them.

**Tables Affected**:
- `system_metrics` - System performance metrics
- `platform_costs` - Platform cost tracking
- `role_permissions` - Role permission definitions

**Why This is Critical**:
- `role_permissions` could allow privilege escalation
- `platform_costs` exposes business-sensitive data
- `system_metrics` could reveal infrastructure details

### Issue 2: Security Definer Views

**Risk**: Views with `SECURITY DEFINER` run with the creator's permissions, bypassing RLS. If not carefully designed, they can leak data across tenant boundaries.

**Views Affected** (17 total):
1. `conversation_health`
2. `pending_user_approvals`
3. `offer_funnel_stats`
4. `tenant_leads_anonymized`
5. `offer_performance`
6. `lead_pipeline_stats`
7. `tenant_dashboard`
8. `tenant_dashboard_metrics`
9. `refund_queue`
10. `revenue_analytics`
11. `unmapped_ads_queue`
12. `tenant_funnel_stats`
13. `credit_consumption_details`
14. `dead_letter_queue`
15. `company_revenue_summary`
16. `credit_burn_rate`
17. `tenant_credit_balance`

**Why This is a Problem**:
- These views might expose data from multiple tenants
- They bypass the normal RLS policies
- Could be exploited to access unauthorized data

**Note**: Some of these views are intentionally `SECURITY DEFINER` for admin purposes. We need to audit each one.

### Issue 3: Function Search Path Mutable

**Risk**: Functions without a fixed `search_path` can be exploited by creating malicious functions/tables in a user's search path.

**40 Functions Affected** - See full list in linter output

**Fix Template**:
```sql
ALTER FUNCTION function_name() 
SET search_path = public, pg_temp;
```

### Issue 4: Vector Extension in Public Schema

**Risk**: Minor - Extensions in public schema can cause naming conflicts.

**Fix**:
```sql
-- Create extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move vector extension
ALTER EXTENSION vector SET SCHEMA extensions;
```

### Issue 5: Leaked Password Protection Disabled

**Risk**: Users can set compromised passwords that are known to be leaked.

**Fix**: Enable in Supabase Dashboard → Authentication → Policies

## Implementation Plan

### Phase 1: Enable RLS on Public Tables (CRITICAL)

**File**: Create `converzia-core/migrations/024_enable_rls_public_tables.sql`

```sql
-- ============================================
-- Enable RLS on Public Tables
-- Migration: 024_enable_rls_public_tables
-- ============================================

-- 1. system_metrics - Only admins should access
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "system_metrics_admin_all"
  ON system_metrics
  FOR ALL
  USING (is_converzia_admin());

-- 2. platform_costs - Only admins should access
ALTER TABLE platform_costs ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "platform_costs_admin_all"
  ON platform_costs
  FOR ALL
  USING (is_converzia_admin());

-- 3. role_permissions - Read-only for authenticated users, admin for modifications
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Anyone can read role permissions
CREATE POLICY "role_permissions_read_all"
  ON role_permissions
  FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "role_permissions_admin_modify"
  ON role_permissions
  FOR ALL
  USING (is_converzia_admin());
```

### Phase 2: Audit Security Definer Views

**File**: Create `converzia-core/migrations/025_audit_security_definer_views.sql`

We need to audit each view to determine:
1. Is `SECURITY DEFINER` necessary?
2. Does it properly filter by tenant?
3. Should it be converted to `SECURITY INVOKER`?

**Views that SHOULD keep SECURITY DEFINER** (admin-only):
- `company_revenue_summary` - Admin analytics
- `revenue_analytics` - Admin analytics
- `system_metrics` views - Admin monitoring

**Views that should be SECURITY INVOKER** (tenant-scoped):
- `tenant_dashboard`
- `tenant_dashboard_metrics`
- `tenant_funnel_stats`
- `tenant_credit_balance`
- `lead_pipeline_stats`
- `offer_funnel_stats`
- `offer_performance`
- `credit_consumption_details`
- `credit_burn_rate`

**Action**: Convert tenant-scoped views to `SECURITY INVOKER` and add proper RLS policies.

### Phase 3: Fix Function Search Paths

**File**: Create `converzia-core/migrations/026_fix_function_search_paths.sql`

```sql
-- ============================================
-- Fix Function Search Paths
-- Migration: 026_fix_function_search_paths
-- ============================================

-- Set search_path for all functions
ALTER FUNCTION is_converzia_admin() SET search_path = public, pg_temp;
ALTER FUNCTION generate_order_number() SET search_path = public, pg_temp;
ALTER FUNCTION calculate_daily_revenue() SET search_path = public, pg_temp;
ALTER FUNCTION refund_credit(UUID, INTEGER, TEXT) SET search_path = public, pg_temp;
-- ... (continue for all 40 functions)
```

### Phase 4: Move Vector Extension

**File**: Create `converzia-core/migrations/027_move_vector_extension.sql`

```sql
-- ============================================
-- Move Vector Extension to Extensions Schema
-- Migration: 027_move_vector_extension
-- ============================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move vector extension
ALTER EXTENSION vector SET SCHEMA extensions;

-- Update search_path for functions using vector
-- (if any functions reference vector types)
```

### Phase 5: Enable Leaked Password Protection

**Manual Step**: In Supabase Dashboard
1. Go to Authentication → Policies
2. Enable "Leaked Password Protection"
3. This checks passwords against HaveIBeenPwned.org

## Execution Priority

1. ✅ **Phase 1** - Enable RLS on public tables (CRITICAL)
2. ✅ **Phase 2** - Audit and fix Security Definer views (CRITICAL)
3. ⚠️ **Phase 3** - Fix function search paths (HIGH)
4. ⚠️ **Phase 4** - Move vector extension (LOW)
5. ⚠️ **Phase 5** - Enable password protection (LOW - manual)

## Testing After Each Phase

### Test Phase 1 (RLS on Public Tables)
```sql
-- Should fail for non-admin users
SELECT * FROM system_metrics;
SELECT * FROM platform_costs;

-- Should succeed for everyone
SELECT * FROM role_permissions;
```

### Test Phase 2 (Security Definer Views)
```sql
-- Tenant users should only see their own data
SELECT * FROM tenant_dashboard WHERE tenant_id = 'their-tenant-id';

-- Should not see other tenants' data
SELECT * FROM tenant_dashboard WHERE tenant_id != 'their-tenant-id';
```

## Risk Assessment

### Phase 1 Risks
- **HIGH**: Could break existing admin queries if `is_converzia_admin()` function isn't working
- **Mitigation**: Test with admin user before deploying

### Phase 2 Risks
- **HIGH**: Changing views could break existing queries
- **Mitigation**: Test all dashboard queries after changes

### Phase 3 Risks
- **LOW**: Setting search_path is generally safe
- **Mitigation**: Test function calls after changes

## Rollback Plans

### Rollback Phase 1
```sql
ALTER TABLE system_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_costs DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_metrics_admin_all" ON system_metrics;
DROP POLICY IF EXISTS "platform_costs_admin_all" ON platform_costs;
DROP POLICY IF EXISTS "role_permissions_read_all" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin_modify" ON role_permissions;
```

## Next Steps

1. Review this document
2. Decide which phases to implement
3. Create migrations for approved phases
4. Test in development environment
5. Deploy to production with monitoring

## Notes

- Some Security Definer views are intentional for admin analytics
- Need to verify `is_converzia_admin()` function works correctly
- Password protection is a Supabase dashboard setting, not a migration
- Vector extension move is low priority but good practice
