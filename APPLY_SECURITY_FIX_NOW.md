# 🔴 CRITICAL: Apply Security Fix Now

## What's Wrong?

Three database tables are exposed without Row Level Security (RLS):
- `system_metrics` - Anyone can read/write system metrics
- `platform_costs` - Anyone can read/write platform costs
- `role_permissions` - Anyone can modify role permissions (!)

**This means anyone with your Supabase `anon` key can access/modify these tables.**

## How to Fix (5 Minutes)

### Step 1: Test Admin Function

1. Go to Supabase Dashboard → SQL Editor
2. Run this as an admin user:

```sql
SELECT is_converzia_admin();
```

**Expected**: Should return `true`

**If it returns `false` or errors**: STOP and investigate before proceeding.

### Step 2: Apply Migration

1. Open `converzia-core/migrations/024_enable_rls_public_tables.sql`
2. Copy the entire contents
3. Go to Supabase Dashboard → SQL Editor
4. Paste and click **Run**

**Expected**: "Success. No rows returned"

### Step 3: Verify RLS Enabled

Run this query:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('system_metrics', 'platform_costs', 'role_permissions');
```

**Expected**: All three tables should show `rowsecurity = true`

### Step 4: Verify Policies Created

Run this query:

```sql
SELECT tablename, policyname 
FROM pg_policies
WHERE tablename IN ('system_metrics', 'platform_costs', 'role_permissions')
ORDER BY tablename, policyname;
```

**Expected**: Should see 6 policies:
- `platform_costs_admin_all`
- `role_permissions_admin_delete`
- `role_permissions_admin_modify`
- `role_permissions_admin_update`
- `role_permissions_read_all`
- `system_metrics_admin_all`

### Step 5: Test Access

**As non-admin user** (should fail):
```sql
SELECT * FROM system_metrics LIMIT 1;
-- Expected: Permission denied or no rows
```

**As admin user** (should succeed):
```sql
SELECT * FROM system_metrics LIMIT 1;
SELECT * FROM platform_costs LIMIT 1;
SELECT * FROM role_permissions LIMIT 1;
-- Expected: Success (or no rows if tables are empty)
```

## Done! ✅

Your database is now secure. The three tables are protected by RLS.

## Rollback (If Needed)

If something goes wrong:

```sql
-- Disable RLS
ALTER TABLE system_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_costs DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;

-- Drop policies
DROP POLICY IF EXISTS "system_metrics_admin_all" ON system_metrics;
DROP POLICY IF EXISTS "platform_costs_admin_all" ON platform_costs;
DROP POLICY IF EXISTS "role_permissions_read_all" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin_modify" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin_update" ON role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin_delete" ON role_permissions;
```

## What About the Other 59 Issues?

See `SUPABASE_SECURITY_ACTION_PLAN.md` for full analysis.

**TL;DR**: Most are false positives or low-priority improvements. This is the only critical issue.
