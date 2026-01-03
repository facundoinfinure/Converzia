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
-- TENANT INTEGRATIONS (per-tenant delivery config)
-- ============================================
CREATE TABLE tenant_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  is_primary BOOLEAN DEFAULT FALSE,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  
  UNIQUE(tenant_id, integration_type, name)
);

COMMENT ON TABLE tenant_integrations IS 'Per-tenant integration configurations for delivery targets';
COMMENT ON COLUMN tenant_integrations.integration_type IS 'GOOGLE_SHEETS, TOKKO, PROPERATI, WEBHOOK, etc.';
COMMENT ON COLUMN tenant_integrations.config IS 'Integration-specific configuration (credentials, mappings, etc.)';
COMMENT ON COLUMN tenant_integrations.is_primary IS 'If true, this is the primary delivery target for this type';

CREATE INDEX idx_tenant_integrations_tenant ON tenant_integrations(tenant_id);
CREATE INDEX idx_tenant_integrations_type ON tenant_integrations(integration_type);
CREATE INDEX idx_tenant_integrations_active ON tenant_integrations(is_active) WHERE is_active = TRUE;

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

-- Tenant Integrations: Converzia admins and tenant owners/admins
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Converzia admins can view all integrations"
  ON tenant_integrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_converzia_admin = TRUE
    )
  );

CREATE POLICY "Tenant admins can view their integrations"
  ON tenant_integrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.tenant_id = tenant_integrations.tenant_id
      AND tenant_members.user_id = auth.uid()
      AND tenant_members.status = 'ACTIVE'
      AND tenant_members.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Converzia admins can modify all integrations"
  ON tenant_integrations FOR ALL
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














