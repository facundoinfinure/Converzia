-- ============================================
-- Migration: Trial Credits System
-- Allows Admin to grant free trial leads to tenants
-- ============================================

-- Add trial tracking columns to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_credits_granted BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_credits_amount INTEGER DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_granted_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_granted_by UUID REFERENCES user_profiles(id);

COMMENT ON COLUMN tenants.trial_credits_granted IS 'Whether trial credits have been granted to this tenant';
COMMENT ON COLUMN tenants.trial_credits_amount IS 'Number of trial credits that were granted';
COMMENT ON COLUMN tenants.trial_granted_at IS 'When trial credits were granted';
COMMENT ON COLUMN tenants.trial_granted_by IS 'Admin user who granted the trial credits';

-- Add default trial amount to tenant_pricing
ALTER TABLE tenant_pricing ADD COLUMN IF NOT EXISTS default_trial_credits INTEGER DEFAULT 5;

COMMENT ON COLUMN tenant_pricing.default_trial_credits IS 'Default number of free trial credits for new tenants';

-- ============================================
-- Function: Grant trial credits to a tenant
-- ============================================
CREATE OR REPLACE FUNCTION grant_trial_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_granted_by UUID
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  message TEXT
) AS $$
DECLARE
  already_granted BOOLEAN;
  new_entry_id UUID;
  current_balance INTEGER;
BEGIN
  -- Check if trial was already granted
  SELECT trial_credits_granted INTO already_granted
  FROM tenants
  WHERE id = p_tenant_id;
  
  IF already_granted = TRUE THEN
    RETURN QUERY SELECT FALSE, 0, 'Trial credits already granted to this tenant'::TEXT;
    RETURN;
  END IF;
  
  -- Get current balance
  current_balance := COALESCE(get_tenant_credits(p_tenant_id), 0);
  
  -- Insert bonus credits entry
  INSERT INTO credit_ledger (
    tenant_id,
    transaction_type,
    amount,
    balance_after,
    description,
    created_by
  ) VALUES (
    p_tenant_id,
    'CREDIT_BONUS',
    p_amount,
    current_balance + p_amount,
    'Trial credits - Free leads to try the platform',
    p_granted_by
  )
  RETURNING id INTO new_entry_id;
  
  -- Update tenant with trial info
  UPDATE tenants
  SET 
    trial_credits_granted = TRUE,
    trial_credits_amount = p_amount,
    trial_granted_at = NOW(),
    trial_granted_by = p_granted_by,
    updated_at = NOW()
  WHERE id = p_tenant_id;
  
  -- Return success with new balance
  RETURN QUERY 
  SELECT 
    TRUE, 
    get_tenant_credits(p_tenant_id),
    'Trial credits granted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION grant_trial_credits IS 'Grants one-time trial credits to a tenant';

-- ============================================
-- Update tenant_dashboard view to include trial info
-- ============================================
DROP VIEW IF EXISTS tenant_dashboard CASCADE;

CREATE OR REPLACE VIEW tenant_dashboard AS
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.slug,
  t.status,
  t.timezone,
  t.trial_credits_granted,
  t.trial_credits_amount,
  t.trial_granted_at,
  
  -- Pricing info
  tp.charge_model,
  tp.cost_per_lead,
  tp.currency,
  tp.default_trial_credits,
  
  -- Credit info
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

