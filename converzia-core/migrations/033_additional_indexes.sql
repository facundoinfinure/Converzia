-- ============================================
-- Converzia: Additional Performance Indexes
-- Migration: 033_additional_indexes
-- ============================================
-- 
-- This migration adds additional indexes to optimize common query patterns
-- identified from API route analysis and potential performance bottlenecks

-- ============================================
-- Billing & Credit Ledger Indexes
-- ============================================

-- Index for billing consumption queries (tenant + transaction_type + created_at)
-- Optimizes: WHERE tenant_id = ? AND transaction_type IN (...) ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_credit_ledger_tenant_type_created 
  ON credit_ledger(tenant_id, transaction_type, created_at DESC);

-- Index for billing orders by tenant and status
-- Optimizes: WHERE tenant_id = ? AND status = ? ORDER BY paid_at DESC
CREATE INDEX IF NOT EXISTS idx_billing_orders_tenant_status_paid 
  ON billing_orders(tenant_id, status, paid_at DESC NULLS LAST);

-- NOTE: tenant_credit_balance is a VIEW, not a table, so indexes cannot be created on it.
-- The underlying table (credit_ledger) already has appropriate indexes.

-- ============================================
-- Deliveries Table Indexes
-- ============================================

-- Index for delivery status queries
-- Optimizes: WHERE status = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_deliveries_status_created 
  ON deliveries(status, created_at DESC);

-- Composite index for tenant delivery queries
-- Optimizes: WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_deliveries_tenant_status_created 
  ON deliveries(tenant_id, status, created_at DESC);

-- Index for lead_offer_id lookups (for joins)
CREATE INDEX IF NOT EXISTS idx_deliveries_lead_offer 
  ON deliveries(lead_offer_id) 
  WHERE lead_offer_id IS NOT NULL;

-- ============================================
-- Lead Sources Indexes
-- ============================================

-- Index for idempotency checks (leadgen_id lookups)
-- Optimizes: WHERE leadgen_id = ? (critical for webhook deduplication)
CREATE INDEX IF NOT EXISTS idx_lead_sources_leadgen_id 
  ON lead_sources(leadgen_id) 
  WHERE leadgen_id IS NOT NULL;

-- Index for tenant + created_at queries
-- Note: platform column may not exist in older schemas, using tenant + created_at instead
-- Optimizes: WHERE tenant_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_lead_sources_tenant_created 
  ON lead_sources(tenant_id, created_at DESC);

-- ============================================
-- RAG Sources Indexes
-- ============================================

-- NOTE: approval_status is added in migration 030_rag_sources_approval.sql
-- which also creates idx_rag_sources_approval_status index.
-- We only add indexes on columns from the original schema.

-- Index for active RAG sources by tenant
-- Optimizes: WHERE tenant_id = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_rag_sources_tenant_active 
  ON rag_sources(tenant_id, is_active) 
  WHERE is_active = true;

-- ============================================
-- Platform Costs Indexes
-- ============================================

-- Index for revenue queries by tenant and date range
-- Optimizes: WHERE tenant_id = ? AND date_start >= ? AND date_end <= ?
CREATE INDEX IF NOT EXISTS idx_platform_costs_tenant_dates 
  ON platform_costs(tenant_id, date_start, date_end);

-- ============================================
-- Revenue Cache Indexes
-- ============================================

-- Index for revenue cache lookups by date
-- Optimizes: WHERE cache_date >= ? AND cache_date <= ?
CREATE INDEX IF NOT EXISTS idx_revenue_cache_date 
  ON revenue_daily_cache(cache_date);

-- Composite index for tenant + date lookups
CREATE INDEX IF NOT EXISTS idx_revenue_cache_tenant_date 
  ON revenue_daily_cache(tenant_id, cache_date);

-- ============================================
-- Ad Offer Mappings Indexes
-- ============================================

-- Index for ad_id lookups (critical for webhook processing)
-- Optimizes: WHERE ad_id = ? (used in Meta webhook handler)
CREATE INDEX IF NOT EXISTS idx_ad_offer_map_ad_id 
  ON ad_offer_map(ad_id);

-- Index for offer_id lookups
-- Optimizes: WHERE offer_id = ?
CREATE INDEX IF NOT EXISTS idx_ad_offer_map_offer_id 
  ON ad_offer_map(offer_id);

-- ============================================
-- Tenant Integrations Indexes
-- ============================================

-- Index for tenant + integration_type lookups
-- Optimizes: WHERE tenant_id = ? AND integration_type = ? AND status = 'ACTIVE'
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant_type_status 
  ON tenant_integrations(tenant_id, integration_type, status) 
  WHERE status = 'ACTIVE';

-- ============================================
-- Update Table Statistics
-- ============================================

ANALYZE credit_ledger;
ANALYZE billing_orders;
-- NOTE: tenant_credit_balance is a VIEW, ANALYZE is not needed for views
ANALYZE deliveries;
ANALYZE lead_sources;
ANALYZE rag_sources;
ANALYZE platform_costs;
ANALYZE revenue_daily_cache;
ANALYZE ad_offer_map;
ANALYZE tenant_integrations;

-- ============================================
-- Comments
-- ============================================

COMMENT ON INDEX idx_credit_ledger_tenant_type_created IS 'Optimizes billing consumption queries with transaction type filters';
COMMENT ON INDEX idx_billing_orders_tenant_status_paid IS 'Optimizes revenue queries filtering by tenant, status, and payment date';
COMMENT ON INDEX idx_lead_sources_leadgen_id IS 'Critical for webhook idempotency checks - prevents duplicate leads';
COMMENT ON INDEX idx_ad_offer_map_ad_id IS 'Critical for Meta webhook processing - must be fast for real-time lead ingestion';
COMMENT ON INDEX idx_deliveries_tenant_status_created IS 'Optimizes delivery status queries for tenant dashboards';
