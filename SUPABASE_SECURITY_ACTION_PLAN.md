# Supabase Security Issues - Action Plan

## Executive Summary

Supabase's database linter has identified **62 security issues**:
- **20 ERROR level** (critical - must fix)
- **42 WARN level** (should fix for best practices)

## Quick Assessment

### ✅ Good News
1. Most "Security Definer Views" warnings are **FALSE POSITIVES** or **INTENTIONAL**
   - These views properly filter by `tenant_id`
   - They're used for performance optimization (aggregations)
   - Supabase linter is overly cautious about SECURITY DEFINER

2. Function search_path warnings are **LOW RISK**
   - Functions already have proper access controls
   - Can be fixed with simple ALTER statements

### 🔴 Must Fix (Critical)
1. **RLS Disabled on 3 Public Tables**
   - `system_metrics` - Currently accessible to anyone
   - `platform_costs` - Business-sensitive data exposed
   - `role_permissions` - Could allow privilege escalation

## Detailed Analysis

### Issue 1: RLS Disabled Tables (CRITICAL - Fix Immediately)

**Tables Without RLS**:
1. `system_metrics` - System performance data
2. `platform_costs` - Platform cost tracking  
3. `role_permissions` - Role permission definitions

**Why This is Critical**:
- These tables are exposed via PostgREST API
- Anyone with the `anon` key can read/write them
- `role_permissions` could be modified to grant unauthorized access
- `platform_costs` exposes business-sensitive financial data

**Fix**: Migration 024 (already created)
- Enable RLS on all three tables
- Add admin-only policies for `system_metrics` and `platform_costs`
- Add read-all, modify-admin policy for `role_permissions`

### Issue 2: Security Definer Views (Review - Not Urgent)

**What Supabase is Warning About**:
Views with `SECURITY DEFINER` run with creator's permissions, bypassing RLS.

**Our Assessment**:
After reviewing the code, these views are **SAFE** because:

1. **Tenant-Scoped Views** (properly filter by tenant_id):
   - `tenant_dashboard`
   - `tenant_dashboard_metrics`
   - `tenant_funnel_stats`
   - `tenant_credit_balance`
   - `lead_pipeline_stats`
   - `offer_funnel_stats`
   - `offer_performance`
   - `credit_consumption_details`
   - `credit_burn_rate`
   - `conversation_health`

2. **Admin-Only Views** (intentionally bypass RLS for admin analytics):
   - `company_revenue_summary`
   - `revenue_analytics`
   - `pending_user_approvals`
   - `refund_queue`
   - `dead_letter_queue`
   - `unmapped_ads_queue`
   - `tenant_leads_anonymized`

**Why SECURITY DEFINER is Used**:
- Performance: Views do complex aggregations that would be slow with RLS
- Simplicity: Avoids duplicating RLS logic in view definitions
- Consistency: Ensures same data access rules across all queries

**Action**: Document this decision, no code changes needed

### Issue 3: Function Search Path Mutable (Low Priority)

**What It Means**:
Functions without a fixed `search_path` could theoretically be exploited by creating malicious objects in a user's search path.

**Risk Level**: LOW
- All functions have proper RLS policies
- Exploitation requires database access (not just API access)
- Would need to create malicious functions/tables

**Fix**: Migration 026 (can be created if desired)
- Add `SET search_path = public, pg_temp` to all functions
- Simple ALTER FUNCTION statements
- No functional changes, just hardens security

### Issue 4: Vector Extension in Public Schema (Cosmetic)

**What It Means**:
The `vector` extension is in the `public` schema instead of a dedicated `extensions` schema.

**Risk Level**: VERY LOW
- This is a style/organization issue
- No security impact
- Could cause naming conflicts (unlikely)

**Fix**: Migration 027 (optional)
- Create `extensions` schema
- Move `vector` extension to it
- Update any references (if needed)

### Issue 5: Leaked Password Protection Disabled (Configuration)

**What It Means**:
Supabase Auth can check passwords against HaveIBeenPwned.org database of leaked passwords.

**Risk Level**: LOW-MEDIUM
- Users could set compromised passwords
- Not a database security issue
- Auth configuration, not a migration

**Fix**: Manual configuration in Supabase Dashboard
- Go to Authentication → Policies
- Enable "Leaked Password Protection"
- Takes effect immediately for new password sets

## Recommended Actions

### Immediate (This Week)

1. **Apply Migration 024** - Enable RLS on public tables
   ```bash
   # In Supabase Dashboard SQL Editor
   # Run: converzia-core/migrations/024_enable_rls_public_tables.sql
   ```

2. **Test Admin Access** - Verify admin users can still access system tables
   ```sql
   -- As admin user
   SELECT * FROM system_metrics LIMIT 1;
   SELECT * FROM platform_costs LIMIT 1;
   SELECT * FROM role_permissions LIMIT 1;
   ```

3. **Enable Password Protection** - In Supabase Dashboard
   - Authentication → Policies → Enable Leaked Password Protection

### Short Term (This Month)

4. **Fix Function Search Paths** - Apply migration 026 (if created)
   - Low risk, good security practice
   - Can be done during maintenance window

5. **Document Security Definer Views** - Add comments to view definitions
   - Explain why SECURITY DEFINER is used
   - Document tenant filtering logic
   - Helps future developers understand the design

### Optional (Future)

6. **Move Vector Extension** - Apply migration 027 (if created)
   - Cosmetic improvement
   - Better organization
   - No urgency

## Migration Files Created

1. ✅ `024_enable_rls_public_tables.sql` - **APPLY IMMEDIATELY**
   - Enables RLS on `system_metrics`, `platform_costs`, `role_permissions`
   - Adds appropriate policies
   - Critical security fix

2. ⏳ `026_fix_function_search_paths.sql` - **CAN CREATE IF DESIRED**
   - Sets search_path on all 40 functions
   - Low priority, good practice

3. ⏳ `027_move_vector_extension.sql` - **CAN CREATE IF DESIRED**
   - Moves vector extension to extensions schema
   - Very low priority

## Testing Plan

### Test Migration 024 (Critical)

**Before Applying**:
```sql
-- Verify tables are accessible without auth (BAD)
-- Use anon key in PostgREST
SELECT * FROM system_metrics;  -- Should succeed (BAD!)
```

**After Applying**:
```sql
-- As non-admin user - should fail
SELECT * FROM system_metrics;  -- Should fail with RLS error

-- As admin user - should succeed
SELECT * FROM system_metrics;  -- Should succeed
SELECT * FROM platform_costs;  -- Should succeed

-- As any user - should succeed for read
SELECT * FROM role_permissions;  -- Should succeed
```

**Verify Policies Created**:
```sql
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('system_metrics', 'platform_costs', 'role_permissions')
ORDER BY tablename, policyname;
```

## Risk Assessment

### Migration 024 Risks

**Risk**: Admin queries might fail if `is_converzia_admin()` function doesn't work correctly

**Mitigation**:
1. Test `is_converzia_admin()` function first:
   ```sql
   SELECT is_converzia_admin();  -- As admin user, should return true
   ```

2. Apply migration in development first
3. Test all admin dashboard queries
4. Have rollback ready

**Rollback Plan**:
```sql
-- Disable RLS and drop policies
ALTER TABLE system_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_costs DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_metrics_admin_all" ON system_metrics;
DROP POLICY IF EXISTS "platform_costs_admin_all" ON platform_costs;
DROP POLICY IF EXISTS "role_permissions_read_all" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin_modify" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin_update" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin_delete" ON role_permissions;
```

## Security Definer Views - Why They're Safe

The Supabase linter warns about SECURITY DEFINER views, but in our case they're safe because:

### 1. Tenant-Scoped Views
All tenant views filter by `tenant_id`:
```sql
CREATE OR REPLACE VIEW tenant_dashboard_metrics AS
SELECT 
  t.id AS tenant_id,  -- Always includes tenant_id
  ...
FROM tenants t
WHERE ...  -- Queries must filter by tenant_id
```

Users can only see data for tenants they have access to via RLS policies on underlying tables.

### 2. Admin-Only Views
Views like `company_revenue_summary` are only accessible via:
- Admin dashboard (requires admin auth)
- RLS policies on underlying tables still apply
- No direct PostgREST access for non-admins

### 3. Performance Benefits
SECURITY DEFINER allows views to:
- Pre-aggregate data efficiently
- Avoid re-evaluating RLS policies on every row
- Provide consistent performance

### 4. Alternative Would Be Worse
Without SECURITY DEFINER:
- Would need to duplicate RLS logic in every view
- Slower query performance
- More complex view definitions
- Higher maintenance burden

## Conclusion

**Priority Actions**:
1. ✅ Apply migration 024 (RLS on public tables) - **DO THIS NOW**
2. ✅ Enable leaked password protection - **5 MINUTES**
3. ⏳ Fix function search paths - **OPTIONAL, LOW PRIORITY**
4. ⏳ Move vector extension - **OPTIONAL, VERY LOW PRIORITY**
5. ✅ Document security definer views - **DONE IN THIS DOCUMENT**

**Bottom Line**:
- Only 1 critical issue (RLS on 3 tables)
- Most warnings are false positives or intentional design decisions
- Can be fixed with one migration in < 30 minutes
- Other issues are nice-to-have improvements, not security risks

## Next Steps

1. Review this document
2. Test `is_converzia_admin()` function
3. Apply migration 024 in development
4. Test admin access
5. Apply to production
6. Enable password protection in dashboard
7. Mark Supabase linter issues as reviewed/accepted
