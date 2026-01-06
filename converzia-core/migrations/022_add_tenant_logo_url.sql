-- ============================================
-- Converzia: Add Tenant Logo URL Column
-- Migration: 022_add_tenant_logo_url
-- ============================================
-- 
-- This migration adds the logo_url column to the tenants table
-- to fix the schema mismatch causing 400 errors in portal queries.
--

-- Add logo_url column to tenants table
ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN tenants.logo_url IS 'URL to tenant logo image stored in Supabase Storage (bucket: tenant-logos)';

-- Create index for faster lookups when filtering by logo existence
CREATE INDEX IF NOT EXISTS idx_tenants_logo_url ON tenants(logo_url) WHERE logo_url IS NOT NULL;

-- ============================================
-- Verification Query
-- ============================================
-- Run this to verify the column was added:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'tenants' 
-- AND column_name = 'logo_url';
