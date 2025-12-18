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
  
  -- Meta Ads identifiers
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
  
  UNIQUE(tenant_id, ad_id)
);

CREATE INDEX idx_ad_offer_map_tenant ON ad_offer_map(tenant_id);
CREATE INDEX idx_ad_offer_map_ad ON ad_offer_map(ad_id);
CREATE INDEX idx_ad_offer_map_offer ON ad_offer_map(offer_id);



