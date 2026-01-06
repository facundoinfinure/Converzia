# Quick Start - Apply Critical Fixes

## ⚠️ IMPORTANT: Apply Migrations First!

Before the code changes will work, you **MUST** apply the database migrations.

## Step 1: Apply Migrations (5 minutes)

### Using Supabase Dashboard (Easiest)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste this:

```sql
-- Migration 022: Add logo_url column
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN tenants.logo_url IS 'URL to tenant logo image stored in Supabase Storage (bucket: tenant-logos)';

CREATE INDEX IF NOT EXISTS idx_tenants_logo_url ON tenants(logo_url) WHERE logo_url IS NOT NULL;
```

6. Click **Run** (bottom right)
7. Wait for "Success. No rows returned"
8. Click **New Query** again
9. Copy and paste this:

```sql
-- Migration 023: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_status ON tenant_members(user_id, status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_status ON tenant_members(tenant_id, status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_tenant_members_role ON tenant_members(role);
CREATE INDEX IF NOT EXISTS idx_tenants_id ON tenants(id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

ANALYZE user_profiles;
ANALYZE tenant_members;
ANALYZE tenants;
```

10. Click **Run**
11. Wait for "Success. No rows returned"

### Verify Migrations Applied

Run this query in SQL Editor:

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tenants' AND column_name = 'logo_url';
```

**Expected result**: Should return one row with `logo_url`

If you see `logo_url`, migrations are applied! ✅

## Step 2: Deploy Code Changes

The code changes are already in your repository. Deploy as normal:

```bash
# Commit if not already committed
git add .
git commit -m "Fix critical database schema and OAuth errors"
git push

# Deploy (if using Vercel)
vercel deploy --prod

# Or use your normal deployment process
```

## Step 3: Test

1. **Clear browser cache and cookies** (important!)
2. Login to portal
3. Navigate to `/portal/settings`
4. Should load without errors ✅

If you see errors, check `TESTING_GUIDE.md` for detailed troubleshooting.

## What Was Fixed?

✅ **Database Schema**: Added missing `logo_url` column  
✅ **Performance**: Added indexes to speed up queries (30s+ → <10s)  
✅ **Google OAuth**: Fixed 500 errors, added error logging  
✅ **Billing API**: Fixed 500 errors, added error logging  
✅ **Error Logging**: Added comprehensive logging for debugging  

## Need More Details?

- **Full implementation details**: See `IMPLEMENTATION_SUMMARY.md`
- **Comprehensive testing**: See `TESTING_GUIDE.md`
- **Migration instructions**: See `converzia-core/migrations/README_APPLY_MIGRATIONS.md`

## Having Issues?

### "Column logo_url does not exist"
→ Migration 022 not applied. Go back to Step 1.

### "Still timing out after 30 seconds"
→ Migration 023 not applied. Go back to Step 1.

### "Google OAuth still returns 500"
→ Check environment variables: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### "Can't find the migrations"
→ They're in `converzia-core/migrations/022_add_tenant_logo_url.sql` and `023_performance_indexes.sql`

## Support

Check the server logs for detailed error messages. All errors now have prefixes:
- `[Google OAuth]`
- `[Google Spreadsheets]`
- `[Billing Consumption]`

This makes debugging much easier!
