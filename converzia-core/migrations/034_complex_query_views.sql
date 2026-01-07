-- ============================================
-- Converzia: Complex Query Views
-- Migration: 034_complex_query_views
-- ============================================
-- 
-- This migration creates views for frequently used complex queries
-- to improve performance and maintainability.

-- ============================================
-- VIEW: Lead Pipeline Summary
-- Used by: Admin dashboard, tenant portal
-- ============================================
-- Note: lead_offer_status enum values:
-- PENDING_MAPPING, TO_BE_CONTACTED, CONTACTED, ENGAGED, QUALIFYING, 
-- SCORED, LEAD_READY, SENT_TO_DEVELOPER, COOLING, REACTIVATION, 
-- DISQUALIFIED, STOPPED, HUMAN_HANDOFF
CREATE OR REPLACE VIEW lead_pipeline_summary AS
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  COUNT(DISTINCT l.id) AS total_leads,
  COUNT(DISTINCT CASE WHEN lo.status = 'TO_BE_CONTACTED' THEN lo.id END) AS pending_contact,
  COUNT(DISTINCT CASE WHEN lo.status = 'CONTACTED' THEN lo.id END) AS contacted,
  COUNT(DISTINCT CASE WHEN lo.status = 'QUALIFYING' THEN lo.id END) AS qualifying,
  COUNT(DISTINCT CASE WHEN lo.status = 'SCORED' THEN lo.id END) AS scored,
  COUNT(DISTINCT CASE WHEN lo.status = 'LEAD_READY' THEN lo.id END) AS lead_ready,
  COUNT(DISTINCT CASE WHEN lo.status = 'SENT_TO_DEVELOPER' THEN lo.id END) AS sent_to_developer,
  COUNT(DISTINCT CASE WHEN lo.status = 'COOLING' THEN lo.id END) AS cooling,
  COUNT(DISTINCT CASE WHEN lo.status = 'DISQUALIFIED' THEN lo.id END) AS disqualified
FROM tenants t
LEFT JOIN offers o ON o.tenant_id = t.id
LEFT JOIN lead_offers lo ON lo.offer_id = o.id
LEFT JOIN leads l ON l.id = lo.lead_id
WHERE t.status = 'ACTIVE'
GROUP BY t.id, t.name;

COMMENT ON VIEW lead_pipeline_summary IS 'Aggregated lead pipeline counts by tenant for dashboard display';

-- ============================================
-- VIEW: Recent Deliveries with Details
-- Used by: Admin operations, tenant portal
-- ============================================
CREATE OR REPLACE VIEW recent_deliveries_detail AS
SELECT 
  d.id AS delivery_id,
  d.tenant_id,
  t.name AS tenant_name,
  d.status,
  d.created_at,
  d.delivered_at,
  d.error_message,
  d.retry_count,
  l.phone AS lead_phone,
  l.full_name AS lead_name,
  o.name AS offer_name,
  lo.score_total AS qualification_score
FROM deliveries d
JOIN tenants t ON t.id = d.tenant_id
LEFT JOIN lead_offers lo ON lo.id = d.lead_offer_id
LEFT JOIN leads l ON l.id = lo.lead_id
LEFT JOIN offers o ON o.id = lo.offer_id
WHERE d.created_at > NOW() - INTERVAL '30 days'
ORDER BY d.created_at DESC;

COMMENT ON VIEW recent_deliveries_detail IS 'Recent deliveries with all related entity details for operations dashboard';

-- ============================================
-- VIEW: Tenant Billing Summary
-- Used by: Admin revenue, tenant billing
-- ============================================
-- Note: credit_transaction_type enum values:
-- CREDIT_PURCHASE, CREDIT_CONSUMPTION, CREDIT_REFUND, CREDIT_ADJUSTMENT, CREDIT_BONUS
CREATE OR REPLACE VIEW tenant_billing_summary AS
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.status AS tenant_status,
  COALESCE(SUM(CASE WHEN cl.transaction_type IN ('CREDIT_PURCHASE', 'CREDIT_BONUS', 'CREDIT_REFUND') THEN cl.amount ELSE 0 END), 0) AS total_credits_received,
  COALESCE(SUM(CASE WHEN cl.transaction_type = 'CREDIT_CONSUMPTION' THEN ABS(cl.amount) ELSE 0 END), 0) AS total_credits_consumed,
  COALESCE(
    (SELECT SUM(amount) FROM credit_ledger WHERE tenant_id = t.id),
    0
  ) AS current_balance,
  COALESCE(
    (SELECT SUM(bo.total) 
     FROM billing_orders bo 
     WHERE bo.tenant_id = t.id AND bo.status = 'completed'),
    0
  ) AS total_revenue,
  COUNT(DISTINCT lo.id) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER') AS leads_sent,
  t.trial_credits_granted,
  t.trial_credits_amount
FROM tenants t
LEFT JOIN credit_ledger cl ON cl.tenant_id = t.id
LEFT JOIN offers o ON o.tenant_id = t.id
LEFT JOIN lead_offers lo ON lo.offer_id = o.id
GROUP BY t.id, t.name, t.status, t.trial_credits_granted, t.trial_credits_amount;

COMMENT ON VIEW tenant_billing_summary IS 'Consolidated billing metrics per tenant for revenue analysis';

-- ============================================
-- VIEW: Integration Status Overview
-- Used by: Admin settings, integrations dashboard
-- ============================================
CREATE OR REPLACE VIEW integration_status_overview AS
SELECT 
  ti.id AS integration_id,
  ti.tenant_id,
  t.name AS tenant_name,
  ti.integration_type,
  ti.name AS integration_name,
  ti.status,
  ti.is_active,
  ti.created_at,
  ti.updated_at,
  ti.last_sync_at,
  ti.last_error,
  CASE 
    WHEN ti.oauth_tokens IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END AS has_oauth_tokens,
  CASE 
    WHEN ti.oauth_tokens->>'expires_at' IS NOT NULL 
         AND (ti.oauth_tokens->>'expires_at')::bigint < EXTRACT(EPOCH FROM NOW()) * 1000 
    THEN TRUE 
    ELSE FALSE 
  END AS token_expired
FROM tenant_integrations ti
LEFT JOIN tenants t ON t.id = ti.tenant_id
ORDER BY ti.updated_at DESC;

COMMENT ON VIEW integration_status_overview IS 'Quick overview of all integrations with token status';

-- ============================================
-- VIEW: Offer Performance Metrics
-- Used by: Admin analytics, tenant reports
-- ============================================
CREATE OR REPLACE VIEW offer_performance_metrics AS
SELECT 
  o.id AS offer_id,
  o.tenant_id,
  t.name AS tenant_name,
  o.name AS offer_name,
  o.status,
  o.offer_type,
  COUNT(DISTINCT lo.id) AS total_leads,
  COUNT(DISTINCT CASE WHEN lo.status = 'SENT_TO_DEVELOPER' THEN lo.id END) AS sent_leads,
  COUNT(DISTINCT CASE WHEN lo.status = 'LEAD_READY' THEN lo.id END) AS ready_leads,
  COUNT(DISTINCT CASE WHEN lo.status = 'DISQUALIFIED' THEN lo.id END) AS disqualified_leads,
  AVG(lo.score_total) AS avg_score,
  CASE 
    WHEN COUNT(DISTINCT lo.id) > 0 
    THEN ROUND(
      (COUNT(DISTINCT CASE WHEN lo.status = 'SENT_TO_DEVELOPER' THEN lo.id END)::numeric / 
       COUNT(DISTINCT lo.id)::numeric) * 100, 2
    )
    ELSE 0 
  END AS delivery_rate_pct,
  o.created_at,
  MAX(lo.created_at) AS last_lead_at
FROM offers o
JOIN tenants t ON t.id = o.tenant_id
LEFT JOIN lead_offers lo ON lo.offer_id = o.id
GROUP BY o.id, o.tenant_id, t.name, o.name, o.status, o.offer_type, o.created_at;

COMMENT ON VIEW offer_performance_metrics IS 'Performance metrics per offer for analytics and reporting';

-- ============================================
-- VIEW: Daily Activity Summary
-- Used by: Admin dashboard, daily reports
-- ============================================
CREATE OR REPLACE VIEW daily_activity_summary AS
SELECT 
  DATE(created_at) AS activity_date,
  'lead_created' AS activity_type,
  COUNT(*) AS count
FROM lead_sources
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)

UNION ALL

SELECT 
  DATE(created_at) AS activity_date,
  'delivery_attempted' AS activity_type,
  COUNT(*) AS count
FROM deliveries
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)

UNION ALL

SELECT 
  DATE(created_at) AS activity_date,
  'credit_transaction' AS activity_type,
  COUNT(*) AS count
FROM credit_ledger
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)

ORDER BY activity_date DESC, activity_type;

COMMENT ON VIEW daily_activity_summary IS 'Daily aggregated activity counts for dashboard charts';

-- ============================================
-- Grant permissions
-- ============================================
GRANT SELECT ON lead_pipeline_summary TO authenticated;
GRANT SELECT ON recent_deliveries_detail TO authenticated;
GRANT SELECT ON tenant_billing_summary TO authenticated;
GRANT SELECT ON integration_status_overview TO authenticated;
GRANT SELECT ON offer_performance_metrics TO authenticated;
GRANT SELECT ON daily_activity_summary TO authenticated;
