-- ============================================
-- Converzia: Allow ad_id to be tenant-scoped even if offer not mapped
-- Migration: 013_ad_offer_map_nullable_offer
-- ============================================

-- In v1 we need to ingest leads ASAP via Meta webhook.
-- We can always resolve tenant_id from ad_id, but offer_id may be unknown initially.
-- This enables PENDING_MAPPING while still attaching the lead to the correct tenant.

ALTER TABLE ad_offer_map
  ALTER COLUMN offer_id DROP NOT NULL;

-- Ensure lookups by ad_id are fast
CREATE INDEX IF NOT EXISTS idx_ad_offer_map_ad_active
  ON ad_offer_map(ad_id)
  WHERE is_active = TRUE;
