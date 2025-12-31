-- =============================================
-- Migration: Revenue Cache and Cost Attribution
-- Description: Creates tables and functions for caching revenue metrics
--              and attributing costs to individual leads for accurate
--              profit calculation.
-- =============================================

-- ============================================
-- 1. Add attributed_cost column to lead_sources
-- ============================================
ALTER TABLE lead_sources ADD COLUMN IF NOT EXISTS 
  attributed_cost DECIMAL(10,4) DEFAULT NULL;

COMMENT ON COLUMN lead_sources.attributed_cost IS 
  'The attributed advertising cost for this lead, calculated as platform_spend / leads_raw for the corresponding ad and date.';

-- ============================================
-- 2. Create revenue_daily_cache table
-- ============================================
CREATE TABLE IF NOT EXISTS revenue_daily_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_date DATE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Ingresos recibidos (pagos de tenants)
  payments_received DECIMAL(12,2) DEFAULT 0,
  
  -- Valor generado (leads ready)
  leads_ready_count INTEGER DEFAULT 0,
  leads_ready_value DECIMAL(12,2) DEFAULT 0,
  
  -- Leads delivered
  leads_delivered_count INTEGER DEFAULT 0,
  leads_delivered_value DECIMAL(12,2) DEFAULT 0,
  
  -- Gasto atribuido a leads del día
  attributed_spend DECIMAL(12,2) DEFAULT 0,
  
  -- Platform spend total del día (para referencia)
  platform_spend DECIMAL(12,2) DEFAULT 0,
  
  -- Leads raw count
  leads_raw_count INTEGER DEFAULT 0,
  
  -- Metadata
  is_complete BOOLEAN DEFAULT FALSE,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(cache_date, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_revenue_daily_cache_date 
  ON revenue_daily_cache(cache_date);
CREATE INDEX IF NOT EXISTS idx_revenue_daily_cache_tenant 
  ON revenue_daily_cache(tenant_id);
CREATE INDEX IF NOT EXISTS idx_revenue_daily_cache_complete 
  ON revenue_daily_cache(is_complete) WHERE is_complete = FALSE;

COMMENT ON TABLE revenue_daily_cache IS 
  'Caches daily revenue metrics per tenant to avoid expensive recalculations. Days marked is_complete=false (today) are always recalculated.';

-- ============================================
-- 3. Create meta_sync_status table
-- ============================================
CREATE TABLE IF NOT EXISTS meta_sync_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  sync_date DATE NOT NULL,
  
  -- Whether this day's data is complete (past days = true)
  is_complete BOOLEAN DEFAULT FALSE,
  
  -- Number of records synced
  records_synced INTEGER DEFAULT 0,
  
  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, account_id, sync_date)
);

CREATE INDEX IF NOT EXISTS idx_meta_sync_status_date 
  ON meta_sync_status(sync_date);
CREATE INDEX IF NOT EXISTS idx_meta_sync_status_tenant 
  ON meta_sync_status(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_sync_status_incomplete 
  ON meta_sync_status(is_complete) WHERE is_complete = FALSE;

COMMENT ON TABLE meta_sync_status IS 
  'Tracks which days have been synced from Meta Ads API. Days marked is_complete=false need to be re-synced.';

-- ============================================
-- 4. Function: Calculate attributed cost for a lead
-- ============================================
CREATE OR REPLACE FUNCTION calculate_lead_attributed_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_cost DECIMAL(10,4);
BEGIN
  -- Only calculate if ad_id is present
  IF NEW.ad_id IS NOT NULL THEN
    -- Find the cost per lead for this ad on this date
    SELECT 
      CASE 
        WHEN pc.leads_raw > 0 THEN pc.spend / pc.leads_raw 
        ELSE 0 
      END INTO v_cost
    FROM platform_costs pc
    WHERE pc.ad_id = NEW.ad_id
      AND NEW.created_at::date BETWEEN pc.date_start AND pc.date_end
    ORDER BY pc.date_start DESC
    LIMIT 1;
    
    NEW.attributed_cost := COALESCE(v_cost, 0);
  ELSE
    NEW.attributed_cost := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new lead_sources
DROP TRIGGER IF EXISTS trg_calculate_lead_cost ON lead_sources;
CREATE TRIGGER trg_calculate_lead_cost
  BEFORE INSERT ON lead_sources
  FOR EACH ROW
  EXECUTE FUNCTION calculate_lead_attributed_cost();

COMMENT ON FUNCTION calculate_lead_attributed_cost IS 
  'Automatically calculates the attributed advertising cost when a new lead_source is created.';

-- ============================================
-- 5. Function: Calculate and cache daily revenue
-- ============================================
CREATE OR REPLACE FUNCTION calculate_daily_revenue(
  p_date DATE,
  p_tenant_id UUID DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_tenant RECORD;
  v_payments DECIMAL(12,2);
  v_leads_ready_count INTEGER;
  v_leads_ready_value DECIMAL(12,2);
  v_leads_delivered_count INTEGER;
  v_leads_delivered_value DECIMAL(12,2);
  v_attributed_spend DECIMAL(12,2);
  v_platform_spend DECIMAL(12,2);
  v_leads_raw_count INTEGER;
  v_is_complete BOOLEAN;
  v_cpl DECIMAL(10,2);
BEGIN
  -- Determine if this day is complete (past days are complete)
  v_is_complete := (p_date < CURRENT_DATE);
  
  -- Process all tenants or just one
  FOR v_tenant IN 
    SELECT t.id as tenant_id, COALESCE(tp.cost_per_lead, 0) as cost_per_lead
    FROM tenants t
    LEFT JOIN tenant_pricing tp ON tp.tenant_id = t.id
    WHERE (p_tenant_id IS NULL OR t.id = p_tenant_id)
      AND t.status = 'ACTIVE'
  LOOP
    v_cpl := v_tenant.cost_per_lead;
    
    -- 1. Calculate payments received
    SELECT COALESCE(SUM(total), 0) INTO v_payments
    FROM billing_orders
    WHERE tenant_id = v_tenant.tenant_id
      AND status = 'completed'
      AND paid_at::date = p_date;
    
    -- 2. Calculate leads ready count and value
    SELECT 
      COUNT(*),
      COUNT(*) * v_cpl
    INTO v_leads_ready_count, v_leads_ready_value
    FROM lead_offers lo
    WHERE lo.tenant_id = v_tenant.tenant_id
      AND lo.status IN ('LEAD_READY', 'SENT_TO_DEVELOPER')
      AND lo.status_changed_at::date = p_date;
    
    -- 3. Calculate leads delivered
    SELECT 
      COUNT(*),
      COUNT(*) * v_cpl
    INTO v_leads_delivered_count, v_leads_delivered_value
    FROM lead_offers lo
    WHERE lo.tenant_id = v_tenant.tenant_id
      AND lo.status = 'SENT_TO_DEVELOPER'
      AND lo.status_changed_at::date = p_date;
    
    -- 4. Calculate attributed spend (sum of attributed_cost from lead_sources)
    SELECT COALESCE(SUM(ls.attributed_cost), 0) INTO v_attributed_spend
    FROM lead_sources ls
    JOIN lead_offers lo ON lo.lead_source_id = ls.id
    WHERE lo.tenant_id = v_tenant.tenant_id
      AND lo.status IN ('LEAD_READY', 'SENT_TO_DEVELOPER')
      AND lo.status_changed_at::date = p_date;
    
    -- 5. Get platform spend for the day
    SELECT COALESCE(SUM(spend), 0), COALESCE(SUM(leads_raw), 0) 
    INTO v_platform_spend, v_leads_raw_count
    FROM platform_costs
    WHERE tenant_id = v_tenant.tenant_id
      AND date_start = p_date;
    
    -- 6. Upsert cache record
    INSERT INTO revenue_daily_cache (
      cache_date,
      tenant_id,
      payments_received,
      leads_ready_count,
      leads_ready_value,
      leads_delivered_count,
      leads_delivered_value,
      attributed_spend,
      platform_spend,
      leads_raw_count,
      is_complete,
      calculated_at
    ) VALUES (
      p_date,
      v_tenant.tenant_id,
      v_payments,
      v_leads_ready_count,
      v_leads_ready_value,
      v_leads_delivered_count,
      v_leads_delivered_value,
      v_attributed_spend,
      v_platform_spend,
      v_leads_raw_count,
      v_is_complete,
      NOW()
    )
    ON CONFLICT (cache_date, tenant_id) 
    DO UPDATE SET
      payments_received = EXCLUDED.payments_received,
      leads_ready_count = EXCLUDED.leads_ready_count,
      leads_ready_value = EXCLUDED.leads_ready_value,
      leads_delivered_count = EXCLUDED.leads_delivered_count,
      leads_delivered_value = EXCLUDED.leads_delivered_value,
      attributed_spend = EXCLUDED.attributed_spend,
      platform_spend = EXCLUDED.platform_spend,
      leads_raw_count = EXCLUDED.leads_raw_count,
      is_complete = EXCLUDED.is_complete,
      calculated_at = NOW(),
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_daily_revenue IS 
  'Calculates and caches daily revenue metrics for a given date and optional tenant. Call this after syncing platform costs or when leads status changes.';

-- ============================================
-- 6. Function: Get revenue summary for date range
-- ============================================
CREATE OR REPLACE FUNCTION get_revenue_summary(
  p_date_start DATE,
  p_date_end DATE,
  p_tenant_id UUID DEFAULT NULL
) RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  payments_received DECIMAL(12,2),
  leads_ready_count BIGINT,
  leads_ready_value DECIMAL(12,2),
  leads_delivered_count BIGINT,
  leads_delivered_value DECIMAL(12,2),
  attributed_spend DECIMAL(12,2),
  platform_spend DECIMAL(12,2),
  leads_raw_count BIGINT,
  profit DECIMAL(12,2),
  margin_pct DECIMAL(5,2)
) AS $$
BEGIN
  -- First, ensure cache is populated for the date range
  -- Calculate any missing or incomplete days
  PERFORM calculate_daily_revenue(d::date, p_tenant_id)
  FROM generate_series(p_date_start, p_date_end, '1 day'::interval) d
  WHERE NOT EXISTS (
    SELECT 1 FROM revenue_daily_cache rdc 
    WHERE rdc.cache_date = d::date 
      AND (p_tenant_id IS NULL OR rdc.tenant_id = p_tenant_id)
      AND rdc.is_complete = TRUE
  )
  OR d::date = CURRENT_DATE; -- Always recalculate today
  
  -- Return aggregated results
  RETURN QUERY
  SELECT 
    rdc.tenant_id,
    t.name::TEXT as tenant_name,
    SUM(rdc.payments_received)::DECIMAL(12,2) as payments_received,
    SUM(rdc.leads_ready_count)::BIGINT as leads_ready_count,
    SUM(rdc.leads_ready_value)::DECIMAL(12,2) as leads_ready_value,
    SUM(rdc.leads_delivered_count)::BIGINT as leads_delivered_count,
    SUM(rdc.leads_delivered_value)::DECIMAL(12,2) as leads_delivered_value,
    SUM(rdc.attributed_spend)::DECIMAL(12,2) as attributed_spend,
    SUM(rdc.platform_spend)::DECIMAL(12,2) as platform_spend,
    SUM(rdc.leads_raw_count)::BIGINT as leads_raw_count,
    (SUM(rdc.leads_ready_value) - SUM(rdc.attributed_spend))::DECIMAL(12,2) as profit,
    CASE 
      WHEN SUM(rdc.leads_ready_value) > 0 
      THEN ROUND(((SUM(rdc.leads_ready_value) - SUM(rdc.attributed_spend)) / SUM(rdc.leads_ready_value) * 100)::NUMERIC, 2)
      ELSE 0 
    END::DECIMAL(5,2) as margin_pct
  FROM revenue_daily_cache rdc
  JOIN tenants t ON t.id = rdc.tenant_id
  WHERE rdc.cache_date BETWEEN p_date_start AND p_date_end
    AND (p_tenant_id IS NULL OR rdc.tenant_id = p_tenant_id)
  GROUP BY rdc.tenant_id, t.name
  ORDER BY SUM(rdc.leads_ready_value) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_revenue_summary IS 
  'Returns aggregated revenue metrics for a date range, automatically populating cache as needed.';

-- ============================================
-- 7. Backfill attributed_cost for existing leads
-- ============================================
UPDATE lead_sources ls
SET attributed_cost = (
  SELECT CASE WHEN pc.leads_raw > 0 
    THEN pc.spend / pc.leads_raw 
    ELSE 0 END
  FROM platform_costs pc
  WHERE pc.ad_id = ls.ad_id
    AND ls.created_at::date BETWEEN pc.date_start AND pc.date_end
  ORDER BY pc.date_start DESC
  LIMIT 1
)
WHERE ls.attributed_cost IS NULL
  AND ls.ad_id IS NOT NULL;

-- ============================================
-- 8. Grant permissions
-- ============================================
-- Grant access to authenticated users for the cache tables
ALTER TABLE revenue_daily_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_sync_status ENABLE ROW LEVEL SECURITY;

-- Admin can see all cache data
CREATE POLICY "Admins can view all revenue cache" ON revenue_daily_cache
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND is_converzia_admin = TRUE
    )
  );

CREATE POLICY "Admins can manage revenue cache" ON revenue_daily_cache
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND is_converzia_admin = TRUE
    )
  );

CREATE POLICY "Admins can view all sync status" ON meta_sync_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND is_converzia_admin = TRUE
    )
  );

CREATE POLICY "Admins can manage sync status" ON meta_sync_status
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND is_converzia_admin = TRUE
    )
  );

-- ============================================
-- Verification
-- ============================================
DO $$
BEGIN
  -- Check tables created
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue_daily_cache') THEN
    RAISE NOTICE 'SUCCESS: revenue_daily_cache table created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meta_sync_status') THEN
    RAISE NOTICE 'SUCCESS: meta_sync_status table created';
  END IF;
  
  -- Check column added
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lead_sources' AND column_name = 'attributed_cost'
  ) THEN
    RAISE NOTICE 'SUCCESS: attributed_cost column added to lead_sources';
  END IF;
  
  -- Check functions created
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_lead_attributed_cost') THEN
    RAISE NOTICE 'SUCCESS: calculate_lead_attributed_cost function created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_daily_revenue') THEN
    RAISE NOTICE 'SUCCESS: calculate_daily_revenue function created';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_revenue_summary') THEN
    RAISE NOTICE 'SUCCESS: get_revenue_summary function created';
  END IF;
END $$;

