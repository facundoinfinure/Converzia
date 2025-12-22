-- ============================================
-- Converzia: Initial Seed Data
-- ============================================

-- ============================================
-- Create Converzia Admin User
-- Note: This should be done after the first user signs up
-- Then run this to make them admin:
-- ============================================
-- UPDATE user_profiles 
-- SET is_converzia_admin = TRUE 
-- WHERE email = 'admin@converzia.io';

-- ============================================
-- Additional Scoring Templates
-- ============================================

-- AUTO vertical template (future)
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
  'AUTO',
  NULL,
  'Auto Default v1',
  'Default scoring template for automotive leads',
  TRUE,
  '{
    "budget_fit": { "max_points": 25, "weight": 0.25 },
    "model_preference": { "max_points": 20, "weight": 0.20 },
    "timing_fit": { "max_points": 20, "weight": 0.20 },
    "financing_need": { "max_points": 15, "weight": 0.15 },
    "intent_strength": { "max_points": 10, "weight": 0.10 },
    "conversation_quality": { "max_points": 10, "weight": 0.10 }
  }',
  '{
    "budget_fit": {
      "type": "range_match",
      "description": "Budget match for vehicle price",
      "scoring": {
        "perfect_match": 25,
        "within_15_percent": 20,
        "within_30_percent": 12,
        "out_of_range": 5,
        "no_data": 0
      }
    },
    "model_preference": {
      "type": "category_match",
      "description": "Match between preferred model/type and available inventory",
      "scoring": {
        "exact_model": 20,
        "same_category": 14,
        "related_category": 8,
        "no_preference": 10,
        "no_data": 0
      }
    },
    "timing_fit": {
      "type": "timing_match",
      "description": "Purchase timeline",
      "scoring": {
        "immediate": 20,
        "within_1_month": 16,
        "within_3_months": 12,
        "exploring": 6,
        "no_data": 0
      }
    },
    "financing_need": {
      "type": "boolean_match",
      "description": "Financing interest and qualification",
      "scoring": {
        "pre_approved": 15,
        "needs_financing": 12,
        "cash_buyer": 10,
        "no_data": 5
      }
    },
    "intent_strength": {
      "type": "intent_classification",
      "description": "Purchase intent",
      "scoring": {
        "ready_to_buy": 10,
        "comparing_options": 7,
        "just_looking": 3,
        "no_data": 0
      }
    },
    "conversation_quality": {
      "type": "engagement_score",
      "scoring": {
        "highly_engaged": 10,
        "good_engagement": 7,
        "moderate": 5,
        "low_engagement": 2,
        "friction": 0
      }
    }
  }',
  75
) ON CONFLICT DO NOTHING;

-- LOAN vertical template (future)
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
  'LOAN',
  NULL,
  'Loan Default v1',
  'Default scoring template for loan/mortgage leads',
  TRUE,
  '{
    "loan_amount_fit": { "max_points": 25, "weight": 0.25 },
    "income_qualification": { "max_points": 25, "weight": 0.25 },
    "timing_fit": { "max_points": 15, "weight": 0.15 },
    "documentation_status": { "max_points": 15, "weight": 0.15 },
    "intent_strength": { "max_points": 10, "weight": 0.10 },
    "conversation_quality": { "max_points": 10, "weight": 0.10 }
  }',
  '{
    "loan_amount_fit": {
      "type": "range_match",
      "description": "Loan amount within product range",
      "scoring": {
        "within_range": 25,
        "slightly_above": 15,
        "significantly_above": 5,
        "no_data": 0
      }
    },
    "income_qualification": {
      "type": "ratio_check",
      "description": "Income to loan ratio qualification",
      "scoring": {
        "strong_qualification": 25,
        "moderate_qualification": 18,
        "borderline": 10,
        "likely_unqualified": 3,
        "no_data": 0
      }
    },
    "timing_fit": {
      "type": "timing_match",
      "description": "Urgency of loan need",
      "scoring": {
        "immediate": 15,
        "within_1_month": 12,
        "within_3_months": 8,
        "exploring": 4,
        "no_data": 0
      }
    },
    "documentation_status": {
      "type": "checklist",
      "description": "Documentation readiness",
      "scoring": {
        "all_ready": 15,
        "mostly_ready": 10,
        "partial": 5,
        "not_ready": 2,
        "no_data": 0
      }
    },
    "intent_strength": {
      "type": "intent_classification",
      "scoring": {
        "committed": 10,
        "serious": 7,
        "comparing": 4,
        "curious": 1,
        "no_data": 0
      }
    },
    "conversation_quality": {
      "type": "engagement_score",
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
) ON CONFLICT DO NOTHING;

-- ============================================
-- Example Test Data (only for dev environment)
-- ============================================
-- Uncomment and run manually in dev only:

/*
-- Create test tenant
INSERT INTO tenants (name, slug, status, contact_email)
VALUES ('Test Developer', 'test-developer', 'ACTIVE', 'test@example.com');

-- Create test offer
INSERT INTO offers (tenant_id, name, slug, offer_type, status, zone, city, price_from, price_to)
SELECT 
  id,
  'Torre Norte Palermo',
  'torre-norte-palermo',
  'PROPERTY',
  'ACTIVE',
  'Palermo',
  'Buenos Aires',
  80000,
  150000
FROM tenants WHERE slug = 'test-developer';

-- Create test property details
INSERT INTO properties (offer_id, developer_name, project_stage, delivery_date, total_units, has_financing)
SELECT 
  id,
  'Test Developer',
  'CONSTRUCTION',
  '2026-06-01',
  100,
  TRUE
FROM offers WHERE slug = 'torre-norte-palermo';

-- Create test variants
INSERT INTO offer_variants (offer_id, name, code, bedrooms, bathrooms, area_m2, price_from, price_to, total_units, available_units)
SELECT 
  id,
  '2 Ambientes',
  '2A',
  1,
  1,
  45,
  80000,
  95000,
  40,
  25
FROM offers WHERE slug = 'torre-norte-palermo';

INSERT INTO offer_variants (offer_id, name, code, bedrooms, bathrooms, area_m2, price_from, price_to, total_units, available_units)
SELECT 
  id,
  '3 Ambientes',
  '3A',
  2,
  1,
  65,
  110000,
  130000,
  35,
  18
FROM offers WHERE slug = 'torre-norte-palermo';
*/









