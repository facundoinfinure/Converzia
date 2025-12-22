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









