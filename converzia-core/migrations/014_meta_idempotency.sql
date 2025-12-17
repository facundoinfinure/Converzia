-- ============================================
-- Converzia: Meta ingestion idempotency & assumptions
-- Migration: 014_meta_idempotency
-- ============================================

-- Assumption: a Meta ad_id uniquely identifies a single tenant in Converzia.
-- Enforce globally unique ad_id to prevent cross-tenant ambiguity.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_offer_map_ad_id_unique
  ON ad_offer_map(ad_id);

-- Idempotency: do not process the same leadgen_id twice for the same tenant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_sources_unique_tenant_leadgen
  ON lead_sources(tenant_id, leadgen_id)
  WHERE leadgen_id IS NOT NULL;

-- For unmapped ads (offer_id IS NULL) ensure only one open lead_offer per lead+tenant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_offers_unique_unmapped_per_tenant
  ON lead_offers(tenant_id, lead_id)
  WHERE offer_id IS NULL;
