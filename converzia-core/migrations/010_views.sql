-- ============================================
-- Converzia: Views for Analytics & Reporting
-- Migration: 010_views
-- ============================================

-- ============================================
-- VIEW: Lead Pipeline Stats (for tenant dashboard)
-- Returns counts only, no PII
-- ============================================
CREATE OR REPLACE VIEW lead_pipeline_stats AS
SELECT 
  lo.tenant_id,
  lo.status,
  COUNT(*) AS count,
  DATE_TRUNC('day', lo.created_at) AS date
FROM lead_offers lo
GROUP BY lo.tenant_id, lo.status, DATE_TRUNC('day', lo.created_at);

-- ============================================
-- VIEW: Tenant Dashboard Metrics
-- ============================================
CREATE OR REPLACE VIEW tenant_dashboard_metrics AS
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  
  -- Credits
  COALESCE(get_tenant_credits(t.id), 0) AS current_credits,
  tp.low_credit_threshold,
  
  -- Lead counts
  (SELECT COUNT(*) FROM lead_offers lo WHERE lo.tenant_id = t.id) AS total_leads,
  (SELECT COUNT(*) FROM lead_offers lo WHERE lo.tenant_id = t.id AND lo.status = 'TO_BE_CONTACTED') AS to_be_contacted,
  (SELECT COUNT(*) FROM lead_offers lo WHERE lo.tenant_id = t.id AND lo.status IN ('CONTACTED', 'ENGAGED', 'QUALIFYING')) AS in_progress,
  (SELECT COUNT(*) FROM lead_offers lo WHERE lo.tenant_id = t.id AND lo.status = 'LEAD_READY') AS lead_ready,
  (SELECT COUNT(*) FROM lead_offers lo WHERE lo.tenant_id = t.id AND lo.status = 'SENT_TO_DEVELOPER') AS delivered,
  
  -- Today's metrics
  (SELECT COUNT(*) FROM lead_offers lo WHERE lo.tenant_id = t.id AND lo.created_at >= CURRENT_DATE) AS leads_today,
  (SELECT COUNT(*) FROM deliveries d WHERE d.tenant_id = t.id AND d.delivered_at >= CURRENT_DATE AND d.status = 'DELIVERED') AS delivered_today,
  
  -- 7-day metrics
  (SELECT COUNT(*) FROM lead_offers lo WHERE lo.tenant_id = t.id AND lo.created_at >= CURRENT_DATE - INTERVAL '7 days') AS leads_7d,
  (SELECT COUNT(*) FROM deliveries d WHERE d.tenant_id = t.id AND d.delivered_at >= CURRENT_DATE - INTERVAL '7 days' AND d.status = 'DELIVERED') AS delivered_7d

FROM tenants t
LEFT JOIN tenant_pricing tp ON tp.tenant_id = t.id
WHERE t.status = 'ACTIVE';

-- ============================================
-- VIEW: Offer Performance
-- ============================================
CREATE OR REPLACE VIEW offer_performance AS
SELECT 
  o.id AS offer_id,
  o.tenant_id,
  o.name AS offer_name,
  o.status AS offer_status,
  
  -- Lead counts by status
  COUNT(lo.id) AS total_leads,
  COUNT(lo.id) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER') AS delivered_leads,
  COUNT(lo.id) FILTER (WHERE lo.status = 'DISQUALIFIED') AS disqualified_leads,
  COUNT(lo.id) FILTER (WHERE lo.status IN ('CONTACTED', 'ENGAGED', 'QUALIFYING', 'SCORED', 'LEAD_READY')) AS active_leads,
  
  -- Conversion rate
  CASE 
    WHEN COUNT(lo.id) > 0 
    THEN ROUND(100.0 * COUNT(lo.id) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER') / COUNT(lo.id), 2)
    ELSE 0 
  END AS conversion_rate,
  
  -- Average score
  AVG(lo.score_total) FILTER (WHERE lo.score_total IS NOT NULL) AS avg_score

FROM offers o
LEFT JOIN lead_offers lo ON lo.offer_id = o.id
GROUP BY o.id, o.tenant_id, o.name, o.status;

-- ============================================
-- VIEW: Unmapped Ads Queue (for Converzia Admin)
-- ============================================
CREATE OR REPLACE VIEW unmapped_ads_queue AS
SELECT DISTINCT ON (ls.ad_id, ls.tenant_id)
  ls.ad_id,
  ls.adset_id,
  ls.campaign_id,
  ls.tenant_id,
  t.name AS tenant_name,
  COUNT(*) OVER (PARTITION BY ls.ad_id, ls.tenant_id) AS lead_count,
  MIN(ls.created_at) OVER (PARTITION BY ls.ad_id, ls.tenant_id) AS first_seen_at,
  MAX(ls.created_at) OVER (PARTITION BY ls.ad_id, ls.tenant_id) AS last_seen_at
FROM lead_sources ls
JOIN tenants t ON t.id = ls.tenant_id
LEFT JOIN ad_offer_map aom ON aom.ad_id = ls.ad_id AND aom.tenant_id = ls.tenant_id
WHERE aom.id IS NULL
  AND ls.ad_id IS NOT NULL
ORDER BY ls.ad_id, ls.tenant_id, ls.created_at DESC;

-- ============================================
-- VIEW: Pending Approvals (for Converzia Admin)
-- ============================================
CREATE OR REPLACE VIEW pending_user_approvals AS
SELECT 
  tm.id AS membership_id,
  tm.tenant_id,
  t.name AS tenant_name,
  tm.user_id,
  up.email AS user_email,
  up.full_name AS user_name,
  tm.role AS requested_role,
  tm.created_at AS requested_at,
  inv.full_name AS invited_by_name,
  inv.email AS invited_by_email
FROM tenant_members tm
JOIN tenants t ON t.id = tm.tenant_id
JOIN user_profiles up ON up.id = tm.user_id
LEFT JOIN user_profiles inv ON inv.id = tm.invited_by
WHERE tm.status = 'PENDING_APPROVAL'
ORDER BY tm.created_at DESC;

-- ============================================
-- VIEW: Refund Queue (grey cases)
-- ============================================
CREATE OR REPLACE VIEW refund_queue AS
SELECT 
  d.id AS delivery_id,
  d.tenant_id,
  t.name AS tenant_name,
  d.lead_id,
  lo.id AS lead_offer_id,
  lo.billing_eligibility,
  lo.billing_notes,
  d.delivered_at,
  d.payload,
  lo.qualification_fields,
  lo.score_total
FROM deliveries d
JOIN tenants t ON t.id = d.tenant_id
JOIN lead_offers lo ON lo.id = d.lead_offer_id
WHERE d.status = 'DELIVERED'
  AND lo.billing_eligibility NOT IN ('CHARGEABLE', 'NOT_CHARGEABLE_DUPLICATE', 'NOT_CHARGEABLE_SPAM')
ORDER BY d.delivered_at DESC;

-- ============================================
-- VIEW: Conversation Health (for QA)
-- ============================================
CREATE OR REPLACE VIEW conversation_health AS
SELECT 
  c.tenant_id,
  t.name AS tenant_name,
  COUNT(DISTINCT c.id) AS total_conversations,
  
  -- Reply rate (conversations with at least one lead reply)
  ROUND(100.0 * COUNT(DISTINCT c.id) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM messages m 
      WHERE m.conversation_id = c.id AND m.direction = 'INBOUND'
    )
  ) / NULLIF(COUNT(DISTINCT c.id), 0), 2) AS reply_rate,
  
  -- Average messages per conversation
  ROUND(AVG(c.message_count), 2) AS avg_messages,
  
  -- Lead ready rate
  ROUND(100.0 * COUNT(DISTINCT lo.id) FILTER (
    WHERE lo.status = 'SENT_TO_DEVELOPER'
  ) / NULLIF(COUNT(DISTINCT lo.id), 0), 2) AS lead_ready_rate

FROM conversations c
JOIN tenants t ON t.id = c.tenant_id
LEFT JOIN lead_offers lo ON lo.lead_id = c.lead_id AND lo.tenant_id = c.tenant_id
WHERE c.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.tenant_id, t.name;

-- ============================================
-- VIEW: Credit Burn Rate
-- ============================================
CREATE OR REPLACE VIEW credit_burn_rate AS
SELECT 
  tenant_id,
  DATE_TRUNC('day', created_at) AS date,
  SUM(CASE WHEN transaction_type = 'CREDIT_CONSUMPTION' THEN ABS(amount) ELSE 0 END) AS consumed,
  SUM(CASE WHEN transaction_type = 'CREDIT_REFUND' THEN amount ELSE 0 END) AS refunded,
  SUM(CASE WHEN transaction_type = 'CREDIT_PURCHASE' THEN amount ELSE 0 END) AS purchased
FROM credit_ledger
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tenant_id, DATE_TRUNC('day', created_at)
ORDER BY tenant_id, date;




