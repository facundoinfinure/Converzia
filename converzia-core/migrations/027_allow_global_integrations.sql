-- =============================================
-- Migration: Allow Global Integrations (null tenant_id)
-- Description: Modifies tenant_integrations to allow null tenant_id
--              for global integrations like Meta Ads that are managed
--              at the admin level, not per-tenant.
-- =============================================

-- Remove NOT NULL constraint from tenant_id
ALTER TABLE tenant_integrations
ALTER COLUMN tenant_id DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN tenant_integrations.tenant_id IS 
  'The tenant this integration belongs to. NULL for global integrations (e.g., Admin-level Meta Ads connection).';

-- Update the unique constraint to handle null tenant_id
-- First drop the existing constraint if it exists
ALTER TABLE tenant_integrations
DROP CONSTRAINT IF EXISTS tenant_integrations_tenant_id_integration_type_key;

-- Create a new unique index that handles null tenant_id properly
-- For tenant-specific integrations: one per tenant per type
-- For global integrations: only one per type (where tenant_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_integrations_tenant_type 
ON tenant_integrations (tenant_id, integration_type) 
WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_integrations_global_type 
ON tenant_integrations (integration_type) 
WHERE tenant_id IS NULL;

-- Verification
DO $$
BEGIN
  -- Check if column now allows null
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_integrations' 
    AND column_name = 'tenant_id' 
    AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE 'SUCCESS: tenant_integrations.tenant_id now allows NULL for global integrations';
  ELSE
    RAISE WARNING 'tenant_integrations.tenant_id still has NOT NULL constraint';
  END IF;
END $$;

