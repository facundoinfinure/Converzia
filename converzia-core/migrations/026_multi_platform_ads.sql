-- ============================================
-- Migration: Multi-Platform Ad Mapping
-- Adds platform column to ad_offer_map for supporting
-- multiple ad platforms (Meta, TikTok, Google, LinkedIn)
-- ============================================

-- Add platform column to ad_offer_map
ALTER TABLE ad_offer_map ADD COLUMN IF NOT EXISTS platform ad_platform DEFAULT 'META';

COMMENT ON COLUMN ad_offer_map.platform IS 'Advertising platform (META, TIKTOK, GOOGLE, LINKEDIN)';

-- Drop old unique constraint if exists
ALTER TABLE ad_offer_map DROP CONSTRAINT IF EXISTS ad_offer_map_tenant_id_ad_id_key;

-- Add new unique constraint including platform
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ad_offer_map_tenant_platform_ad_unique'
  ) THEN
    ALTER TABLE ad_offer_map 
    ADD CONSTRAINT ad_offer_map_tenant_platform_ad_unique 
    UNIQUE(tenant_id, platform, ad_id);
  END IF;
END $$;

-- Create index for platform queries
CREATE INDEX IF NOT EXISTS idx_ad_offer_map_platform ON ad_offer_map(platform);

-- Update unmapped_ads_queue view to include platform
CREATE OR REPLACE VIEW unmapped_ads_queue AS
SELECT DISTINCT ON (ls.ad_id, ls.tenant_id)
  ls.ad_id,
  ls.adset_id,
  ls.campaign_id,
  ls.tenant_id,
  t.name AS tenant_name,
  'META'::ad_platform AS platform,  -- Default to META for now
  COUNT(*) OVER (PARTITION BY ls.ad_id, ls.tenant_id) AS lead_count,
  MIN(ls.created_at) OVER (PARTITION BY ls.ad_id, ls.tenant_id) AS first_seen_at,
  MAX(ls.created_at) OVER (PARTITION BY ls.ad_id, ls.tenant_id) AS last_seen_at
FROM lead_sources ls
JOIN tenants t ON t.id = ls.tenant_id
LEFT JOIN ad_offer_map aom ON aom.ad_id = ls.ad_id AND aom.tenant_id = ls.tenant_id
WHERE aom.id IS NULL
  AND ls.ad_id IS NOT NULL
ORDER BY ls.ad_id, ls.tenant_id, ls.created_at DESC;

