# Testing Guide - Critical Fixes

This guide helps you test the critical database schema and OAuth fixes that were implemented.

## Prerequisites

Before testing, **YOU MUST** apply the database migrations:

1. Navigate to `converzia-core/migrations/`
2. Apply migrations 022 and 023 (see `README_APPLY_MIGRATIONS.md`)
3. Verify migrations were applied successfully

## Test 1: Verify Database Schema Fix ✅

### Purpose
Confirm that the `logo_url` column was added to the `tenants` table.

### Steps

1. Open Supabase Dashboard → SQL Editor
2. Run this query:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name = 'logo_url';
```

### Expected Result
```
column_name | data_type | is_nullable
------------|-----------|------------
logo_url    | text      | YES
```

### If Test Fails
- Migration 022 was not applied
- Apply it manually from `converzia-core/migrations/022_add_tenant_logo_url.sql`

---

## Test 2: Verify Performance Indexes ✅

### Purpose
Confirm that performance indexes were created.

### Steps

1. Open Supabase Dashboard → SQL Editor
2. Run this query:

```sql
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('user_profiles', 'tenant_members', 'tenants')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

### Expected Result
Should see multiple indexes including:
- `idx_user_profiles_id`
- `idx_user_profiles_email`
- `idx_tenant_members_user_status`
- `idx_tenant_members_tenant_status`
- `idx_tenant_members_role`
- `idx_tenants_logo_url`

### If Test Fails
- Migration 023 was not applied
- Apply it manually from `converzia-core/migrations/023_performance_indexes.sql`

---

## Test 3: Portal Settings Page Loads ✅

### Purpose
Verify that the portal settings page loads without 400 errors.

### Steps

1. **Clear browser cache and cookies** (important!)
2. Login to the portal as a tenant user
3. Navigate to `/portal/settings`
4. Open browser DevTools → Console tab
5. Check for errors

### Expected Result
- Page loads successfully
- No 400 Bad Request errors
- No `column tenants.logo_url does not exist` errors
- Settings form is visible

### If Test Fails

**Error: "column tenants.logo_url does not exist"**
- Migration 022 was not applied to the database
- Apply the migration and try again

**Error: Still timing out**
- Check if migration 023 (indexes) was applied
- Check database connection
- Check Supabase logs for slow queries

---

## Test 4: User Profile Query Performance ✅

### Purpose
Verify that authentication queries complete quickly (< 10 seconds).

### Steps

1. **Clear browser cache and cookies**
2. Open browser DevTools → Network tab
3. Login to the portal
4. Measure time from login to dashboard load
5. Check Console tab for timeout errors

### Expected Result
- Login completes in < 10 seconds
- No timeout errors in console
- No "fetch user profile tardó más de 30000ms" errors
- Dashboard loads with tenant data

### If Test Fails

**Still timing out after 10 seconds:**
- Check if migration 023 (indexes) was applied
- Run `ANALYZE` on tables (included in migration 023)
- Check Supabase dashboard for slow query logs
- Verify RLS policies are not causing issues

**Timing out between 10-30 seconds:**
- Indexes are helping but may need optimization
- Check for N+1 query problems
- Consider adding more specific indexes

---

## Test 5: Google OAuth Integration Flow ✅

### Purpose
Verify that Google OAuth endpoints work without 500 errors.

### Steps

1. Login as a tenant user with OWNER or ADMIN role
2. Navigate to `/portal/integrations`
3. Click "Configurar" on Google Sheets integration
4. Click "Conectar con Google"
5. Check browser console and network tab

### Expected Result
- No 500 Internal Server Error
- Redirects to Google OAuth consent screen
- URL contains proper state parameter
- After OAuth: redirects back to portal
- Success message appears

### If Test Fails

**Error: 500 Internal Server Error**
- Check server logs for detailed error messages
- Look for "[Google OAuth]" prefixed log entries
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars are set

**Error: 401 Unauthorized**
- User is not authenticated
- Clear cookies and login again

**Error: 403 Forbidden**
- User doesn't have access to the tenant
- Verify user has OWNER or ADMIN role in `tenant_members` table

**Error: "Google OAuth no está configurado"**
- Environment variables are missing
- Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env.local`

---

## Test 6: Billing Consumption Endpoint ✅

### Purpose
Verify that the billing consumption endpoint works correctly.

### Steps

1. Login as a tenant user
2. Navigate to `/portal/billing`
3. Open browser DevTools → Network tab
4. Check the request to `/api/portal/billing/consumption`
5. Verify response status

### Expected Result
- Status: 200 OK
- Response contains:
  - `success: true`
  - `data.balance` (number)
  - `data.transactions` (array)
  - `data.summary` (object)
- Page displays billing history
- No 500 errors

### If Test Fails

**Error: 500 Internal Server Error**
- Check server logs for "[Billing Consumption]" entries
- Verify user has active tenant membership
- Check if `credit_ledger` table exists

**Error: 401 Unauthorized**
- User is not authenticated
- Session expired - login again

**Error: 403 Forbidden**
- User doesn't have active tenant membership
- Check `tenant_members` table

---

## Test 7: Verify No Hardcoded Data ✅

### Purpose
Ensure all data is properly scoped to the active tenant.

### Steps

1. Create a new test tenant (or use existing)
2. Login as that tenant
3. Visit each portal page:
   - `/portal` (dashboard)
   - `/portal/leads`
   - `/portal/offers`
   - `/portal/integrations`
   - `/portal/billing`
   - `/portal/team`
   - `/portal/settings`
4. Check that all data belongs to the active tenant
5. Switch to a different tenant (if available)
6. Verify data changes accordingly

### Expected Result
- All data is tenant-specific
- No data from other tenants appears
- Switching tenants updates all data
- No hardcoded UUIDs in API calls (check Network tab)

### If Test Fails
- Check browser console for hardcoded IDs
- Check Network tab for API calls with wrong tenant_id
- Verify `activeTenantId` is being used correctly

---

## Server Log Monitoring

After deploying these fixes, monitor server logs for these prefixes:

- `[Google OAuth]` - Google OAuth flow events
- `[Google Spreadsheets]` - Spreadsheets API events
- `[Billing Consumption]` - Billing API events

### Example Good Logs

```
[Google OAuth] User authenticated: { userId: '...', email: '...', tenantId: '...' }
[Google OAuth] Membership verified: { userId: '...', tenantId: '...', role: 'OWNER' }
[Google OAuth] Generating auth URL: { tenantId: '...', scopes: [...] }
```

### Example Error Logs to Watch For

```
[Google OAuth] Auth error: { error: ..., hasUser: false }
[Google OAuth] Membership check failed: { userId: '...', tenantId: '...', error: ... }
[Google Spreadsheets] Integration query failed: { code: '...', message: '...' }
```

---

## Rollback Plan

If tests fail and you need to rollback:

### Rollback Database Changes

```sql
-- Rollback migration 022
ALTER TABLE tenants DROP COLUMN IF EXISTS logo_url;
DROP INDEX IF EXISTS idx_tenants_logo_url;

-- Rollback migration 023
DROP INDEX IF EXISTS idx_user_profiles_id;
DROP INDEX IF EXISTS idx_user_profiles_email;
DROP INDEX IF EXISTS idx_tenant_members_user_status;
DROP INDEX IF EXISTS idx_tenant_members_tenant_status;
DROP INDEX IF EXISTS idx_tenant_members_role;
```

### Rollback Code Changes

```bash
git log --oneline -10  # Find the commit before changes
git revert <commit-hash>  # Revert the changes
```

---

## Success Criteria Summary

All tests should pass with these results:

✅ `logo_url` column exists in database  
✅ Performance indexes are created  
✅ Portal settings page loads without errors  
✅ User profile query completes in < 10 seconds  
✅ Google OAuth flow works without 500 errors  
✅ Billing consumption endpoint returns data  
✅ No hardcoded tenant IDs in codebase  
✅ All data is properly scoped to active tenant  
✅ Server logs show detailed error information  

---

## Need Help?

If any test fails:

1. Check the specific "If Test Fails" section above
2. Review server logs for detailed error messages
3. Verify migrations were applied correctly
4. Check environment variables are set
5. Verify database connection is working
6. Check Supabase RLS policies are correct

## Next Steps After All Tests Pass

1. Monitor production logs for any new errors
2. Check performance metrics (query times)
3. Verify no regressions in other features
4. Document any issues found
5. Plan for additional optimizations if needed
