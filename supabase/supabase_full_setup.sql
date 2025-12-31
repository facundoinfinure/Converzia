-- ============================================
-- Converzia: Supabase Full Setup (single file)
-- Generated from converzia-core/migrations + seed
-- Fixes: integration enums consolidated; tenant_integrations de-duplicated
-- ============================================

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 001_extensions
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================
-- Converzia: Extensions Setup
-- Migration: 001_extensions
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector for embeddings

-- Enable full-text search (usually enabled by default)
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy matching if needed

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 001_extensions
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 002_enums
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================
-- Converzia: Enum Types
-- Migration: 002_enums
-- ============================================

-- Offer types (multi-vertical ready)
CREATE TYPE offer_type AS ENUM (
  'PROPERTY',
  'AUTO',
  'LOAN',
  'INSURANCE'
);

-- Offer status
CREATE TYPE offer_status AS ENUM (
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'ARCHIVED'
);

-- Lead-Offer state machine
CREATE TYPE lead_offer_status AS ENUM (
  'PENDING_MAPPING',
  'TO_BE_CONTACTED',
  'CONTACTED',
  'ENGAGED',
  'QUALIFYING',
  'SCORED',
  'LEAD_READY',
  'SENT_TO_DEVELOPER',
  'COOLING',
  'REACTIVATION',
  'DISQUALIFIED',
  'STOPPED',
  'HUMAN_HANDOFF'
);

-- Tenant membership status
CREATE TYPE membership_status AS ENUM (
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED'
);

-- Tenant member roles
CREATE TYPE tenant_role AS ENUM (
  'OWNER',
  'ADMIN',
  'BILLING',
  'VIEWER'
);

-- Billing charge model
CREATE TYPE charge_model AS ENUM (
  'PER_LEAD',
  'PER_SALE',
  'SUBSCRIPTION'
);

-- Billing eligibility status
CREATE TYPE billing_eligibility AS ENUM (
  'CHARGEABLE',
  'NOT_CHARGEABLE_DUPLICATE',
  'NOT_CHARGEABLE_SPAM',
  'NOT_CHARGEABLE_INCOMPLETE',
  'NOT_CHARGEABLE_OUT_OF_ZONE',
  'PENDING'
);

-- Credit ledger transaction types
CREATE TYPE credit_transaction_type AS ENUM (
  'CREDIT_PURCHASE',
  'CREDIT_CONSUMPTION',
  'CREDIT_REFUND',
  'CREDIT_ADJUSTMENT',
  'CREDIT_BONUS'
);

-- Delivery status
CREATE TYPE delivery_status AS ENUM (
  'PENDING',
  'DELIVERED',
  'FAILED',
  'REFUNDED'
);

-- RAG source types
CREATE TYPE rag_source_type AS ENUM (
  'PDF',
  'URL',
  'WEBSITE_SCRAPE',
  'MANUAL'
);

-- RAG document status
CREATE TYPE rag_document_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

-- Tenant status
CREATE TYPE tenant_status AS ENUM (
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

-- Message direction
CREATE TYPE message_direction AS ENUM (
  'INBOUND',
  'OUTBOUND'
);

-- Message sender type
CREATE TYPE message_sender AS ENUM (
  'LEAD',
  'BOT',
  'OPERATOR'
);

-- Event types for audit
CREATE TYPE lead_event_type AS ENUM (
  'CREATED',
  'STATUS_CHANGE',
  'FIELD_UPDATED',
  'SCORE_CALCULATED',
  'MESSAGE_SENT',
  'MESSAGE_RECEIVED',
  'DELIVERY_ATTEMPTED',
  'DELIVERY_COMPLETED',
  'DELIVERY_FAILED',
  'CREDIT_CONSUMED',
  'CREDIT_REFUNDED',
  'OPT_OUT',
  'REACTIVATION_STARTED',
  'MANUAL_ACTION'
);

-- Integrations
CREATE TYPE integration_type AS ENUM (
  'GOOGLE_SHEETS',
  'TOKKO',
  'PROPERATI',
  'WEBHOOK',
  'ZAPIER',
  'META_ADS'
);

-- Ad platforms for cost tracking and ad mapping
CREATE TYPE ad_platform AS ENUM (
  'META',
  'TIKTOK',
  'GOOGLE',
  'LINKEDIN'
);

CREATE TYPE integration_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'ERROR',
  'PENDING_SETUP'
);

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 002_enums
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 003_core_tables
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================
-- Converzia: Core Tables
-- Migration: 003_core_tables
-- ============================================

-- ============================================
-- TENANTS
-- ============================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status tenant_status NOT NULL DEFAULT 'PENDING',
  
  -- Settings
  default_score_threshold INTEGER NOT NULL DEFAULT 80,
  duplicate_window_days INTEGER NOT NULL DEFAULT 90,
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  
  -- Contact info
  contact_email TEXT,
  contact_phone TEXT,
  
  -- Trial credits
  trial_credits_granted BOOLEAN DEFAULT FALSE,
  trial_credits_amount INTEGER DEFAULT 0,
  trial_granted_at TIMESTAMPTZ,
  trial_granted_by UUID,
  
  -- Metadata
  settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ============================================
-- USER PROFILES (extends auth.users)
-- ============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  
  -- Converzia admin flag
  is_converzia_admin BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- ============================================
-- TENANT MEMBERS (multi-tenant access)
-- ============================================
CREATE TABLE tenant_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  role tenant_role NOT NULL DEFAULT 'VIEWER',
  status membership_status NOT NULL DEFAULT 'PENDING_APPROVAL',
  
  -- Audit
  invited_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX idx_tenant_members_status ON tenant_members(status);

-- ============================================
-- OFFERS (generic, multi-vertical)
-- ============================================
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  offer_type offer_type NOT NULL DEFAULT 'PROPERTY',
  status offer_status NOT NULL DEFAULT 'DRAFT',
  
  -- Display
  description TEXT,
  short_description TEXT,
  image_url TEXT,
  
  -- Location (generic)
  address TEXT,
  city TEXT,
  zone TEXT,
  country TEXT DEFAULT 'AR',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Pricing range
  price_from DECIMAL(15, 2),
  price_to DECIMAL(15, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Priority for recommendation
  priority INTEGER NOT NULL DEFAULT 100,
  
  -- Settings
  settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_offers_tenant ON offers(tenant_id);
CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_type ON offers(offer_type);
CREATE INDEX idx_offers_zone ON offers(zone);

-- ============================================
-- PROPERTIES (real estate specific)
-- ============================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL UNIQUE REFERENCES offers(id) ON DELETE CASCADE,
  
  -- Property specific
  developer_name TEXT,
  project_stage TEXT, -- 'PRE_SALE', 'CONSTRUCTION', 'READY'
  delivery_date DATE,
  
  -- Features
  total_units INTEGER,
  floors INTEGER,
  amenities JSONB DEFAULT '[]', -- ["pool", "gym", "rooftop"]
  
  -- Financing
  has_financing BOOLEAN DEFAULT FALSE,
  financing_details JSONB DEFAULT '{}',
  
  -- Legal
  legal_status TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_offer ON properties(offer_id);

-- ============================================
-- OFFER VARIANTS (typologies)
-- ============================================
CREATE TABLE offer_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL, -- "2 ambientes", "3BR + Study"
  code TEXT, -- "2A", "3BR-S"
  
  -- Specs (real estate)
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_m2 DECIMAL(10, 2),
  area_covered_m2 DECIMAL(10, 2),
  
  -- Pricing
  price_from DECIMAL(15, 2),
  price_to DECIMAL(15, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Availability
  total_units INTEGER,
  available_units INTEGER,
  
  -- Display
  floor_plan_url TEXT,
  description TEXT,
  
  -- Ordering
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(offer_id, code)
);

CREATE INDEX idx_offer_variants_offer ON offer_variants(offer_id);

-- ============================================
-- UNITS (individual inventory items)
-- ============================================
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID NOT NULL REFERENCES offer_variants(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  
  -- Identification
  unit_number TEXT NOT NULL,
  floor INTEGER,
  
  -- Specs
  orientation TEXT, -- "N", "NE", "FRONT", "BACK"
  has_balcony BOOLEAN DEFAULT FALSE,
  has_terrace BOOLEAN DEFAULT FALSE,
  parking_spaces INTEGER DEFAULT 0,
  storage_unit BOOLEAN DEFAULT FALSE,
  
  -- Area
  area_m2 DECIMAL(10, 2),
  area_covered_m2 DECIMAL(10, 2),
  
  -- Pricing
  price DECIMAL(15, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Availability
  is_available BOOLEAN DEFAULT TRUE,
  reserved_until TIMESTAMPTZ,
  
  -- CRM sync
  external_id TEXT,
  last_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(offer_id, unit_number)
);

CREATE INDEX idx_units_variant ON units(variant_id);
CREATE INDEX idx_units_offer ON units(offer_id);
CREATE INDEX idx_units_available ON units(is_available) WHERE is_available = TRUE;

-- ============================================
-- AD-OFFER MAPPING
-- ============================================
CREATE TABLE ad_offer_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  
  -- Platform
  platform ad_platform NOT NULL DEFAULT 'META',
  
  -- Ad identifiers
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  form_id TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  
  UNIQUE(tenant_id, platform, ad_id)
);

CREATE INDEX idx_ad_offer_map_tenant ON ad_offer_map(tenant_id);
CREATE INDEX idx_ad_offer_map_ad ON ad_offer_map(ad_id);
CREATE INDEX idx_ad_offer_map_offer ON ad_offer_map(offer_id);
CREATE INDEX idx_ad_offer_map_platform ON ad_offer_map(platform);

-- ============================================
-- PLATFORM COSTS (for ad spend tracking)
-- ============================================
CREATE TABLE platform_costs (
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
  leads_raw INTEGER DEFAULT 0,
  
  -- Period
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  
  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  platform_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, platform, ad_id, date_start, date_end)
);

CREATE INDEX idx_platform_costs_tenant ON platform_costs(tenant_id);
CREATE INDEX idx_platform_costs_offer ON platform_costs(offer_id);
CREATE INDEX idx_platform_costs_platform ON platform_costs(platform);
CREATE INDEX idx_platform_costs_date ON platform_costs(date_start, date_end);

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 003_core_tables
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 004_leads_tables
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================
-- Converzia: Leads & Conversations Tables
-- Migration: 004_leads_tables
-- ============================================

-- ============================================
-- LEADS (global, phone as primary identifier)
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Primary identifier (E.164 format)
  phone TEXT NOT NULL UNIQUE,
  phone_normalized TEXT NOT NULL, -- Without + prefix for search
  
  -- PII
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  
  -- Global opt-out
  opted_out BOOLEAN NOT NULL DEFAULT FALSE,
  opted_out_at TIMESTAMPTZ,
  opt_out_reason TEXT,
  
  -- Metadata
  country_code TEXT DEFAULT 'AR',
  language TEXT DEFAULT 'es',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_contact_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ
);

CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_phone_normalized ON leads(phone_normalized);
CREATE INDEX idx_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE INDEX idx_leads_opted_out ON leads(opted_out) WHERE opted_out = TRUE;

-- ============================================
-- LEAD SOURCES (Meta ads attribution)
-- ============================================
CREATE TABLE lead_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Meta Lead Ads data
  leadgen_id TEXT, -- Facebook lead ID
  ad_id TEXT,
  adset_id TEXT,
  campaign_id TEXT,
  form_id TEXT,
  
  -- Form data (as submitted)
  form_data JSONB DEFAULT '{}',
  
  -- UTM params
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  
  -- Platform
  platform TEXT DEFAULT 'META', -- META, GOOGLE, DIRECT, etc.
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_sources_lead ON lead_sources(lead_id);
CREATE INDEX idx_lead_sources_tenant ON lead_sources(tenant_id);
CREATE INDEX idx_lead_sources_leadgen ON lead_sources(leadgen_id) WHERE leadgen_id IS NOT NULL;
CREATE INDEX idx_lead_sources_ad ON lead_sources(ad_id) WHERE ad_id IS NOT NULL;

-- ============================================
-- LEAD-OFFERS (state machine per offer)
-- ============================================
CREATE TABLE lead_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id) ON DELETE SET NULL, -- NULL if unmapped
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_source_id UUID REFERENCES lead_sources(id),
  
  -- State machine
  status lead_offer_status NOT NULL DEFAULT 'TO_BE_CONTACTED',
  previous_status lead_offer_status,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Qualification fields
  qualification_fields JSONB DEFAULT '{}',
  -- Expected structure:
  -- {
  --   "name": "Juan Pérez",
  --   "budget": { "min": 50000, "max": 80000, "currency": "USD" },
  --   "zone": ["Palermo", "Belgrano"],
  --   "timing": "3-6 meses",
  --   "intent": "compra",
  --   "preferences": {
  --     "bedrooms": 2,
  --     "floor_preference": "high",
  --     "orientation": "front",
  --     "amenities": ["balcony", "garage"]
  --   }
  -- }
  
  -- Scoring
  score_total INTEGER,
  score_breakdown JSONB DEFAULT '{}',
  scored_at TIMESTAMPTZ,
  
  -- Billing
  billing_eligibility billing_eligibility DEFAULT 'PENDING',
  billing_notes TEXT,
  
  -- Recommended offer (might differ from original ad offer)
  recommended_offer_id UUID REFERENCES offers(id),
  alternative_offers JSONB DEFAULT '[]', -- Array of offer IDs
  
  -- Retry/reactivation tracking
  contact_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  reactivation_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  qualified_at TIMESTAMPTZ,
  
  UNIQUE(lead_id, offer_id, tenant_id)
);

CREATE INDEX idx_lead_offers_lead ON lead_offers(lead_id);
CREATE INDEX idx_lead_offers_offer ON lead_offers(offer_id);
CREATE INDEX idx_lead_offers_tenant ON lead_offers(tenant_id);
CREATE INDEX idx_lead_offers_status ON lead_offers(status);
CREATE INDEX idx_lead_offers_next_attempt ON lead_offers(next_attempt_at) 
  WHERE next_attempt_at IS NOT NULL AND status NOT IN ('STOPPED', 'DISQUALIFIED', 'SENT_TO_DEVELOPER');

-- ============================================
-- CONVERSATIONS (Chatwoot reference)
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Chatwoot IDs
  chatwoot_conversation_id TEXT NOT NULL,
  chatwoot_contact_id TEXT,
  chatwoot_inbox_id TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Summary (generated)
  summary TEXT,
  summary_generated_at TIMESTAMPTZ,
  
  -- Stats
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(chatwoot_conversation_id)
);

CREATE INDEX idx_conversations_lead ON conversations(lead_id);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_chatwoot ON conversations(chatwoot_conversation_id);

-- ============================================
-- MESSAGES (conversation history)
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  -- Chatwoot reference
  chatwoot_message_id TEXT,
  
  -- Content
  direction message_direction NOT NULL,
  sender message_sender NOT NULL,
  content TEXT NOT NULL,
  
  -- Media (if any)
  media_type TEXT,
  media_url TEXT,
  
  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  extracted_data JSONB DEFAULT '{}',
  
  -- Timestamps
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_lead ON messages(lead_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);
CREATE INDEX idx_messages_chatwoot ON messages(chatwoot_message_id) WHERE chatwoot_message_id IS NOT NULL;

-- ============================================
-- LEAD EVENTS (audit log)
-- ============================================
CREATE TABLE lead_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lead_offer_id UUID REFERENCES lead_offers(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  event_type lead_event_type NOT NULL,
  
  -- Event details
  details JSONB DEFAULT '{}',
  
  -- Actor
  actor_type TEXT, -- 'SYSTEM', 'BOT', 'OPERATOR', 'ADMIN'
  actor_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_events_lead ON lead_events(lead_id);
CREATE INDEX idx_lead_events_lead_offer ON lead_events(lead_offer_id);
CREATE INDEX idx_lead_events_tenant ON lead_events(tenant_id);
CREATE INDEX idx_lead_events_type ON lead_events(event_type);
CREATE INDEX idx_lead_events_created ON lead_events(created_at);

-- ============================================
-- DELIVERIES (Lead Ready packages)
-- ============================================
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_offer_id UUID NOT NULL REFERENCES lead_offers(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id),
  
  -- Status
  status delivery_status NOT NULL DEFAULT 'PENDING',
  
  -- Payload (Lead Ready package)
  payload JSONB NOT NULL DEFAULT '{}',
  -- Expected structure:
  -- {
  --   "lead": { "name", "phone", "email" },
  --   "qualification": { ... },
  --   "score": { "total", "breakdown" },
  --   "recommended_offer": { ... },
  --   "alternatives": [...],
  --   "conversation_summary": "...",
  --   "source": { "ad_id", "campaign_id", ... }
  -- }
  
  -- Delivery targets
  sheets_row_id TEXT,
  sheets_delivered_at TIMESTAMPTZ,
  crm_record_id TEXT,
  crm_delivered_at TIMESTAMPTZ,
  
  -- Errors
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Billing reference
  credit_ledger_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  
  UNIQUE(lead_offer_id)
);

CREATE INDEX idx_deliveries_lead_offer ON deliveries(lead_offer_id);
CREATE INDEX idx_deliveries_lead ON deliveries(lead_id);
CREATE INDEX idx_deliveries_tenant ON deliveries(tenant_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 004_leads_tables
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 005_billing_tables
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================
-- Converzia: Billing Tables
-- Migration: 005_billing_tables
-- ============================================

-- ============================================
-- TENANT PRICING (per-tenant config)
-- ============================================
CREATE TABLE tenant_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Charge model
  charge_model charge_model NOT NULL DEFAULT 'PER_LEAD',
  
  -- PER_LEAD pricing
  cost_per_lead DECIMAL(10, 2) DEFAULT 10.00,
  currency TEXT DEFAULT 'USD',
  
  -- PER_SALE pricing (future)
  success_fee_percentage DECIMAL(5, 2),
  success_fee_flat DECIMAL(10, 2),
  
  -- Package options
  packages JSONB DEFAULT '[]',
  -- Example:
  -- [
  --   { "credits": 50, "price": 400, "name": "Starter" },
  --   { "credits": 100, "price": 700, "name": "Growth", "discount_pct": 12.5 },
  --   { "credits": 250, "price": 1500, "name": "Scale", "discount_pct": 25 }
  -- ]
  
  -- Thresholds
  low_credit_threshold INTEGER DEFAULT 10,
  
  -- Trial credits
  default_trial_credits INTEGER DEFAULT 5,
  
  -- Auto-refund rules
  auto_refund_duplicates BOOLEAN DEFAULT TRUE,
  auto_refund_spam BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_pricing_tenant ON tenant_pricing(tenant_id);

-- ============================================
-- STRIPE CUSTOMERS
-- ============================================
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  
  stripe_customer_id TEXT NOT NULL UNIQUE,
  
  -- Billing info
  billing_email TEXT,
  billing_name TEXT,
  
  -- Default payment method
  default_payment_method_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_customers_tenant ON stripe_customers(tenant_id);
CREATE INDEX idx_stripe_customers_stripe ON stripe_customers(stripe_customer_id);

-- ============================================
-- BILLING ORDERS (package purchases)
-- ============================================
CREATE TABLE billing_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Order details
  order_number TEXT NOT NULL UNIQUE,
  
  -- Package info
  package_name TEXT,
  credits_purchased INTEGER NOT NULL,
  
  -- Pricing
  subtotal DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  stripe_checkout_session_id TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded
  paid_at TIMESTAMPTZ,
  
  -- Invoice
  invoice_url TEXT,
  receipt_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_orders_tenant ON billing_orders(tenant_id);
CREATE INDEX idx_billing_orders_status ON billing_orders(status);
CREATE INDEX idx_billing_orders_stripe_pi ON billing_orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX idx_billing_orders_stripe_session ON billing_orders(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

-- ============================================
-- CREDIT LEDGER (immutable audit trail)
-- ============================================
CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Transaction
  transaction_type credit_transaction_type NOT NULL,
  amount INTEGER NOT NULL, -- Positive for credit, negative for debit
  
  -- Running balance (denormalized for performance)
  balance_after INTEGER NOT NULL,
  
  -- References
  billing_order_id UUID REFERENCES billing_orders(id),
  delivery_id UUID REFERENCES deliveries(id),
  lead_offer_id UUID REFERENCES lead_offers(id),
  
  -- Details
  description TEXT,
  notes TEXT,
  
  -- Actor
  created_by UUID REFERENCES user_profiles(id),
  
  -- Immutable
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_tenant ON credit_ledger(tenant_id);
CREATE INDEX idx_credit_ledger_type ON credit_ledger(transaction_type);
CREATE INDEX idx_credit_ledger_created ON credit_ledger(created_at);
CREATE INDEX idx_credit_ledger_delivery ON credit_ledger(delivery_id) WHERE delivery_id IS NOT NULL;
CREATE INDEX idx_credit_ledger_order ON credit_ledger(billing_order_id) WHERE billing_order_id IS NOT NULL;

-- ============================================
-- VIEW: Tenant Credit Balance
-- ============================================
CREATE OR REPLACE VIEW tenant_credit_balance AS
SELECT 
  tenant_id,
  COALESCE(
    (SELECT balance_after 
     FROM credit_ledger 
     WHERE credit_ledger.tenant_id = t.id 
     ORDER BY created_at DESC 
     LIMIT 1
    ), 0
  ) AS current_balance,
  COALESCE(SUM(CASE WHEN transaction_type = 'CREDIT_PURCHASE' THEN amount ELSE 0 END), 0) AS total_purchased,
  COALESCE(SUM(CASE WHEN transaction_type = 'CREDIT_CONSUMPTION' THEN ABS(amount) ELSE 0 END), 0) AS total_consumed,
  COALESCE(SUM(CASE WHEN transaction_type = 'CREDIT_REFUND' THEN amount ELSE 0 END), 0) AS total_refunded
FROM tenants t
LEFT JOIN credit_ledger cl ON cl.tenant_id = t.id
GROUP BY t.id, tenant_id;

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 005_billing_tables
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 006_rag_tables
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================
-- Converzia: RAG Knowledge Tables
-- Migration: 006_rag_tables
-- ============================================

-- ============================================
-- RAG SOURCES (knowledge source definitions)
-- ============================================
CREATE TABLE rag_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE, -- NULL = tenant-general
  
  -- Source type
  source_type rag_source_type NOT NULL,
  
  -- Source details
  name TEXT NOT NULL,
  description TEXT,
  
  -- URL/Path
  source_url TEXT, -- For URL/WEBSITE types
  storage_path TEXT, -- For uploaded files (Supabase Storage)
  
  -- Website scraping config
  scrape_config JSONB DEFAULT '{}',
  -- Example:
  -- {
  --   "root_url": "https://example.com",
  --   "allowlist": ["/proyectos/*", "/amenities"],
  --   "blocklist": ["/admin/*"],
  --   "max_pages": 50,
  --   "follow_links": true
  -- }
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_processed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)
);

CREATE INDEX idx_rag_sources_tenant ON rag_sources(tenant_id);
CREATE INDEX idx_rag_sources_offer ON rag_sources(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX idx_rag_sources_type ON rag_sources(source_type);
CREATE INDEX idx_rag_sources_active ON rag_sources(is_active) WHERE is_active = TRUE;

-- ============================================
-- RAG DOCUMENTS (processed documents)
-- ============================================
CREATE TABLE rag_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES rag_sources(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
  
  -- Document info
  title TEXT,
  url TEXT, -- Original URL if applicable
  
  -- Content
  raw_content TEXT,
  cleaned_content TEXT,
  
  -- Versioning
  content_hash TEXT NOT NULL, -- SHA256 of content for dedup
  version INTEGER DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,
  
  -- Status
  status rag_document_status NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  
  -- Metadata
  doc_type TEXT, -- 'FAQ', 'BROCHURE', 'LANDING', 'LEGAL', etc.
  language TEXT DEFAULT 'es',
  page_count INTEGER,
  word_count INTEGER,
  
  -- Validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  
  -- Processing
  processed_at TIMESTAMPTZ,
  chunk_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rag_documents_source ON rag_documents(source_id);
CREATE INDEX idx_rag_documents_tenant ON rag_documents(tenant_id);
CREATE INDEX idx_rag_documents_offer ON rag_documents(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX idx_rag_documents_hash ON rag_documents(content_hash);
CREATE INDEX idx_rag_documents_current ON rag_documents(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_rag_documents_status ON rag_documents(status);

-- ============================================
-- RAG CHUNKS (embedded chunks with hybrid search)
-- ============================================
CREATE TABLE rag_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES rag_sources(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
  
  -- Content
  content TEXT NOT NULL,
  
  -- Vector embedding (1536 dimensions for OpenAI ada-002)
  embedding vector(1536),
  
  -- Full-text search
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED,
  
  -- Position
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  section TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  -- Example:
  -- {
  --   "doc_type": "FAQ",
  --   "heading": "¿Cuáles son las formas de pago?",
  --   "language": "es"
  -- }
  
  -- Token count
  token_count INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vector similarity search index (HNSW)
CREATE INDEX idx_rag_chunks_embedding ON rag_chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search index (GIN)
CREATE INDEX idx_rag_chunks_tsv ON rag_chunks USING gin(content_tsv);

-- Filtering indexes
CREATE INDEX idx_rag_chunks_document ON rag_chunks(document_id);
CREATE INDEX idx_rag_chunks_source ON rag_chunks(source_id);
CREATE INDEX idx_rag_chunks_tenant ON rag_chunks(tenant_id);
CREATE INDEX idx_rag_chunks_offer ON rag_chunks(offer_id) WHERE offer_id IS NOT NULL;
CREATE INDEX idx_rag_chunks_tenant_offer ON rag_chunks(tenant_id, offer_id);

-- ============================================
-- FUNCTION: Hybrid Search
-- ============================================
CREATE OR REPLACE FUNCTION search_rag_chunks(
  p_tenant_id UUID,
  p_offer_id UUID,
  p_query_embedding vector(1536),
  p_query_text TEXT,
  p_limit INTEGER DEFAULT 10,
  p_vector_weight FLOAT DEFAULT 0.7,
  p_text_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  vector_score FLOAT,
  text_score FLOAT,
  combined_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT 
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      1 - (c.embedding <=> p_query_embedding) AS v_score
    FROM rag_chunks c
    JOIN rag_documents d ON d.id = c.document_id
    WHERE c.tenant_id = p_tenant_id
      AND (p_offer_id IS NULL OR c.offer_id IS NULL OR c.offer_id = p_offer_id)
      AND d.is_current = TRUE
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_limit * 2
  ),
  text_results AS (
    SELECT 
      c.id,
      c.document_id,
      c.content,
      c.metadata,
      ts_rank_cd(c.content_tsv, plainto_tsquery('spanish', p_query_text)) AS t_score
    FROM rag_chunks c
    JOIN rag_documents d ON d.id = c.document_id
    WHERE c.tenant_id = p_tenant_id
      AND (p_offer_id IS NULL OR c.offer_id IS NULL OR c.offer_id = p_offer_id)
      AND d.is_current = TRUE
      AND c.content_tsv @@ plainto_tsquery('spanish', p_query_text)
    ORDER BY t_score DESC
    LIMIT p_limit * 2
  ),
  combined AS (
    SELECT 
      COALESCE(v.id, t.id) AS id,
      COALESCE(v.document_id, t.document_id) AS doc_id,
      COALESCE(v.content, t.content) AS cnt,
      COALESCE(v.metadata, t.metadata) AS meta,
      COALESCE(v.v_score, 0) AS vs,
      COALESCE(t.t_score, 0) AS ts
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id
  )
  SELECT 
    id AS chunk_id,
    doc_id AS document_id,
    cnt AS content,
    meta AS metadata,
    vs AS vector_score,
    ts AS text_score,
    (vs * p_vector_weight + ts * p_text_weight) AS combined_score
  FROM combined
  ORDER BY (vs * p_vector_weight + ts * p_text_weight) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Vector-only Search (simpler)
-- ============================================
CREATE OR REPLACE FUNCTION search_rag_chunks_vector(
  p_tenant_id UUID,
  p_offer_id UUID,
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS chunk_id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> p_query_embedding) AS similarity
  FROM rag_chunks c
  JOIN rag_documents d ON d.id = c.document_id
  WHERE c.tenant_id = p_tenant_id
    AND (p_offer_id IS NULL OR c.offer_id IS NULL OR c.offer_id = p_offer_id)
    AND d.is_current = TRUE
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 006_rag_tables
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 007_scoring_tables
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 007_scoring_tables
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 008_functions
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================
-- Converzia: Database Functions & Triggers
-- Migration: 008_functions
-- ============================================

-- ============================================
-- UTILITY: Update timestamp trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenant_members_updated_at BEFORE UPDATE ON tenant_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_offer_variants_updated_at BEFORE UPDATE ON offer_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_lead_offers_updated_at BEFORE UPDATE ON lead_offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenant_pricing_updated_at BEFORE UPDATE ON tenant_pricing FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_stripe_customers_updated_at BEFORE UPDATE ON stripe_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_billing_orders_updated_at BEFORE UPDATE ON billing_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rag_sources_updated_at BEFORE UPDATE ON rag_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rag_documents_updated_at BEFORE UPDATE ON rag_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_scoring_templates_updated_at BEFORE UPDATE ON scoring_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- USER PROFILE: Auto-create on auth.users insert
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- PHONE NORMALIZATION: Ensure E.164 format
-- ============================================
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT AS $$
DECLARE
  cleaned TEXT;
BEGIN
  -- Remove all non-digit characters except leading +
  cleaned := regexp_replace(phone, '[^0-9+]', '', 'g');
  
  -- Ensure + prefix
  IF NOT cleaned LIKE '+%' THEN
    -- Assume Argentina if no country code
    IF length(cleaned) = 10 THEN
      cleaned := '+54' || cleaned;
    ELSIF length(cleaned) = 11 AND cleaned LIKE '54%' THEN
      cleaned := '+' || cleaned;
    ELSIF length(cleaned) > 10 THEN
      cleaned := '+' || cleaned;
    END IF;
  END IF;
  
  RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- LEAD: Auto-normalize phone on insert/update
-- ============================================
CREATE OR REPLACE FUNCTION normalize_lead_phone()
RETURNS TRIGGER AS $$
BEGIN
  NEW.phone := normalize_phone(NEW.phone);
  NEW.phone_normalized := regexp_replace(NEW.phone, '^\+', '', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_normalize_phone
  BEFORE INSERT OR UPDATE OF phone ON leads
  FOR EACH ROW EXECUTE FUNCTION normalize_lead_phone();

-- ============================================
-- LEAD OFFER: Track status changes
-- ============================================
CREATE OR REPLACE FUNCTION track_lead_offer_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.previous_status := OLD.status;
    NEW.status_changed_at := NOW();
    
    -- Insert audit event
    INSERT INTO lead_events (
      lead_id,
      lead_offer_id,
      tenant_id,
      event_type,
      details,
      actor_type
    ) VALUES (
      NEW.lead_id,
      NEW.id,
      NEW.tenant_id,
      'STATUS_CHANGE',
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status
      ),
      'SYSTEM'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_offers_status_change
  BEFORE UPDATE OF status ON lead_offers
  FOR EACH ROW EXECUTE FUNCTION track_lead_offer_status_change();

-- ============================================
-- LEAD: Handle opt-out
-- ============================================
CREATE OR REPLACE FUNCTION handle_lead_opt_out()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.opted_out = TRUE AND OLD.opted_out = FALSE THEN
    NEW.opted_out_at := NOW();
    
    -- Update all active lead_offers to STOPPED
    UPDATE lead_offers
    SET status = 'STOPPED'
    WHERE lead_id = NEW.id
      AND status NOT IN ('STOPPED', 'SENT_TO_DEVELOPER', 'DISQUALIFIED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_opt_out
  BEFORE UPDATE OF opted_out ON leads
  FOR EACH ROW EXECUTE FUNCTION handle_lead_opt_out();

-- ============================================
-- CREDIT LEDGER: Calculate running balance
-- ============================================
CREATE OR REPLACE FUNCTION calculate_credit_balance()
RETURNS TRIGGER AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current balance for tenant
  SELECT COALESCE(balance_after, 0)
  INTO current_balance
  FROM credit_ledger
  WHERE tenant_id = NEW.tenant_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;
  
  -- Calculate new balance
  NEW.balance_after := current_balance + NEW.amount;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_ledger_balance
  BEFORE INSERT ON credit_ledger
  FOR EACH ROW EXECUTE FUNCTION calculate_credit_balance();

-- ============================================
-- FUNCTION: Get tenant credit balance
-- ============================================
CREATE OR REPLACE FUNCTION get_tenant_credits(p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
  balance INTEGER;
BEGIN
  SELECT COALESCE(balance_after, 0)
  INTO balance
  FROM credit_ledger
  WHERE tenant_id = p_tenant_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Consume credit (atomic)
-- ============================================
CREATE OR REPLACE FUNCTION consume_credit(
  p_tenant_id UUID,
  p_delivery_id UUID,
  p_lead_offer_id UUID,
  p_description TEXT DEFAULT 'Lead delivery'
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  message TEXT
) AS $$
DECLARE
  current_balance INTEGER;
  new_entry_id UUID;
BEGIN
  -- Lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text));
  
  -- Get current balance
  current_balance := get_tenant_credits(p_tenant_id);
  
  IF current_balance <= 0 THEN
    RETURN QUERY SELECT FALSE, current_balance, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;
  
  -- Insert consumption entry
  INSERT INTO credit_ledger (
    tenant_id,
    transaction_type,
    amount,
    delivery_id,
    lead_offer_id,
    description
  ) VALUES (
    p_tenant_id,
    'CREDIT_CONSUMPTION',
    -1,
    p_delivery_id,
    p_lead_offer_id,
    p_description
  )
  RETURNING id INTO new_entry_id;
  
  -- Return success with new balance
  RETURN QUERY 
  SELECT 
    TRUE, 
    get_tenant_credits(p_tenant_id),
    'Credit consumed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Add credits (from purchase)
-- ============================================
CREATE OR REPLACE FUNCTION add_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_billing_order_id UUID,
  p_description TEXT DEFAULT 'Credit purchase'
)
RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  INSERT INTO credit_ledger (
    tenant_id,
    transaction_type,
    amount,
    billing_order_id,
    description
  ) VALUES (
    p_tenant_id,
    'CREDIT_PURCHASE',
    p_amount,
    p_billing_order_id,
    p_description
  );
  
  RETURN get_tenant_credits(p_tenant_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Refund credit
-- ============================================
CREATE OR REPLACE FUNCTION refund_credit(
  p_tenant_id UUID,
  p_delivery_id UUID,
  p_lead_offer_id UUID,
  p_reason TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
BEGIN
  INSERT INTO credit_ledger (
    tenant_id,
    transaction_type,
    amount,
    delivery_id,
    lead_offer_id,
    description,
    notes,
    created_by
  ) VALUES (
    p_tenant_id,
    'CREDIT_REFUND',
    1,
    p_delivery_id,
    p_lead_offer_id,
    'Credit refund',
    p_reason,
    p_created_by
  );
  
  -- Update delivery status
  UPDATE deliveries
  SET status = 'REFUNDED', refunded_at = NOW()
  WHERE id = p_delivery_id;
  
  RETURN get_tenant_credits(p_tenant_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Check for duplicate lead
-- ============================================
CREATE OR REPLACE FUNCTION is_duplicate_lead(
  p_phone TEXT,
  p_tenant_id UUID,
  p_offer_id UUID,
  p_window_days INTEGER DEFAULT 90
)
RETURNS BOOLEAN AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO existing_count
  FROM lead_offers lo
  JOIN leads l ON l.id = lo.lead_id
  WHERE l.phone = normalize_phone(p_phone)
    AND lo.tenant_id = p_tenant_id
    AND (p_offer_id IS NULL OR lo.offer_id = p_offer_id)
    AND lo.created_at > NOW() - (p_window_days || ' days')::INTERVAL
    AND lo.status NOT IN ('DISQUALIFIED', 'STOPPED');
  
  RETURN existing_count > 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION: Generate order number
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  year_prefix TEXT;
  seq_num INTEGER;
BEGIN
  year_prefix := to_char(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(substring(order_number from 6) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM billing_orders
  WHERE order_number LIKE year_prefix || '-%';
  
  RETURN year_prefix || '-' || lpad(seq_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- BILLING ORDERS: Auto-generate order number
-- ============================================
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_billing_orders_number
  BEFORE INSERT ON billing_orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- ============================================
-- CONVERSATION: Update message count
-- ============================================
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    message_count = message_count + 1,
    last_message_at = NEW.sent_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_count
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_message_count();

-- ============================================
-- FUNCTION: Get user's accessible tenants
-- ============================================
CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT tenant_id
  FROM tenant_members
  WHERE user_id = p_user_id
    AND status = 'ACTIVE';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- FUNCTION: Check if user is Converzia admin
-- ============================================
CREATE OR REPLACE FUNCTION is_converzia_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = p_user_id AND is_converzia_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get user role in tenant
-- ============================================
CREATE OR REPLACE FUNCTION get_user_tenant_role(p_user_id UUID, p_tenant_id UUID)
RETURNS tenant_role AS $$
DECLARE
  user_role tenant_role;
BEGIN
  SELECT role INTO user_role
  FROM tenant_members
  WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
    AND status = 'ACTIVE';
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 008_functions
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 009_rls_policies
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 009_rls_policies
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 010_views
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================
-- Converzia: Views for Analytics & Reporting
-- Migration: 010_views
-- ============================================

-- ============================================
-- VIEW: Lead Pipeline Stats (for tenant dashboard)
-- Returns counts only, no PII
-- ============================================
CREATE OR REPLACE VIEW lead_pipeline_stats AS
SELECT 
  lo.tenant_id,
  lo.status,
  COUNT(*) AS count,
  DATE_TRUNC('day', lo.created_at) AS date
FROM lead_offers lo
GROUP BY lo.tenant_id, lo.status, DATE_TRUNC('day', lo.created_at);

-- ============================================
-- VIEW: Tenant Dashboard Metrics
-- ============================================
CREATE OR REPLACE VIEW tenant_dashboard_metrics AS
SELECT 
  t.id AS tenant_id,
  t.name AS tenant_name,
  
  -- Credits
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

-- ============================================
-- VIEW: Offer Performance
-- ============================================
CREATE OR REPLACE VIEW offer_performance AS
SELECT 
  o.id AS offer_id,
  o.tenant_id,
  o.name AS offer_name,
  o.status AS offer_status,
  
  -- Lead counts by status
  COUNT(lo.id) AS total_leads,
  COUNT(lo.id) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER') AS delivered_leads,
  COUNT(lo.id) FILTER (WHERE lo.status = 'DISQUALIFIED') AS disqualified_leads,
  COUNT(lo.id) FILTER (WHERE lo.status IN ('CONTACTED', 'ENGAGED', 'QUALIFYING', 'SCORED', 'LEAD_READY')) AS active_leads,
  
  -- Conversion rate
  CASE 
    WHEN COUNT(lo.id) > 0 
    THEN ROUND(100.0 * COUNT(lo.id) FILTER (WHERE lo.status = 'SENT_TO_DEVELOPER') / COUNT(lo.id), 2)
    ELSE 0 
  END AS conversion_rate,
  
  -- Average score
  AVG(lo.score_total) FILTER (WHERE lo.score_total IS NOT NULL) AS avg_score

FROM offers o
LEFT JOIN lead_offers lo ON lo.offer_id = o.id
GROUP BY o.id, o.tenant_id, o.name, o.status;

-- ============================================
-- VIEW: Unmapped Ads Queue (for Converzia Admin)
-- ============================================
CREATE OR REPLACE VIEW unmapped_ads_queue AS
SELECT DISTINCT ON (ls.ad_id, ls.tenant_id)
  ls.ad_id,
  ls.adset_id,
  ls.campaign_id,
  ls.tenant_id,
  t.name AS tenant_name,
  COUNT(*) OVER (PARTITION BY ls.ad_id, ls.tenant_id) AS lead_count,
  MIN(ls.created_at) OVER (PARTITION BY ls.ad_id, ls.tenant_id) AS first_seen_at,
  MAX(ls.created_at) OVER (PARTITION BY ls.ad_id, ls.tenant_id) AS last_seen_at
FROM lead_sources ls
JOIN tenants t ON t.id = ls.tenant_id
LEFT JOIN ad_offer_map aom ON aom.ad_id = ls.ad_id AND aom.tenant_id = ls.tenant_id
WHERE aom.id IS NULL
  AND ls.ad_id IS NOT NULL
ORDER BY ls.ad_id, ls.tenant_id, ls.created_at DESC;

-- ============================================
-- VIEW: Pending Approvals (for Converzia Admin)
-- ============================================
CREATE OR REPLACE VIEW pending_user_approvals AS
SELECT 
  tm.id AS membership_id,
  tm.tenant_id,
  t.name AS tenant_name,
  tm.user_id,
  up.email AS user_email,
  up.full_name AS user_name,
  tm.role AS requested_role,
  tm.created_at AS requested_at,
  inv.full_name AS invited_by_name,
  inv.email AS invited_by_email
FROM tenant_members tm
JOIN tenants t ON t.id = tm.tenant_id
JOIN user_profiles up ON up.id = tm.user_id
LEFT JOIN user_profiles inv ON inv.id = tm.invited_by
WHERE tm.status = 'PENDING_APPROVAL'
ORDER BY tm.created_at DESC;

-- ============================================
-- VIEW: Refund Queue (grey cases)
-- ============================================
CREATE OR REPLACE VIEW refund_queue AS
SELECT 
  d.id AS delivery_id,
  d.tenant_id,
  t.name AS tenant_name,
  d.lead_id,
  lo.id AS lead_offer_id,
  lo.billing_eligibility,
  lo.billing_notes,
  d.delivered_at,
  d.payload,
  lo.qualification_fields,
  lo.score_total
FROM deliveries d
JOIN tenants t ON t.id = d.tenant_id
JOIN lead_offers lo ON lo.id = d.lead_offer_id
WHERE d.status = 'DELIVERED'
  AND lo.billing_eligibility NOT IN ('CHARGEABLE', 'NOT_CHARGEABLE_DUPLICATE', 'NOT_CHARGEABLE_SPAM')
ORDER BY d.delivered_at DESC;

-- ============================================
-- VIEW: Conversation Health (for QA)
-- ============================================
CREATE OR REPLACE VIEW conversation_health AS
SELECT 
  c.tenant_id,
  t.name AS tenant_name,
  COUNT(DISTINCT c.id) AS total_conversations,
  
  -- Reply rate (conversations with at least one lead reply)
  ROUND(100.0 * COUNT(DISTINCT c.id) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM messages m 
      WHERE m.conversation_id = c.id AND m.direction = 'INBOUND'
    )
  ) / NULLIF(COUNT(DISTINCT c.id), 0), 2) AS reply_rate,
  
  -- Average messages per conversation
  ROUND(AVG(c.message_count), 2) AS avg_messages,
  
  -- Lead ready rate
  ROUND(100.0 * COUNT(DISTINCT lo.id) FILTER (
    WHERE lo.status = 'SENT_TO_DEVELOPER'
  ) / NULLIF(COUNT(DISTINCT lo.id), 0), 2) AS lead_ready_rate

FROM conversations c
JOIN tenants t ON t.id = c.tenant_id
LEFT JOIN lead_offers lo ON lo.lead_id = c.lead_id AND lo.tenant_id = c.tenant_id
WHERE c.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.tenant_id, t.name;

-- ============================================
-- VIEW: Credit Burn Rate
-- ============================================
CREATE OR REPLACE VIEW credit_burn_rate AS
SELECT 
  tenant_id,
  DATE_TRUNC('day', created_at) AS date,
  SUM(CASE WHEN transaction_type = 'CREDIT_CONSUMPTION' THEN ABS(amount) ELSE 0 END) AS consumed,
  SUM(CASE WHEN transaction_type = 'CREDIT_REFUND' THEN amount ELSE 0 END) AS refunded,
  SUM(CASE WHEN transaction_type = 'CREDIT_PURCHASE' THEN amount ELSE 0 END) AS purchased
FROM credit_ledger
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tenant_id, DATE_TRUNC('day', created_at)
ORDER BY tenant_id, date;

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 010_views
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 011_app_settings
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================
-- Converzia: App Settings & Tenant Integrations
-- Migration: 011_app_settings
-- ============================================

-- ============================================
-- APP SETTINGS (global configuration)
-- ============================================
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  is_secret BOOLEAN DEFAULT FALSE,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_settings_key ON app_settings(key);
CREATE INDEX idx_app_settings_category ON app_settings(category);

-- Insert default settings
INSERT INTO app_settings (key, value, description, is_secret, category) VALUES
  ('meta_app_id', '""', 'Meta/Facebook App ID', FALSE, 'meta'),
  ('meta_app_secret', '""', 'Meta/Facebook App Secret', TRUE, 'meta'),
  ('meta_page_access_token', '""', 'Meta Page Access Token for Lead Ads', TRUE, 'meta'),
  ('meta_webhook_verify_token', '""', 'Token to verify Meta webhook requests', TRUE, 'meta'),
  ('whatsapp_phone_number_id', '""', 'WhatsApp Business Phone Number ID', FALSE, 'whatsapp'),
  ('whatsapp_business_account_id', '""', 'WhatsApp Business Account ID', FALSE, 'whatsapp'),
  ('whatsapp_access_token', '""', 'WhatsApp Cloud API Access Token', TRUE, 'whatsapp'),
  ('chatwoot_base_url', '""', 'Chatwoot instance base URL', FALSE, 'chatwoot'),
  ('chatwoot_account_id', '""', 'Chatwoot Account ID', FALSE, 'chatwoot'),
  ('chatwoot_api_token', '""', 'Chatwoot API Access Token', TRUE, 'chatwoot'),
  ('chatwoot_inbox_id', '""', 'Chatwoot WhatsApp Inbox ID', FALSE, 'chatwoot'),
  ('openai_api_key', '""', 'OpenAI API Key', TRUE, 'ai'),
  ('openai_model_extraction', '"gpt-4o-mini"', 'Model for field extraction', FALSE, 'ai'),
  ('openai_model_response', '"gpt-4o"', 'Model for response generation', FALSE, 'ai'),
  ('openai_model_embedding', '"text-embedding-ada-002"', 'Model for embeddings', FALSE, 'ai');

-- ============================================
-- WHATSAPP MESSAGE TEMPLATES
-- ============================================
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_name TEXT NOT NULL UNIQUE,
  template_id TEXT, -- Meta template ID
  language TEXT NOT NULL DEFAULT 'es',
  category TEXT NOT NULL, -- MARKETING, UTILITY, AUTHENTICATION
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  
  -- Content
  header_type TEXT, -- TEXT, IMAGE, VIDEO, DOCUMENT
  header_content TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  buttons JSONB DEFAULT '[]',
  
  -- Variables
  variables JSONB DEFAULT '[]', -- [{position: 1, type: "text", example: "Juan"}]
  
  -- Usage
  use_for TEXT[], -- ['INITIAL_CONTACT', 'FOLLOW_UP', 'REACTIVATION']
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_templates_name ON whatsapp_templates(template_name);
CREATE INDEX idx_whatsapp_templates_use ON whatsapp_templates USING gin(use_for);

-- Insert default templates
INSERT INTO whatsapp_templates (template_name, language, category, status, body_text, use_for) VALUES
  ('converzia_initial_contact', 'es', 'MARKETING', 'PENDING', 
   'Hola {{1}}, soy el asistente de {{2}}. Vi que te interesó nuestro proyecto. ¿Te puedo ayudar con información?',
   ARRAY['INITIAL_CONTACT']),
  ('converzia_follow_up', 'es', 'UTILITY', 'PENDING',
   'Hola {{1}}, te escribo de {{2}}. ¿Pudiste ver la información que te envié? Estoy para ayudarte si tenés consultas.',
   ARRAY['FOLLOW_UP']),
  ('converzia_reactivation', 'es', 'MARKETING', 'PENDING',
   'Hola {{1}}, soy de {{2}}. Hace un tiempo consultaste por nuestros proyectos. ¿Seguís buscando? Tenemos novedades que pueden interesarte.',
   ARRAY['REACTIVATION']);

-- ============================================
-- ACTIVITY LOG (audit trail for admin actions)
-- ============================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Actor
  user_id UUID REFERENCES user_profiles(id),
  user_email TEXT,
  
  -- Target
  entity_type TEXT NOT NULL, -- 'tenant', 'offer', 'user', 'lead', etc.
  entity_id UUID,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- Action
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'approve', 'reject', etc.
  description TEXT NOT NULL,
  
  -- Changes
  changes JSONB DEFAULT '{}', -- {field: {old: x, new: y}}
  metadata JSONB DEFAULT '{}',
  
  -- Context
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_tenant ON activity_logs(tenant_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- ============================================
-- FUNCTION: Log Activity
-- ============================================
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_tenant_id UUID,
  p_action TEXT,
  p_description TEXT,
  p_changes JSONB DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM user_profiles WHERE id = p_user_id;
  
  INSERT INTO activity_logs (
    user_id, user_email, entity_type, entity_id, tenant_id,
    action, description, changes, metadata
  ) VALUES (
    p_user_id, v_user_email, p_entity_type, p_entity_id, p_tenant_id,
    p_action, p_description, p_changes, p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS POLICIES
-- ============================================

-- App Settings: Only Converzia admins can access
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Converzia admins can view all settings"
  ON app_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_converzia_admin = TRUE
    )
  );

CREATE POLICY "Converzia admins can modify settings"
  ON app_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_converzia_admin = TRUE
    )
  );

-- Activity Logs: Read-only for admins
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Converzia admins can view all logs"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_converzia_admin = TRUE
    )
  );

CREATE POLICY "Tenant admins can view their tenant logs"
  ON activity_logs FOR SELECT
  USING (
    tenant_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = activity_logs.tenant_id
      AND tenant_members.user_id = auth.uid()
      AND tenant_members.status = 'ACTIVE'
      AND tenant_members.role IN ('OWNER', 'ADMIN')
    )
  );

-- WhatsApp Templates: Only Converzia admins
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Converzia admins can manage templates"
  ON whatsapp_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_converzia_admin = TRUE
    )
  );

-- ============================================
-- TRIGGERS: updated_at maintenance
-- ============================================
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_whatsapp_templates_updated_at BEFORE UPDATE ON whatsapp_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 011_app_settings
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: 012_integrations_tables
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================
-- Converzia: Integrations Tables
-- Migration: 012_integrations_tables
-- ============================================

-- ============================================
-- TENANT INTEGRATIONS
-- ============================================
CREATE TABLE tenant_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- tenant_id can be NULL for global integrations (e.g., Admin-level Meta Ads)
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Integration type
  integration_type integration_type NOT NULL,
  name TEXT NOT NULL,
  
  -- Status
  status integration_status NOT NULL DEFAULT 'PENDING_SETUP',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE, -- Primary delivery target
  
  -- Configuration (encrypted sensitive fields should be handled app-side)
  config JSONB NOT NULL DEFAULT '{}',
  -- Example configs:
  -- GOOGLE_SHEETS: { "spreadsheet_id": "...", "sheet_name": "..." }
  -- TOKKO: { "api_key": "...", "api_url": "https://www.tokkobroker.com/api/v1" }
  -- WEBHOOK: { "url": "...", "method": "POST", "headers": {}, "auth_type": "bearer" }
  
  -- OAuth tokens for user-authenticated integrations (e.g., Google Sheets OAuth)
  oauth_tokens JSONB DEFAULT NULL,
  -- Example: { "access_token": "...", "refresh_token": "...", "expires_at": 1234567890, "email": "user@gmail.com" }
  
  -- Field mapping for delivery
  field_mapping JSONB NOT NULL DEFAULT '{}',
  -- Maps Converzia fields to integration fields
  -- { "lead.name": "nombre", "lead.phone": "telefono", ... }
  
  -- Sync status
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_error TEXT,
  sync_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id)

);

CREATE INDEX idx_tenant_integrations_tenant ON tenant_integrations(tenant_id);
CREATE INDEX idx_tenant_integrations_type ON tenant_integrations(integration_type);
CREATE INDEX idx_tenant_integrations_active ON tenant_integrations(is_active) WHERE is_active = TRUE;

-- Only one primary per tenant (partial unique index)
CREATE UNIQUE INDEX idx_tenant_integrations_one_primary_per_tenant
  ON tenant_integrations(tenant_id)
  WHERE is_primary = TRUE;

-- ============================================
-- INTEGRATION SYNC LOG (audit trail)
-- ============================================
CREATE TABLE integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES tenant_integrations(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  
  -- Sync details
  sync_type TEXT NOT NULL, -- 'LEAD_DELIVERY', 'TEST', 'MANUAL'
  status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'PARTIAL'
  
  -- Request/Response
  request_payload JSONB,
  response_payload JSONB,
  response_status_code INTEGER,
  
  -- Error details
  error_message TEXT,
  error_code TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_sync_logs_integration ON integration_sync_logs(integration_id);
CREATE INDEX idx_integration_sync_logs_delivery ON integration_sync_logs(delivery_id) WHERE delivery_id IS NOT NULL;
CREATE INDEX idx_integration_sync_logs_created ON integration_sync_logs(created_at);

-- ============================================
-- WEBHOOK SECRETS (for incoming webhooks)
-- ============================================
CREATE TABLE webhook_secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Service identification
  service TEXT NOT NULL UNIQUE, -- 'chatwoot', 'meta', 'stripe'
  
  -- Secret for HMAC verification
  secret_hash TEXT NOT NULL, -- Store hash, not plaintext
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_secrets_service ON webhook_secrets(service);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_secrets ENABLE ROW LEVEL SECURITY;

-- Tenant integrations: visible to tenant members
CREATE POLICY tenant_integrations_select ON tenant_integrations
  FOR SELECT USING (
    tenant_id IN (SELECT get_user_tenants(auth.uid()))
    OR is_converzia_admin(auth.uid())
  );

-- Only Converzia admins or tenant owners/admins can manage
CREATE POLICY tenant_integrations_insert ON tenant_integrations
  FOR INSERT WITH CHECK (
    is_converzia_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenants(auth.uid()))
      AND get_user_tenant_role(auth.uid(), tenant_id) IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY tenant_integrations_update ON tenant_integrations
  FOR UPDATE USING (
    is_converzia_admin(auth.uid())
    OR (
      tenant_id IN (SELECT get_user_tenants(auth.uid()))
      AND get_user_tenant_role(auth.uid(), tenant_id) IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY tenant_integrations_delete ON tenant_integrations
  FOR DELETE USING (is_converzia_admin(auth.uid()));

-- Sync logs: visible to tenant members (read only)
CREATE POLICY integration_sync_logs_select ON integration_sync_logs
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM tenant_integrations
      WHERE tenant_id IN (SELECT get_user_tenants(auth.uid()))
    )
    OR is_converzia_admin(auth.uid())
  );

CREATE POLICY integration_sync_logs_admin ON integration_sync_logs
  FOR ALL USING (is_converzia_admin(auth.uid()));

-- Webhook secrets: admin only
CREATE POLICY webhook_secrets_admin ON webhook_secrets
  FOR ALL USING (is_converzia_admin(auth.uid()));

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER trg_tenant_integrations_updated_at 
  BEFORE UPDATE ON tenant_integrations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_webhook_secrets_updated_at 
  BEFORE UPDATE ON webhook_secrets 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FUNCTION: Update integration sync status
-- ============================================
CREATE OR REPLACE FUNCTION update_integration_sync_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tenant_integrations
  SET 
    last_sync_at = NEW.completed_at,
    last_sync_status = NEW.status,
    last_error = CASE WHEN NEW.status = 'FAILED' THEN NEW.error_message ELSE NULL END,
    sync_count = sync_count + 1,
    error_count = CASE WHEN NEW.status = 'FAILED' THEN error_count + 1 ELSE error_count END,
    updated_at = NOW()
  WHERE id = NEW.integration_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_integration_sync_logs_update_status
  AFTER INSERT ON integration_sync_logs
  FOR EACH ROW 
  WHEN (NEW.completed_at IS NOT NULL)
  EXECUTE FUNCTION update_integration_sync_status();

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: 012_integrations_tables
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- BEGIN: seed_001_initial_seed
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- END: seed_001_initial_seed
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
