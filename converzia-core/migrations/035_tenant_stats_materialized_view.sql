-- ============================================
-- Migration: Tenant Stats Materialized View
-- Description: Creates materialized view for tenant statistics to optimize
--              admin dashboard queries and avoid N+1 query problems
-- ============================================

-- ============================================
-- MATERIALIZED VIEW: Tenant Stats
-- Aggregates tenant statistics for fast dashboard loading
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS tenant_stats_mv AS
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.status AS tenant_status,
  t.created_at AS tenant_created_at,
  
  -- Credit balance (from view)
  COALESCE(tcb.current_balance, 0) AS current_credits,
  
  -- Lead counts
  COUNT(DISTINCT lo.id) AS total_leads,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'TO_BE_CONTACTED') AS to_be_contacted,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status IN ('CONTACTED', 'ENGAGED', 'QUALIFYING')) AS in_progress,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'LEAD_READY') AS lead_ready,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER') AS delivered,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'DISQUALIFIED') AS disqualified,
  
  -- Offer counts
  COUNT(DISTINCT o.id) AS total_offers,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'ACTIVE') AS active_offers,
  
  -- Team member counts
  COUNT(DISTINCT tm.id) FILTER (WHERE tm.status = 'ACTIVE') AS active_members,
  
  -- Today's metrics
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.created_at >= CURRENT_DATE) AS leads_today,
  COUNT(DISTINCT d.id) FILTER (WHERE d.delivered_at >= CURRENT_DATE AND d.status = 'DELIVERED') AS delivered_today,
  
  -- 7-day metrics
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.created_at >= CURRENT_DATE - INTERVAL '7 days') AS leads_7d,
  COUNT(DISTINCT d.id) FILTER (WHERE d.delivered_at >= CURRENT_DATE - INTERVAL '7 days' AND d.status = 'DELIVERED') AS delivered_7d,
  
  -- 30-day metrics
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.created_at >= CURRENT_DATE - INTERVAL '30 days') AS leads_30d,
  COUNT(DISTINCT d.id) FILTER (WHERE d.delivered_at >= CURRENT_DATE - INTERVAL '30 days' AND d.status = 'DELIVERED') AS delivered_30d,
  
  -- Last updated timestamp
  NOW() AS last_refreshed_at

FROM tenants t
LEFT JOIN tenant_credit_balance tcb ON tcb.tenant_id = t.id
LEFT JOIN lead_offers lo ON lo.tenant_id = t.id
LEFT JOIN offers o ON o.tenant_id = t.id
LEFT JOIN tenant_members tm ON tm.tenant_id = t.id
LEFT JOIN deliveries d ON d.tenant_id = t.id
GROUP BY t.id, t.name, t.status, t.created_at, tcb.current_balance;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_stats_mv_tenant_id 
  ON tenant_stats_mv(tenant_id);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_tenant_stats_mv_status 
  ON tenant_stats_mv(tenant_status);

-- Enable RLS on materialized view (via security definer function)
-- Materialized views don't support RLS directly, so we'll use a function

COMMENT ON MATERIALIZED VIEW tenant_stats_mv IS 
  'Materialized view aggregating tenant statistics for fast dashboard queries. Refresh daily via cron job. Access via get_tenant_stats() function for RLS enforcement.';

-- ============================================
-- Function: Get tenant stats with RLS enforcement
-- ============================================
CREATE OR REPLACE FUNCTION get_tenant_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_status TEXT,
  tenant_created_at TIMESTAMPTZ,
  current_credits NUMERIC,
  total_leads BIGINT,
  to_be_contacted BIGINT,
  in_progress BIGINT,
  lead_ready BIGINT,
  delivered BIGINT,
  disqualified BIGINT,
  total_offers BIGINT,
  active_offers BIGINT,
  active_members BIGINT,
  leads_today BIGINT,
  delivered_today BIGINT,
  leads_7d BIGINT,
  delivered_7d BIGINT,
  leads_30d BIGINT,
  delivered_30d BIGINT,
  last_refreshed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tsm.tenant_id,
    tsm.tenant_name::TEXT,
    tsm.tenant_status::TEXT,
    tsm.tenant_created_at,
    tsm.current_credits,
    tsm.total_leads,
    tsm.to_be_contacted,
    tsm.in_progress,
    tsm.lead_ready,
    tsm.delivered,
    tsm.disqualified,
    tsm.total_offers,
    tsm.active_offers,
    tsm.active_members,
    tsm.leads_today,
    tsm.delivered_today,
    tsm.leads_7d,
    tsm.delivered_7d,
    tsm.leads_30d,
    tsm.delivered_30d,
    tsm.last_refreshed_at
  FROM tenant_stats_mv tsm
  WHERE 
    -- Admin can see all
    is_converzia_admin(auth.uid())
    -- Or user can see their tenant's stats
    OR (
      (p_tenant_id IS NULL AND tsm.tenant_id IN (SELECT get_user_tenants(auth.uid())))
      OR (p_tenant_id IS NOT NULL AND tsm.tenant_id = p_tenant_id AND tsm.tenant_id IN (SELECT get_user_tenants(auth.uid())))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_tenant_stats IS 
  'Returns tenant statistics from materialized view with RLS enforcement. Admins see all, tenants see only their own.';

-- ============================================
-- Function: Refresh tenant stats materialized view
-- ============================================
CREATE OR REPLACE FUNCTION refresh_tenant_stats_mv()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_stats_mv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION refresh_tenant_stats_mv IS 
  'Refreshes the tenant_stats_mv materialized view. Should be called daily via cron job.';

-- Initial refresh (non-concurrent for first time)
REFRESH MATERIALIZED VIEW tenant_stats_mv;

-- ============================================
-- RLS Policies for Materialized View
-- Note: Materialized views don't support RLS directly
-- Access should be via get_tenant_stats() function or admin client
-- ============================================
-- For direct access, we'll rely on the fact that only admins should access it
-- Regular users should use get_tenant_stats() function which enforces RLS
