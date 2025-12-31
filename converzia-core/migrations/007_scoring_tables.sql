-- ============================================
-- Converzia: Scoring Templates
-- Migration: 007_scoring_tables
-- ============================================

-- ============================================
-- SCORING TEMPLATES (per offer type)
-- ============================================
CREATE TABLE scoring_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Scope
  offer_type offer_type NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global default
  
  -- Template name
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  
  -- Weights (must sum to 100)
  weights JSONB NOT NULL DEFAULT '{}',
  -- Example for PROPERTY:
  -- {
  --   "budget_fit": { "max_points": 25, "weight": 0.25 },
  --   "zone_fit": { "max_points": 20, "weight": 0.20 },
  --   "typology_fit": { "max_points": 15, "weight": 0.15 },
  --   "timing_fit": { "max_points": 15, "weight": 0.15 },
  --   "intent_strength": { "max_points": 15, "weight": 0.15 },
  --   "conversation_quality": { "max_points": 10, "weight": 0.10, "is_penalty": true }
  -- }
  
  -- Rules (scoring logic)
  rules JSONB NOT NULL DEFAULT '{}',
  -- Example:
  -- {
  --   "budget_fit": {
  --     "type": "range_match",
  --     "perfect_match": 25,
  --     "partial_match": 15,
  --     "no_match": 5,
  --     "no_data": 0
  --   },
  --   "zone_fit": {
  --     "type": "list_match",
  --     "exact_match": 20,
  --     "adjacent_zone": 12,
  --     "no_match": 0
  --   }
  -- }
  
  -- Thresholds
  lead_ready_threshold INTEGER DEFAULT 80,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  
  UNIQUE(offer_type, tenant_id, name)
);

CREATE INDEX idx_scoring_templates_offer_type ON scoring_templates(offer_type);
CREATE INDEX idx_scoring_templates_tenant ON scoring_templates(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_scoring_templates_default ON scoring_templates(is_default) WHERE is_default = TRUE;

-- ============================================
-- SEED: Default PROPERTY scoring template
-- ============================================
INSERT INTO scoring_templates (
  offer_type,
  tenant_id,
  name,
  description,
  is_default,
  weights,
  rules,
  lead_ready_threshold
) VALUES (
  'PROPERTY',
  NULL, -- Global default
  'Real Estate Default v1',
  'Default scoring template for real estate leads',
  TRUE,
  '{
    "budget_fit": { "max_points": 25, "weight": 0.25 },
    "zone_fit": { "max_points": 20, "weight": 0.20 },
    "typology_fit": { "max_points": 15, "weight": 0.15 },
    "timing_fit": { "max_points": 15, "weight": 0.15 },
    "intent_strength": { "max_points": 15, "weight": 0.15 },
    "conversation_quality": { "max_points": 10, "weight": 0.10 }
  }',
  '{
    "budget_fit": {
      "type": "range_match",
      "description": "How well the lead budget matches offer price range",
      "scoring": {
        "perfect_match": 25,
        "within_20_percent": 20,
        "within_50_percent": 12,
        "out_of_range": 5,
        "no_data": 0
      }
    },
    "zone_fit": {
      "type": "list_match",
      "description": "Geographic match between lead preference and offer location",
      "scoring": {
        "exact_match": 20,
        "adjacent_zone": 12,
        "same_city": 8,
        "no_match": 3,
        "no_data": 0
      }
    },
    "typology_fit": {
      "type": "variant_match",
      "description": "Match between lead preferences and available variants",
      "scoring": {
        "exact_match": 15,
        "close_match": 10,
        "partial_match": 6,
        "no_match": 2,
        "no_data": 0
      }
    },
    "timing_fit": {
      "type": "timing_match",
      "description": "Alignment between lead timeline and project delivery",
      "scoring": {
        "immediate": 15,
        "within_6_months": 12,
        "within_1_year": 8,
        "flexible": 10,
        "long_term": 5,
        "no_data": 0
      }
    },
    "intent_strength": {
      "type": "intent_classification",
      "description": "Strength of purchase/rental intent",
      "scoring": {
        "ready_to_buy": 15,
        "actively_looking": 12,
        "exploring": 8,
        "just_curious": 4,
        "no_data": 0
      }
    },
    "conversation_quality": {
      "type": "engagement_score",
      "description": "Quality and depth of conversation",
      "scoring": {
        "highly_engaged": 10,
        "good_engagement": 7,
        "moderate": 5,
        "low_engagement": 2,
        "friction": 0
      }
    }
  }',
  80
);












