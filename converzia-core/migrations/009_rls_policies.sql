-- ============================================
-- Converzia: Row Level Security Policies
-- Migration: 009_rls_policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_offer_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_templates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USER PROFILES
-- ============================================
-- Allow trigger to insert profile when user is created
-- The trigger runs with SECURITY DEFINER, but RLS still applies
-- This policy allows INSERT when the id matches the authenticated user
CREATE POLICY user_profiles_insert_own ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can read their own profile
CREATE POLICY user_profiles_select_own ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile  
CREATE POLICY user_profiles_update_own ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Converzia admins can see all profiles
CREATE POLICY user_profiles_admin_select ON user_profiles
  FOR SELECT USING (is_converzia_admin(auth.uid()));

-- Converzia admins can update any profile
CREATE POLICY user_profiles_admin_update ON user_profiles
  FOR UPDATE USING (is_converzia_admin(auth.uid()));

-- Converzia admins can insert profiles
CREATE POLICY user_profiles_admin_insert ON user_profiles
  FOR INSERT WITH CHECK (is_converzia_admin(auth.uid()));

-- ============================================
-- TENANTS
-- ============================================
-- Users can see tenants they're members of
CREATE POLICY tenants_select_member ON tenants
  FOR SELECT USING (
    id IN (SELECT get_user_tenants(auth.uid()))
    OR is_converzia_admin(auth.uid())
  );

-- Only Converzia admins can insert/update/delete tenants
CREATE POLICY tenants_admin_insert ON tenants
  FOR INSERT WITH CHECK (is_converzia_admin(auth.uid()));

CREATE POLICY tenants_admin_update ON tenants
  FOR UPDATE USING (is_converzia_admin(auth.uid()));

CREATE POLICY tenants_admin_delete ON tenants
  FOR DELETE USING (is_converzia_admin(auth.uid()));

-- ============================================
-- TENANT MEMBERS
-- ============================================
-- Users can see memberships for their tenants
CREATE POLICY tenant_members_select ON tenant_members
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    OR user_id = auth.uid()
    OR is_converzia_admin(auth.uid())
  );

-- Tenant admins/owners can invite (insert pending members)
CREATE POLICY tenant_members_insert ON tenant_members
  FOR INSERT WITH CHECK (
    (tenant_id IN (SELECT get_user_tenants(auth.uid())) 
     AND get_user_tenant_role(auth.uid(), tenant_id) IN ('OWNER', 'ADMIN'))
    OR is_converzia_admin(auth.uid())
  );

-- Only Converzia admins can approve (update status)
CREATE POLICY tenant_members_update ON tenant_members
  FOR UPDATE USING (is_converzia_admin(auth.uid()));

-- ============================================
-- OFFERS
-- ============================================
CREATE POLICY offers_select ON offers
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    OR is_converzia_admin(auth.uid())
  );

CREATE POLICY offers_insert ON offers
  FOR INSERT WITH CHECK (is_converzia_admin(auth.uid()));

CREATE POLICY offers_update ON offers
  FOR UPDATE USING (is_converzia_admin(auth.uid()));

CREATE POLICY offers_delete ON offers
  FOR DELETE USING (is_converzia_admin(auth.uid()));

-- ============================================
-- PROPERTIES (linked to offers)
-- ============================================
CREATE POLICY properties_select ON properties
  FOR SELECT USING (
    offer_id IN (
      SELECT id FROM offers 
      WHERE tenant_id IN (SELECT get_user_tenants(auth.uid()))
    )
    OR is_converzia_admin(auth.uid())
  );

CREATE POLICY properties_admin ON properties
  FOR ALL USING (is_converzia_admin(auth.uid()));

-- ============================================
-- OFFER VARIANTS
-- ============================================
CREATE POLICY offer_variants_select ON offer_variants
  FOR SELECT USING (
    offer_id IN (
      SELECT id FROM offers 
      WHERE tenant_id IN (SELECT get_user_tenants(auth.uid()))
    )
    OR is_converzia_admin(auth.uid())
  );

CREATE POLICY offer_variants_admin ON offer_variants
  FOR ALL USING (is_converzia_admin(auth.uid()));

-- ============================================
-- UNITS
-- ============================================
CREATE POLICY units_select ON units
  FOR SELECT USING (
    offer_id IN (
      SELECT id FROM offers 
      WHERE tenant_id IN (SELECT get_user_tenants(auth.uid()))
    )
    OR is_converzia_admin(auth.uid())
  );

CREATE POLICY units_admin ON units
  FOR ALL USING (is_converzia_admin(auth.uid()));

-- ============================================
-- AD OFFER MAP (Converzia admin only)
-- ============================================
CREATE POLICY ad_offer_map_select ON ad_offer_map
  FOR SELECT USING (is_converzia_admin(auth.uid()));

CREATE POLICY ad_offer_map_admin ON ad_offer_map
  FOR ALL USING (is_converzia_admin(auth.uid()));

-- ============================================
-- LEADS (restricted - tenant only sees delivered)
-- ============================================
-- Converzia admins can see all leads
CREATE POLICY leads_admin ON leads
  FOR ALL USING (is_converzia_admin(auth.uid()));

-- Tenants can see leads that have been delivered to them
CREATE POLICY leads_tenant_delivered ON leads
  FOR SELECT USING (
    id IN (
      SELECT lead_id FROM deliveries
      WHERE tenant_id IN (SELECT get_user_tenants(auth.uid()))
        AND status = 'DELIVERED'
    )
  );

-- ============================================
-- LEAD SOURCES
-- ============================================
CREATE POLICY lead_sources_admin ON lead_sources
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY lead_sources_tenant ON lead_sources
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND lead_id IN (
      SELECT lead_id FROM deliveries
      WHERE tenant_id IN (SELECT get_user_tenants(auth.uid()))
        AND status = 'DELIVERED'
    )
  );

-- ============================================
-- LEAD OFFERS
-- ============================================
-- Converzia admins full access
CREATE POLICY lead_offers_admin ON lead_offers
  FOR ALL USING (is_converzia_admin(auth.uid()));

-- Tenants can see counts (via views/functions) but not PII pre-delivery
-- This policy allows seeing delivered lead_offers only
CREATE POLICY lead_offers_tenant_delivered ON lead_offers
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND status = 'SENT_TO_DEVELOPER'
  );

-- ============================================
-- CONVERSATIONS & MESSAGES (restricted)
-- ============================================
CREATE POLICY conversations_admin ON conversations
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY conversations_tenant_delivered ON conversations
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND lead_id IN (
      SELECT lead_id FROM deliveries
      WHERE tenant_id IN (SELECT get_user_tenants(auth.uid()))
        AND status = 'DELIVERED'
    )
  );

CREATE POLICY messages_admin ON messages
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY messages_tenant_delivered ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE tenant_id IN (SELECT get_user_tenants(auth.uid()))
        AND lead_id IN (
          SELECT lead_id FROM deliveries
          WHERE tenant_id IN (SELECT get_user_tenants(auth.uid()))
            AND status = 'DELIVERED'
        )
    )
  );

-- ============================================
-- LEAD EVENTS
-- ============================================
CREATE POLICY lead_events_admin ON lead_events
  FOR ALL USING (is_converzia_admin(auth.uid()));

-- ============================================
-- DELIVERIES
-- ============================================
CREATE POLICY deliveries_admin ON deliveries
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY deliveries_tenant ON deliveries
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
  );

-- ============================================
-- BILLING (tenant pricing - Converzia admin only)
-- ============================================
CREATE POLICY tenant_pricing_admin ON tenant_pricing
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY tenant_pricing_tenant_select ON tenant_pricing
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
  );

-- ============================================
-- STRIPE CUSTOMERS
-- ============================================
CREATE POLICY stripe_customers_admin ON stripe_customers
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY stripe_customers_tenant ON stripe_customers
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
  );

-- ============================================
-- BILLING ORDERS
-- ============================================
CREATE POLICY billing_orders_admin ON billing_orders
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY billing_orders_tenant ON billing_orders
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
  );

-- Tenant billing role can create orders (purchases)
CREATE POLICY billing_orders_tenant_insert ON billing_orders
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    AND get_user_tenant_role(auth.uid(), tenant_id) IN ('OWNER', 'ADMIN', 'BILLING')
  );

-- ============================================
-- CREDIT LEDGER
-- ============================================
CREATE POLICY credit_ledger_admin ON credit_ledger
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY credit_ledger_tenant ON credit_ledger
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
  );

-- ============================================
-- RAG SOURCES
-- ============================================
CREATE POLICY rag_sources_admin ON rag_sources
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY rag_sources_tenant ON rag_sources
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
  );

-- ============================================
-- RAG DOCUMENTS
-- ============================================
CREATE POLICY rag_documents_admin ON rag_documents
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY rag_documents_tenant ON rag_documents
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
  );

-- ============================================
-- RAG CHUNKS
-- ============================================
CREATE POLICY rag_chunks_admin ON rag_chunks
  FOR ALL USING (is_converzia_admin(auth.uid()));

CREATE POLICY rag_chunks_tenant ON rag_chunks
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
  );

-- ============================================
-- SCORING TEMPLATES
-- ============================================
-- Global templates (tenant_id IS NULL) visible to all authenticated
CREATE POLICY scoring_templates_global ON scoring_templates
  FOR SELECT USING (tenant_id IS NULL);

-- Tenant-specific templates visible to tenant members
CREATE POLICY scoring_templates_tenant ON scoring_templates
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
  );

-- Only Converzia admins can modify
CREATE POLICY scoring_templates_admin ON scoring_templates
  FOR ALL USING (is_converzia_admin(auth.uid()));

-- ============================================
-- SERVICE ROLE BYPASS
-- Note: Service role (used by n8n/Make) bypasses RLS
-- This is configured at the Supabase project level
-- ============================================









