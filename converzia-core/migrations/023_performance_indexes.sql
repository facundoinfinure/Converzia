-- ============================================
-- Converzia: Performance Indexes for Auth Context
-- Migration: 023_performance_indexes
-- ============================================
-- 
-- This migration adds indexes to improve query performance,
-- specifically for the auth context queries that were timing out.
--

-- ============================================
-- User Profiles Indexes
-- ============================================

-- Primary key index (should already exist, but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles(id);

-- Email lookup index (for login/search)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- ============================================
-- Tenant Members Indexes
-- ============================================

-- Composite index for user + status lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_status 
  ON tenant_members(user_id, status) 
  WHERE status = 'ACTIVE';

-- Composite index for tenant + status lookups
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_status 
  ON tenant_members(tenant_id, status) 
  WHERE status = 'ACTIVE';

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_tenant_members_role 
  ON tenant_members(role);

-- ============================================
-- Tenants Indexes
-- ============================================

-- Ensure basic indexes exist
CREATE INDEX IF NOT EXISTS idx_tenants_id ON tenants(id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ============================================
-- Update Table Statistics
-- ============================================

-- Analyze tables to update query planner statistics
ANALYZE user_profiles;
ANALYZE tenant_members;
ANALYZE tenants;

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify indexes were created:
-- 
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'user_profiles';
--
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'tenant_members';
--
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'tenants';
