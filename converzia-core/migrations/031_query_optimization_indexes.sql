-- ============================================
-- Converzia: Query Optimization Indexes
-- Migration: 031_query_optimization_indexes
-- ============================================
-- 
-- This migration adds composite indexes to optimize the most common
-- query patterns that are experiencing timeouts:
-- - Leads list queries with status filters and ordering
-- - Team members queries with tenant filtering
-- - Lead details queries with joins
--

-- ============================================
-- Lead Offers Indexes (for leads list queries)
-- ============================================

-- Composite index for leads list query: tenant_id + status + updated_at DESC
-- This optimizes: WHERE tenant_id = ? AND status IN (...) ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_lead_offers_tenant_status_updated 
  ON lead_offers(tenant_id, status, updated_at DESC);

-- Composite index for leads filtered by offer
-- This optimizes: WHERE tenant_id = ? AND status IN (...) AND offer_id = ?
CREATE INDEX IF NOT EXISTS idx_lead_offers_tenant_status_offer 
  ON lead_offers(tenant_id, status, offer_id);

-- Index for queries without status filter (just tenant + updated_at)
-- This optimizes: WHERE tenant_id = ? ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_lead_offers_tenant_updated 
  ON lead_offers(tenant_id, updated_at DESC);

-- ============================================
-- Tenant Members Indexes (for team queries)
-- ============================================

-- Composite index for team members query with ordering
-- This optimizes: WHERE tenant_id = ? ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_created 
  ON tenant_members(tenant_id, created_at);

-- Composite index for active team members only
-- This optimizes: WHERE tenant_id = ? AND status = 'ACTIVE' ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_active_created 
  ON tenant_members(tenant_id, created_at) 
  WHERE status = 'ACTIVE';

-- ============================================
-- Leads Table Indexes (for join optimization)
-- ============================================

-- Index on lead_id for faster joins from lead_offers
-- This should already exist, but ensure it's there
CREATE INDEX IF NOT EXISTS idx_leads_id ON leads(id);

-- Index on first_name for faster lookups in joins
CREATE INDEX IF NOT EXISTS idx_leads_first_name 
  ON leads(first_name) 
  WHERE first_name IS NOT NULL;

-- ============================================
-- Offers Table Indexes (for join optimization)
-- ============================================

-- Index on offer_id for faster joins from lead_offers
-- This should already exist, but ensure it's there
CREATE INDEX IF NOT EXISTS idx_offers_id ON offers(id);

-- Index on name for faster lookups in joins
CREATE INDEX IF NOT EXISTS idx_offers_name 
  ON offers(name) 
  WHERE name IS NOT NULL;

-- ============================================
-- User Profiles Indexes (for team member joins)
-- ============================================

-- Index on user_id for faster joins from tenant_members
-- This should already exist, but ensure it's there
CREATE INDEX IF NOT EXISTS idx_user_profiles_id_join ON user_profiles(id);

-- ============================================
-- Update Table Statistics
-- ============================================

-- Analyze tables to update query planner statistics
-- This helps PostgreSQL choose the best query plans
ANALYZE lead_offers;
ANALYZE tenant_members;
ANALYZE leads;
ANALYZE offers;
ANALYZE user_profiles;

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify indexes were created:
-- 
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'lead_offers' 
--   AND indexname LIKE 'idx_lead_offers_tenant%';
--
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'tenant_members' 
--   AND indexname LIKE 'idx_tenant_members_tenant%';
