-- ============================================
-- Performance Indexes Migration
-- Adds composite indexes to improve query performance
-- Run this with: psql -d your_db -f migrations/002_add_performance_indexes.sql
-- ============================================

BEGIN;

-- Index for lead_offers queries (most common filters)
CREATE INDEX IF NOT EXISTS idx_lead_offers_tenant_status
  ON lead_offers(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_lead_offers_tenant_created
  ON lead_offers(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_offers_scored_at
  ON lead_offers(scored_at DESC)
  WHERE score_total IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_offers_tenant_offer
  ON lead_offers(tenant_id, offer_id);

-- Index for offers queries
CREATE INDEX IF NOT EXISTS idx_offers_tenant_status
  ON offers(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_offers_tenant_type
  ON offers(tenant_id, offer_type);

CREATE INDEX IF NOT EXISTS idx_offers_city
  ON offers(city)
  WHERE city IS NOT NULL;

-- Index for tenant_members queries
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_status
  ON tenant_members(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user_status
  ON tenant_members(user_id, status);

-- Index for deliveries queries
CREATE INDEX IF NOT EXISTS idx_deliveries_status_tenant
  ON deliveries(status, tenant_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_lead_offer
  ON deliveries(lead_offer_id);

-- Index for credit_ledger queries (for balance calculations)
CREATE INDEX IF NOT EXISTS idx_credit_ledger_tenant_created
  ON credit_ledger(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_tenant_type
  ON credit_ledger(tenant_id, transaction_type);

-- Index for conversations queries
CREATE INDEX IF NOT EXISTS idx_conversations_lead_created
  ON conversations(lead_offer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant
  ON conversations(tenant_id);

-- Index for messages queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at ASC);

-- Index for ad_mappings queries
CREATE INDEX IF NOT EXISTS idx_ad_mappings_tenant_status
  ON ad_mappings(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ad_mappings_ad_id
  ON ad_mappings(ad_id);

-- Index for knowledge_documents queries (RAG)
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tenant_offer
  ON knowledge_documents(tenant_id, offer_id)
  WHERE offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_status
  ON knowledge_documents(status);

-- Phone normalization index for faster lead lookups
CREATE INDEX IF NOT EXISTS idx_leads_phone_normalized
  ON leads(phone_normalized);

-- Index for lead_sources (deduplication)
CREATE INDEX IF NOT EXISTS idx_lead_sources_composite
  ON lead_sources(tenant_id, lead_id, ad_id, created_at DESC);

COMMIT;

-- ============================================
-- Create materialized view for tenant stats
-- This eliminates N+1 queries for tenant dashboard
-- ============================================

BEGIN;

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS tenant_stats_mv CASCADE;

-- Create materialized view with all tenant statistics
CREATE MATERIALIZED VIEW tenant_stats_mv AS
SELECT
  t.id as tenant_id,
  t.name,
  t.slug,
  t.status,
  t.created_at,
  COALESCE(tcb.current_balance, 0) as credit_balance,
  COUNT(DISTINCT lo.id) as leads_count,
  COUNT(DISTINCT o.id) as offers_count,
  COUNT(DISTINCT tm.id) FILTER (WHERE tm.status = 'ACTIVE') as members_count,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'QUALIFIED') as qualified_leads_count,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'DELIVERED') as delivered_leads_count,
  MAX(lo.created_at) as last_lead_at,
  MAX(lo.scored_at) as last_scored_at
FROM tenants t
LEFT JOIN tenant_credit_balance tcb ON tcb.tenant_id = t.id
LEFT JOIN lead_offers lo ON lo.tenant_id = t.id
LEFT JOIN offers o ON o.tenant_id = t.id
LEFT JOIN tenant_members tm ON tm.tenant_id = t.id
GROUP BY t.id, t.name, t.slug, t.status, t.created_at, tcb.current_balance;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_tenant_stats_mv_tenant_id ON tenant_stats_mv(tenant_id);

-- Create index for common filters
CREATE INDEX idx_tenant_stats_mv_status ON tenant_stats_mv(status);

COMMIT;

-- ============================================
-- Function to refresh tenant stats
-- Call this periodically (e.g., every 5 minutes via cron)
-- ============================================

CREATE OR REPLACE FUNCTION refresh_tenant_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_stats_mv;
END;
$$;

-- Grant permissions
GRANT SELECT ON tenant_stats_mv TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_tenant_stats() TO service_role;

COMMENT ON MATERIALIZED VIEW tenant_stats_mv IS
'Materialized view containing tenant statistics. Refresh every 5 minutes via cron job.';

COMMENT ON FUNCTION refresh_tenant_stats() IS
'Refreshes the tenant_stats_mv materialized view. Should be called via cron every 5 minutes.';
