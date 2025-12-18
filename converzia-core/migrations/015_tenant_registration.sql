-- ============================================
-- Converzia: Tenant Registration Fields
-- Migration: 015_tenant_registration
-- ============================================

-- Add registration-related fields to tenants table
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS vertical offer_type DEFAULT 'PROPERTY';

-- Add index for vertical filtering
CREATE INDEX IF NOT EXISTS idx_tenants_vertical ON tenants(vertical);

-- Add rejected_at and rejected_reason for approval workflow
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Add approval tracking to tenant_members
ALTER TABLE tenant_members
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Comment for documentation
COMMENT ON COLUMN tenants.website IS 'Business website URL provided during registration';
COMMENT ON COLUMN tenants.description IS 'Brief description of the business';
COMMENT ON COLUMN tenants.vertical IS 'Business vertical/industry type';
COMMENT ON COLUMN tenants.rejected_at IS 'Timestamp when registration was rejected';
COMMENT ON COLUMN tenants.rejected_reason IS 'Reason for rejection if applicable';

