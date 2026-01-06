# Apply Migrations 022 & 023

## Critical Migrations to Fix Portal Issues

These migrations fix critical issues preventing the portal from working:
- **022**: Adds `logo_url` column to fix 400 errors
- **023**: Adds performance indexes to fix query timeouts

## How to Apply

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `022_add_tenant_logo_url.sql`
4. Click **Run**
5. Verify success (should see "Success. No rows returned")
6. Repeat for `023_performance_indexes.sql`

### Option 2: Using Supabase CLI

```bash
# Navigate to converzia-core directory
cd converzia-core

# Apply migrations
supabase db push

# Or apply individually
psql $DATABASE_URL -f migrations/022_add_tenant_logo_url.sql
psql $DATABASE_URL -f migrations/023_performance_indexes.sql
```

### Option 3: Direct PostgreSQL Connection

```bash
# Connect to your database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run migrations
\i migrations/022_add_tenant_logo_url.sql
\i migrations/023_performance_indexes.sql
```

## Verification

After applying, run these queries to verify:

```sql
-- Verify logo_url column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenants' 
AND column_name = 'logo_url';

-- Verify indexes were created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('user_profiles', 'tenant_members', 'tenants')
ORDER BY tablename, indexname;
```

## Expected Results

- `logo_url` column should exist on `tenants` table (type: TEXT, nullable: YES)
- Multiple new indexes should appear with names starting with `idx_`
- Portal settings page should load without 400 errors
- Auth queries should complete in < 10 seconds

## Rollback (if needed)

```sql
-- Rollback 022
ALTER TABLE tenants DROP COLUMN IF EXISTS logo_url;
DROP INDEX IF EXISTS idx_tenants_logo_url;

-- Rollback 023
DROP INDEX IF EXISTS idx_user_profiles_id;
DROP INDEX IF EXISTS idx_user_profiles_email;
DROP INDEX IF EXISTS idx_tenant_members_user_status;
DROP INDEX IF EXISTS idx_tenant_members_tenant_status;
DROP INDEX IF EXISTS idx_tenant_members_role;
DROP INDEX IF EXISTS idx_tenants_id;
```
