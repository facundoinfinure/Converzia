-- ============================================
-- Migration 036: Fix Funnel Stats Views
-- 
-- Problem: The leads_in_chat and leads_stopped counts were missing
-- HUMAN_HANDOFF and REACTIVATION statuses, causing inconsistencies
-- between the stats shown and actual lead counts.
-- ============================================

-- ============================================
-- 1. RECREATE offer_funnel_stats VIEW
-- Now includes HUMAN_HANDOFF in leads_in_chat and REACTIVATION in not_qualified
-- ============================================

CREATE OR REPLACE VIEW offer_funnel_stats AS
SELECT 
  o.id AS offer_id,
  o.tenant_id,
  o.name AS offer_name,
  o.status AS offer_status,
  o.approval_status,
  
  -- Funnel counts (FIXED: added missing statuses)
  COUNT(lo.id) AS total_leads,
  COUNT(lo.id) FILTER (WHERE lo.status = 'PENDING_MAPPING') AS leads_pending_mapping,
  COUNT(lo.id) FILTER (WHERE lo.status = 'TO_BE_CONTACTED') AS leads_pending_contact,
  -- FIXED: Added HUMAN_HANDOFF to leads_in_chat
  COUNT(lo.id) FILTER (WHERE lo.status IN ('CONTACTED', 'ENGAGED', 'QUALIFYING', 'HUMAN_HANDOFF')) AS leads_in_chat,
  COUNT(lo.id) FILTER (WHERE lo.status IN ('SCORED', 'LEAD_READY')) AS leads_qualified,
  COUNT(lo.id) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER') AS leads_delivered,
  COUNT(lo.id) FILTER (WHERE lo.status = 'DISQUALIFIED') AS leads_disqualified,
  -- FIXED: Added REACTIVATION to leads_stopped (not_qualified category)
  COUNT(lo.id) FILTER (WHERE lo.status IN ('STOPPED', 'COOLING', 'REACTIVATION')) AS leads_stopped,
  
  -- Disqualification breakdown
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'PRICE_TOO_HIGH') AS dq_price_high,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'PRICE_TOO_LOW') AS dq_price_low,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'WRONG_ZONE') AS dq_wrong_zone,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'WRONG_TYPOLOGY') AS dq_wrong_typology,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'NO_RESPONSE') AS dq_no_response,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'NOT_INTERESTED') AS dq_not_interested,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'MISSING_AMENITY') AS dq_missing_amenity,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'DUPLICATE') AS dq_duplicate,
  COUNT(lo.id) FILTER (WHERE lo.disqualification_category = 'OTHER') AS dq_other,
  
  -- Conversion rates (avoid division by zero)
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

-- Grant access to the view
GRANT SELECT ON offer_funnel_stats TO authenticated;

-- ============================================
-- 2. RECREATE tenant_funnel_stats VIEW
-- This view aggregates from offer_funnel_stats, so it will automatically
-- pick up the fixed counts. But we recreate it to ensure consistency.
-- ============================================

CREATE OR REPLACE VIEW tenant_funnel_stats AS
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  
  -- Funnel counts across all offers
  COALESCE(SUM(fs.total_leads), 0) AS total_leads,
  COALESCE(SUM(fs.leads_pending_mapping), 0) AS leads_pending_mapping,
  COALESCE(SUM(fs.leads_pending_contact), 0) AS leads_pending_contact,
  COALESCE(SUM(fs.leads_in_chat), 0) AS leads_in_chat,
  COALESCE(SUM(fs.leads_qualified), 0) AS leads_qualified,
  COALESCE(SUM(fs.leads_delivered), 0) AS leads_delivered,
  COALESCE(SUM(fs.leads_disqualified), 0) AS leads_disqualified,
  COALESCE(SUM(fs.leads_stopped), 0) AS leads_stopped,
  
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

-- Grant access to the view
GRANT SELECT ON tenant_funnel_stats TO authenticated;

-- ============================================
-- 3. Add comment for documentation
-- ============================================

COMMENT ON VIEW offer_funnel_stats IS 
'Funnel statistics per offer. leads_in_chat includes CONTACTED, ENGAGED, QUALIFYING, and HUMAN_HANDOFF. leads_stopped includes STOPPED, COOLING, and REACTIVATION.';

COMMENT ON VIEW tenant_funnel_stats IS 
'Aggregated funnel statistics per tenant across all offers. Inherits status groupings from offer_funnel_stats.';
