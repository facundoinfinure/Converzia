-- ============================================
-- Migration: Platform Costs and Revenue Analytics
-- Tracks advertising costs from Meta, TikTok, Google, etc.
-- ============================================

-- Create ad platform enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_platform') THEN
    CREATE TYPE ad_platform AS ENUM ('META', 'TIKTOK', 'GOOGLE', 'LINKEDIN');
  END IF;
END $$;

-- ============================================
-- Table: Platform Costs
-- Stores cost data synced from ad platforms
-- ============================================
CREATE TABLE IF NOT EXISTS platform_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id) ON DELETE SET NULL,
  
  -- Platform info
  platform ad_platform NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  
  -- Cost data
  spend DECIMAL(12, 2) NOT NULL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  leads_raw INTEGER DEFAULT 0,  -- Leads from platform (before qualification)
  
  -- Period
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  
  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  platform_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint per tenant/platform/ad/date range
  UNIQUE(tenant_id, platform, ad_id, date_start, date_end)
);

CREATE INDEX idx_platform_costs_tenant ON platform_costs(tenant_id);
CREATE INDEX idx_platform_costs_offer ON platform_costs(offer_id);
CREATE INDEX idx_platform_costs_platform ON platform_costs(platform);
CREATE INDEX idx_platform_costs_date ON platform_costs(date_start, date_end);
CREATE INDEX idx_platform_costs_ad ON platform_costs(ad_id);

COMMENT ON TABLE platform_costs IS 'Stores advertising spend data synced from ad platforms (Meta, TikTok, Google, etc.)';

-- ============================================
-- Add META_ADS to integration_type enum
-- ============================================
DO $$ 
BEGIN
  -- Check if META_ADS already exists in integration_type
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'integration_type'::regtype 
    AND enumlabel = 'META_ADS'
  ) THEN
    ALTER TYPE integration_type ADD VALUE 'META_ADS';
  END IF;
END $$;

-- ============================================
-- View: Revenue Analytics
-- Calculates CPL Ready, revenue, and profit
-- ============================================
CREATE OR REPLACE VIEW revenue_analytics AS
WITH lead_counts AS (
  -- Count leads ready and delivered per offer
  SELECT 
    lo.tenant_id,
    lo.offer_id,
    COUNT(*) FILTER (WHERE lo.status = 'LEAD_READY') AS leads_ready,
    COUNT(*) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER') AS leads_delivered
  FROM lead_offers lo
  WHERE lo.offer_id IS NOT NULL
  GROUP BY lo.tenant_id, lo.offer_id
),
platform_spend AS (
  -- Aggregate spend per tenant/offer
  SELECT 
    pc.tenant_id,
    pc.offer_id,
    pc.platform,
    SUM(pc.spend) AS total_spend,
    SUM(pc.impressions) AS total_impressions,
    SUM(pc.clicks) AS total_clicks,
    SUM(pc.leads_raw) AS total_leads_raw
  FROM platform_costs pc
  GROUP BY pc.tenant_id, pc.offer_id, pc.platform
)
SELECT 
  COALESCE(ps.tenant_id, lc.tenant_id) AS tenant_id,
  t.name AS tenant_name,
  COALESCE(ps.offer_id, lc.offer_id) AS offer_id,
  o.name AS offer_name,
  ps.platform,
  
  -- Platform metrics
  COALESCE(ps.total_spend, 0) AS platform_spend,
  COALESCE(ps.total_impressions, 0) AS impressions,
  COALESCE(ps.total_clicks, 0) AS clicks,
  COALESCE(ps.total_leads_raw, 0) AS leads_raw,
  
  -- Converzia metrics
  COALESCE(lc.leads_ready, 0) AS leads_ready,
  COALESCE(lc.leads_delivered, 0) AS leads_delivered,
  
  -- Pricing
  tp.cost_per_lead,
  
  -- Revenue (leads delivered * CPL charged to tenant)
  COALESCE(lc.leads_delivered, 0) * COALESCE(tp.cost_per_lead, 0) AS revenue,
  
  -- CPL Ready (our actual cost per qualified lead)
  CASE 
    WHEN COALESCE(lc.leads_ready, 0) > 0 
    THEN ROUND(COALESCE(ps.total_spend, 0) / lc.leads_ready, 2)
    ELSE 0 
  END AS cpl_ready,
  
  -- CPL Raw (cost per lead from platform)
  CASE 
    WHEN COALESCE(ps.total_leads_raw, 0) > 0 
    THEN ROUND(COALESCE(ps.total_spend, 0) / ps.total_leads_raw, 2)
    ELSE 0 
  END AS cpl_raw,
  
  -- Profit (revenue - platform spend)
  (COALESCE(lc.leads_delivered, 0) * COALESCE(tp.cost_per_lead, 0)) - COALESCE(ps.total_spend, 0) AS profit,
  
  -- Margin percentage
  CASE 
    WHEN COALESCE(lc.leads_delivered, 0) * COALESCE(tp.cost_per_lead, 0) > 0
    THEN ROUND(
      ((COALESCE(lc.leads_delivered, 0) * COALESCE(tp.cost_per_lead, 0)) - COALESCE(ps.total_spend, 0)) 
      / (COALESCE(lc.leads_delivered, 0) * COALESCE(tp.cost_per_lead, 0)) * 100, 
      1
    )
    ELSE 0
  END AS margin_pct

FROM platform_spend ps
FULL OUTER JOIN lead_counts lc ON ps.tenant_id = lc.tenant_id AND ps.offer_id = lc.offer_id
LEFT JOIN tenants t ON t.id = COALESCE(ps.tenant_id, lc.tenant_id)
LEFT JOIN offers o ON o.id = COALESCE(ps.offer_id, lc.offer_id)
LEFT JOIN tenant_pricing tp ON tp.tenant_id = COALESCE(ps.tenant_id, lc.tenant_id);

COMMENT ON VIEW revenue_analytics IS 'Analytics view for revenue, costs, and profit calculation per tenant/offer';

-- ============================================
-- View: Company Revenue Summary
-- Aggregate metrics at company level
-- ============================================
CREATE OR REPLACE VIEW company_revenue_summary AS
SELECT 
  SUM(platform_spend) AS total_spend,
  SUM(revenue) AS total_revenue,
  SUM(profit) AS total_profit,
  SUM(leads_raw) AS total_leads_raw,
  SUM(leads_ready) AS total_leads_ready,
  SUM(leads_delivered) AS total_leads_delivered,
  CASE 
    WHEN SUM(leads_ready) > 0 
    THEN ROUND(SUM(platform_spend) / SUM(leads_ready), 2)
    ELSE 0 
  END AS avg_cpl_ready,
  CASE 
    WHEN SUM(revenue) > 0
    THEN ROUND((SUM(profit) / SUM(revenue)) * 100, 1)
    ELSE 0
  END AS avg_margin_pct
FROM revenue_analytics;

COMMENT ON VIEW company_revenue_summary IS 'Company-wide revenue and cost summary';

