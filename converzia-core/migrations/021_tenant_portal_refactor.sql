-- ============================================
-- Converzia: Tenant Portal Refactor
-- Migration: 021_tenant_portal_refactor
-- ============================================
-- This migration adds:
-- 1. Offer approval workflow for tenant-created offers
-- 2. Disqualification tracking for funnel insights
-- 3. Funnel stats view for tenant dashboard
-- 4. Credit consumption details view
-- 5. Role permissions table
-- 6. Project assets table (images, plans for ads)
-- ============================================

-- ============================================
-- 1. OFFER APPROVAL WORKFLOW
-- ============================================

-- Add offer approval status
ALTER TABLE offers 
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Set existing offers as APPROVED (backward compatibility)
UPDATE offers SET approval_status = 'APPROVED' WHERE approval_status IS NULL;

-- Approval status: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
COMMENT ON COLUMN offers.approval_status IS 'DRAFT = tenant editing, PENDING_APPROVAL = waiting for Converzia, APPROVED = ready for ads, REJECTED = needs changes';

CREATE INDEX IF NOT EXISTS idx_offers_approval_status ON offers(approval_status);

-- ============================================
-- 2. DISQUALIFICATION TRACKING
-- ============================================

-- Add disqualification tracking to lead_offers
ALTER TABLE lead_offers
  ADD COLUMN IF NOT EXISTS disqualification_reason TEXT,
  ADD COLUMN IF NOT EXISTS disqualification_category VARCHAR(50);

-- Categories for funnel insights:
-- PRICE_TOO_HIGH, PRICE_TOO_LOW, WRONG_ZONE, WRONG_TYPOLOGY, 
-- NO_RESPONSE, NOT_INTERESTED, MISSING_AMENITY, DUPLICATE, OTHER
COMMENT ON COLUMN lead_offers.disqualification_category IS 
  'Category of disqualification for funnel analytics: PRICE_TOO_HIGH, PRICE_TOO_LOW, WRONG_ZONE, WRONG_TYPOLOGY, NO_RESPONSE, NOT_INTERESTED, MISSING_AMENITY, DUPLICATE, OTHER';

CREATE INDEX IF NOT EXISTS idx_lead_offers_disqualification ON lead_offers(disqualification_category) 
  WHERE disqualification_category IS NOT NULL;

-- ============================================
-- 3. FUNNEL STATS VIEW (for tenant dashboard)
-- ============================================

CREATE OR REPLACE VIEW offer_funnel_stats AS
SELECT 
  o.id AS offer_id,
  o.tenant_id,
  o.name AS offer_name,
  o.status AS offer_status,
  o.approval_status,
  
  -- Funnel counts
  COUNT(lo.id) AS total_leads,
  COUNT(lo.id) FILTER (WHERE lo.status = 'PENDING_MAPPING') AS leads_pending_mapping,
  COUNT(lo.id) FILTER (WHERE lo.status = 'TO_BE_CONTACTED') AS leads_pending_contact,
  COUNT(lo.id) FILTER (WHERE lo.status IN ('CONTACTED', 'ENGAGED', 'QUALIFYING')) AS leads_in_chat,
  COUNT(lo.id) FILTER (WHERE lo.status IN ('SCORED', 'LEAD_READY')) AS leads_qualified,
  COUNT(lo.id) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER') AS leads_delivered,
  COUNT(lo.id) FILTER (WHERE lo.status = 'DISQUALIFIED') AS leads_disqualified,
  COUNT(lo.id) FILTER (WHERE lo.status IN ('STOPPED', 'COOLING')) AS leads_stopped,
  
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
-- 4. TENANT FUNNEL AGGREGATED VIEW
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
  
  -- Credit balance
  COALESCE(cb.current_balance, 0) AS credit_balance,
  
  -- Active offers count
  COUNT(DISTINCT fs.offer_id) FILTER (WHERE fs.offer_status = 'ACTIVE') AS active_offers_count

FROM tenants t
LEFT JOIN offer_funnel_stats fs ON fs.tenant_id = t.id
LEFT JOIN tenant_credit_balance cb ON cb.tenant_id = t.id
GROUP BY t.id, t.name, cb.current_balance;

GRANT SELECT ON tenant_funnel_stats TO authenticated;

-- ============================================
-- 5. CREDIT CONSUMPTION VIEW (for billing details)
-- ============================================

CREATE OR REPLACE VIEW credit_consumption_details AS
SELECT 
  cl.id AS ledger_id,
  cl.tenant_id,
  cl.offer_id,
  cl.amount,
  cl.balance_after,
  cl.entry_type,
  cl.description,
  cl.created_at,
  
  -- Related delivery info
  d.id AS delivery_id,
  d.status AS delivery_status,
  d.delivered_at,
  
  -- Related lead offer info
  lo.id AS lead_offer_id,
  lo.status AS lead_status,
  lo.score_total,
  lo.qualification_fields,
  
  -- Lead info (anonymized for non-delivered, full for delivered)
  l.id AS lead_id,
  CASE 
    WHEN lo.status = 'SENT_TO_DEVELOPER' THEN l.full_name
    ELSE 'Lead #' || SUBSTRING(lo.id::text, 1, 8)
  END AS lead_display_name,
  CASE 
    WHEN lo.status = 'SENT_TO_DEVELOPER' THEN l.phone
    ELSE NULL
  END AS lead_phone,
  CASE 
    WHEN lo.status = 'SENT_TO_DEVELOPER' THEN l.email
    ELSE NULL
  END AS lead_email,
  
  -- Offer info
  o.name AS offer_name

FROM credit_ledger cl
LEFT JOIN deliveries d ON d.credit_ledger_id = cl.id
LEFT JOIN lead_offers lo ON d.lead_offer_id = lo.id
LEFT JOIN leads l ON lo.lead_id = l.id
LEFT JOIN offers o ON cl.offer_id = o.id
WHERE cl.entry_type IN ('CONSUMPTION', 'REFUND');

GRANT SELECT ON credit_consumption_details TO authenticated;

-- ============================================
-- 6. ROLE PERMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS role_permissions (
  role VARCHAR(20) PRIMARY KEY,
  can_manage_offers BOOLEAN DEFAULT FALSE,
  can_manage_documents BOOLEAN DEFAULT FALSE,
  can_view_leads BOOLEAN DEFAULT FALSE,
  can_view_lead_details BOOLEAN DEFAULT FALSE,
  can_manage_billing BOOLEAN DEFAULT FALSE,
  can_view_billing BOOLEAN DEFAULT FALSE,
  can_manage_team BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default permissions
INSERT INTO role_permissions (role, can_manage_offers, can_manage_documents, can_view_leads, can_view_lead_details, can_manage_billing, can_view_billing, can_manage_team)
VALUES 
  ('OWNER', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
  ('ADMIN', TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, FALSE),
  ('BILLING', FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, FALSE),
  ('VIEWER', FALSE, FALSE, TRUE, FALSE, FALSE, TRUE, FALSE)
ON CONFLICT (role) DO UPDATE SET
  can_manage_offers = EXCLUDED.can_manage_offers,
  can_manage_documents = EXCLUDED.can_manage_documents,
  can_view_leads = EXCLUDED.can_view_leads,
  can_view_lead_details = EXCLUDED.can_view_lead_details,
  can_manage_billing = EXCLUDED.can_manage_billing,
  can_view_billing = EXCLUDED.can_view_billing,
  can_manage_team = EXCLUDED.can_manage_team,
  updated_at = NOW();

COMMENT ON TABLE role_permissions IS 'Defines what each tenant member role can do in the portal';

-- ============================================
-- 7. PROJECT ASSETS TABLE (images, plans for ads)
-- ============================================

CREATE TABLE IF NOT EXISTS offer_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Asset info
  asset_type VARCHAR(20) NOT NULL, -- 'IMAGE', 'PLAN', 'BROCHURE', 'VIDEO'
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Metadata
  title TEXT,
  description TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  
  -- Usage tracking (by Converzia)
  used_in_ads BOOLEAN DEFAULT FALSE,
  used_in_rag BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_offer_assets_offer ON offer_assets(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_assets_tenant ON offer_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offer_assets_type ON offer_assets(asset_type);

COMMENT ON TABLE offer_assets IS 'Images, plans, and other assets uploaded by tenants for their offers';

-- RLS for offer_assets
ALTER TABLE offer_assets ENABLE ROW LEVEL SECURITY;

-- Tenants can view and manage their own assets
CREATE POLICY "Tenants can view own assets" ON offer_assets
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm 
      WHERE tm.user_id = auth.uid() AND tm.status = 'ACTIVE'
    )
  );

CREATE POLICY "Tenants can insert own assets" ON offer_assets
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm 
      WHERE tm.user_id = auth.uid() 
        AND tm.status = 'ACTIVE'
        AND tm.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Tenants can delete own assets" ON offer_assets
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm 
      WHERE tm.user_id = auth.uid() 
        AND tm.status = 'ACTIVE'
        AND tm.role IN ('OWNER', 'ADMIN')
    )
  );

-- Converzia admins can do everything
CREATE POLICY "Converzia admins full access to assets" ON offer_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() AND up.is_converzia_admin = TRUE
    )
  );

-- ============================================
-- 8. LEADS VIEW FOR TENANT (anonymized)
-- ============================================

CREATE OR REPLACE VIEW tenant_leads_anonymized AS
SELECT 
  lo.id,
  lo.offer_id,
  lo.tenant_id,
  lo.status,
  lo.score_total,
  lo.qualification_fields,
  lo.created_at,
  lo.updated_at,
  lo.first_response_at,
  lo.qualified_at,
  lo.disqualification_category,
  lo.disqualification_reason,
  
  -- Offer info
  o.name AS offer_name,
  
  -- Lead display info (anonymized unless delivered)
  CASE 
    WHEN lo.status = 'SENT_TO_DEVELOPER' THEN l.full_name
    ELSE 'Lead #' || SUBSTRING(lo.id::text, 1, 8)
  END AS lead_display_name,
  CASE 
    WHEN lo.status = 'SENT_TO_DEVELOPER' THEN l.phone
    ELSE NULL
  END AS lead_phone,
  CASE 
    WHEN lo.status = 'SENT_TO_DEVELOPER' THEN l.email
    ELSE NULL
  END AS lead_email,
  
  -- Delivery info
  d.id AS delivery_id,
  d.status AS delivery_status,
  d.delivered_at

FROM lead_offers lo
JOIN leads l ON lo.lead_id = l.id
JOIN offers o ON lo.offer_id = o.id
LEFT JOIN deliveries d ON d.lead_offer_id = lo.id;

GRANT SELECT ON tenant_leads_anonymized TO authenticated;

-- ============================================
-- 9. RLS UPDATES FOR VIEWS
-- ============================================

-- Add RLS policy for offer_funnel_stats access
CREATE OR REPLACE FUNCTION check_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is Converzia admin
  IF EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() AND up.is_converzia_admin = TRUE
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is member of the tenant
  RETURN EXISTS (
    SELECT 1 FROM tenant_members tm 
    WHERE tm.user_id = auth.uid() 
      AND tm.tenant_id = p_tenant_id 
      AND tm.status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. FUNCTION TO SUBMIT OFFER FOR APPROVAL
-- ============================================

CREATE OR REPLACE FUNCTION submit_offer_for_approval(p_offer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_offer offers%ROWTYPE;
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get the offer
  SELECT * INTO v_offer FROM offers WHERE id = p_offer_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not found');
  END IF;
  
  -- Check if user has access to this tenant
  SELECT tm.tenant_id INTO v_tenant_id
  FROM tenant_members tm
  WHERE tm.user_id = v_user_id 
    AND tm.tenant_id = v_offer.tenant_id
    AND tm.status = 'ACTIVE'
    AND tm.role IN ('OWNER', 'ADMIN');
    
  IF v_tenant_id IS NULL THEN
    -- Check if Converzia admin
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id AND is_converzia_admin = TRUE) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
  END IF;
  
  -- Check current status
  IF v_offer.approval_status NOT IN ('DRAFT', 'REJECTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer cannot be submitted in current state');
  END IF;
  
  -- Update to pending approval
  UPDATE offers 
  SET 
    approval_status = 'PENDING_APPROVAL',
    submitted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_offer_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Offer submitted for approval');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. FUNCTION TO APPROVE/REJECT OFFER (Admin only)
-- ============================================

CREATE OR REPLACE FUNCTION approve_offer(p_offer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if Converzia admin
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id AND is_converzia_admin = TRUE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Converzia admins can approve offers');
  END IF;
  
  -- Update to approved
  UPDATE offers 
  SET 
    approval_status = 'APPROVED',
    approved_at = NOW(),
    approved_by = v_user_id,
    rejection_reason = NULL,
    updated_at = NOW()
  WHERE id = p_offer_id AND approval_status = 'PENDING_APPROVAL';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not found or not pending approval');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Offer approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_offer(p_offer_id UUID, p_reason TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Check if Converzia admin
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id AND is_converzia_admin = TRUE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Converzia admins can reject offers');
  END IF;
  
  -- Update to rejected
  UPDATE offers 
  SET 
    approval_status = 'REJECTED',
    rejection_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_offer_id AND approval_status = 'PENDING_APPROVAL';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Offer not found or not pending approval');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'message', 'Offer rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

