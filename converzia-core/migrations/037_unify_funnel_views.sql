-- ============================================
-- Migration 037: Unify Funnel Stats Views
-- 
-- This migration updates the funnel stats views to be consistent
-- with TENANT_FUNNEL_STAGES in the frontend code.
-- 
-- Changes:
-- 1. Add leads_received (pending_mapping + pending_contact)
-- 2. Add leads_not_qualified (disqualified + stopped)
-- 3. Ensure HUMAN_HANDOFF is in leads_in_chat
-- 4. Ensure REACTIVATION is in leads_stopped
-- 
-- NOTE: We must DROP and recreate views because PostgreSQL doesn't allow
-- changing column order with CREATE OR REPLACE VIEW.
-- ============================================

-- ============================================
-- 0. DROP existing views in dependency order
-- tenant_funnel_stats depends on offer_funnel_stats, so drop it first
-- ============================================

DROP VIEW IF EXISTS tenant_funnel_stats CASCADE;
DROP VIEW IF EXISTS offer_funnel_stats CASCADE;

-- ============================================
-- 1. CREATE offer_funnel_stats VIEW
-- Now includes computed columns for consistency with frontend
-- ============================================

CREATE VIEW offer_funnel_stats AS
SELECT 
  o.id AS offer_id,
  o.tenant_id,
  o.name AS offer_name,
  o.status AS offer_status,
  o.approval_status,
  
  -- Total leads
  COUNT(lo.id) AS total_leads,
  
  -- Individual status counts (for detailed breakdown)
  COUNT(lo.id) FILTER (WHERE lo.status = 'PENDING_MAPPING') AS leads_pending_mapping,
  COUNT(lo.id) FILTER (WHERE lo.status = 'TO_BE_CONTACTED') AS leads_pending_contact,
  
  -- COMPUTED: leads_received = pending_mapping + pending_contact
  -- This matches TENANT_FUNNEL_STAGES.received
  COUNT(lo.id) FILTER (WHERE lo.status IN ('PENDING_MAPPING', 'TO_BE_CONTACTED')) AS leads_received,
  
  -- leads_in_chat: CONTACTED, ENGAGED, QUALIFYING, HUMAN_HANDOFF
  -- This matches TENANT_FUNNEL_STAGES.in_chat
  COUNT(lo.id) FILTER (WHERE lo.status IN ('CONTACTED', 'ENGAGED', 'QUALIFYING', 'HUMAN_HANDOFF')) AS leads_in_chat,
  
  -- leads_qualified: SCORED, LEAD_READY
  -- This matches TENANT_FUNNEL_STAGES.qualified
  COUNT(lo.id) FILTER (WHERE lo.status IN ('SCORED', 'LEAD_READY')) AS leads_qualified,
  
  -- leads_delivered: SENT_TO_DEVELOPER
  -- This matches TENANT_FUNNEL_STAGES.delivered
  COUNT(lo.id) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER') AS leads_delivered,
  
  -- Individual disqualification counts
  COUNT(lo.id) FILTER (WHERE lo.status = 'DISQUALIFIED') AS leads_disqualified,
  COUNT(lo.id) FILTER (WHERE lo.status IN ('STOPPED', 'COOLING', 'REACTIVATION')) AS leads_stopped,
  
  -- COMPUTED: leads_not_qualified = disqualified + stopped + cooling + reactivation
  -- This matches TENANT_FUNNEL_STAGES.not_qualified
  COUNT(lo.id) FILTER (WHERE lo.status IN ('DISQUALIFIED', 'STOPPED', 'COOLING', 'REACTIVATION')) AS leads_not_qualified,
  
  -- Disqualification breakdown (unchanged)
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'PRICE_TOO_HIGH') AS dq_price_high,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'PRICE_TOO_LOW') AS dq_price_low,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'WRONG_ZONE') AS dq_wrong_zone,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'WRONG_TYPOLOGY') AS dq_wrong_typology,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'NO_RESPONSE') AS dq_no_response,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'NOT_INTERESTED') AS dq_not_interested,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'MISSING_AMENITY') AS dq_missing_amenity,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'DUPLICATE') AS dq_duplicate,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'OTHER') AS dq_other,
  
  -- Conversion rate (delivered / total)
  CASE 
    WHEN COUNT(lo.id) > 0 THEN 
      ROUND((COUNT(lo.id) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER')::NUMERIC / COUNT(lo.id)) * 100, 2)
    ELSE 0 
  END AS conversion_rate,
  
  -- Time range
  MIN(lo.created_at) AS first_lead_at,
  MAX(lo.created_at) AS last_lead_at

FROM offers o
LEFT JOIN lead_offers lo ON lo.offer_id = o.id
GROUP BY o.id, o.tenant_id, o.name, o.status, o.approval_status;

-- Grant access
GRANT SELECT ON offer_funnel_stats TO authenticated;

-- ============================================
-- 2. CREATE tenant_funnel_stats VIEW
-- Aggregates from offer_funnel_stats with new computed columns
-- ============================================

CREATE VIEW tenant_funnel_stats AS
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  
  -- Total leads
  COALESCE(SUM(fs.total_leads), 0) AS total_leads,
  
  -- Individual counts (for backward compatibility)
  COALESCE(SUM(fs.leads_pending_mapping), 0) AS leads_pending_mapping,
  COALESCE(SUM(fs.leads_pending_contact), 0) AS leads_pending_contact,
  
  -- COMPUTED: leads_received - matches TENANT_FUNNEL_STAGES.received
  COALESCE(SUM(fs.leads_received), 0) AS leads_received,
  
  -- leads_in_chat - matches TENANT_FUNNEL_STAGES.in_chat
  COALESCE(SUM(fs.leads_in_chat), 0) AS leads_in_chat,
  
  -- leads_qualified - matches TENANT_FUNNEL_STAGES.qualified
  COALESCE(SUM(fs.leads_qualified), 0) AS leads_qualified,
  
  -- leads_delivered - matches TENANT_FUNNEL_STAGES.delivered
  COALESCE(SUM(fs.leads_delivered), 0) AS leads_delivered,
  
  -- Individual disqualification counts (for backward compatibility)
  COALESCE(SUM(fs.leads_disqualified), 0) AS leads_disqualified,
  COALESCE(SUM(fs.leads_stopped), 0) AS leads_stopped,
  
  -- COMPUTED: leads_not_qualified - matches TENANT_FUNNEL_STAGES.not_qualified
  COALESCE(SUM(fs.leads_not_qualified), 0) AS leads_not_qualified,
  
  -- Disqualification totals
  COALESCE(SUM(fs.dq_price_high), 0) AS dq_price_high,
  COALESCE(SUM(fs.dq_price_low), 0) AS dq_price_low,
  COALESCE(SUM(fs.dq_wrong_zone), 0) AS dq_wrong_zone,
  COALESCE(SUM(fs.dq_wrong_typology), 0) AS dq_wrong_typology,
  COALESCE(SUM(fs.dq_no_response), 0) AS dq_no_response,
  COALESCE(SUM(fs.dq_not_interested), 0) AS dq_not_interested,
  COALESCE(SUM(fs.dq_missing_amenity), 0) AS dq_missing_amenity,
  COALESCE(SUM(fs.dq_duplicate), 0) AS dq_duplicate,
  COALESCE(SUM(fs.dq_other), 0) AS dq_other,
  
  -- Overall conversion rate
  CASE 
    WHEN COALESCE(SUM(fs.total_leads), 0) > 0 THEN 
      ROUND((COALESCE(SUM(fs.leads_delivered), 0)::NUMERIC / SUM(fs.total_leads)) * 100, 2)
    ELSE 0 
  END AS conversion_rate,
  
  -- Credit balance from tenant_credit_balance view
  COALESCE(cb.current_balance, 0) AS credit_balance,
  
  -- Active offers count
  COUNT(DISTINCT fs.offer_id) FILTER (WHERE fs.offer_status = 'ACTIVE') AS active_offers_count

FROM tenants t
LEFT JOIN offer_funnel_stats fs ON fs.tenant_id = t.id
LEFT JOIN tenant_credit_balance cb ON cb.tenant_id = t.id
GROUP BY t.id, t.name, cb.current_balance;

-- Grant access
GRANT SELECT ON tenant_funnel_stats TO authenticated;

-- ============================================
-- 3. Add comments for documentation
-- ============================================

COMMENT ON VIEW offer_funnel_stats IS 
'Funnel statistics per offer. 
Columns match TENANT_FUNNEL_STAGES in frontend:
- leads_received: PENDING_MAPPING, TO_BE_CONTACTED
- leads_in_chat: CONTACTED, ENGAGED, QUALIFYING, HUMAN_HANDOFF
- leads_qualified: SCORED, LEAD_READY
- leads_delivered: SENT_TO_DEVELOPER
- leads_not_qualified: DISQUALIFIED, STOPPED, COOLING, REACTIVATION';

COMMENT ON VIEW tenant_funnel_stats IS 
'Aggregated funnel statistics per tenant. 
Inherits column definitions from offer_funnel_stats.
Includes credit_balance and active_offers_count.';

-- ============================================
-- 4. Verification query (for testing)
-- Run this after migration to verify consistency:
--
-- SELECT 
--   tenant_id,
--   total_leads,
--   leads_received + leads_in_chat + leads_qualified + leads_delivered + leads_not_qualified AS computed_total,
--   CASE 
--     WHEN total_leads = (leads_received + leads_in_chat + leads_qualified + leads_delivered + leads_not_qualified)
--     THEN 'OK'
--     ELSE 'MISMATCH'
--   END AS verification
-- FROM tenant_funnel_stats;
-- ============================================
