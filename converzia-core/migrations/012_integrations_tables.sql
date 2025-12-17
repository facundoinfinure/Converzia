-- ============================================
-- Converzia: Integrations Tables
-- Migration: 012_integrations_tables
-- ============================================

-- ============================================
-- INTEGRATION TYPE ENUM
-- ============================================
DO $$ BEGIN
  CREATE TYPE integration_type AS ENUM (
    'GOOGLE_SHEETS',
    'TOKKO',
    'PROPERATI',
    'WEBHOOK',
    'ZAPIER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE integration_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'ERROR',
    'PENDING_SETUP'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- TENANT INTEGRATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
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
  -- GOOGLE_SHEETS: { "spreadsheet_id": "...", "sheet_name": "...", "service_account_email": "..." }
  -- TOKKO: { "api_key": "...", "api_url": "https://www.tokkobroker.com/api/v1" }
  -- WEBHOOK: { "url": "...", "method": "POST", "headers": {}, "auth_type": "bearer" }
  
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

-- If table existed from earlier migrations, ensure expected columns exist
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS status integration_status NOT NULL DEFAULT 'PENDING_SETUP';
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS field_mapping JSONB NOT NULL DEFAULT '{}';
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT;
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS sync_count INTEGER DEFAULT 0;
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id);

-- Normalize and convert integration_type column if it was created as TEXT previously
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenant_integrations'
      AND column_name = 'integration_type'
      AND udt_name = 'text'
  ) THEN
    UPDATE tenant_integrations
      SET integration_type = UPPER(integration_type::text)
      WHERE integration_type IS NOT NULL;

    ALTER TABLE tenant_integrations
      ALTER COLUMN integration_type TYPE integration_type
      USING integration_type::text::integration_type;
  END IF;
EXCEPTION
  WHEN others THEN
    -- If conversion fails due to unexpected values, keep original column type for now
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant ON tenant_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_type ON tenant_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_active ON tenant_integrations(is_active) WHERE is_active = TRUE;

-- Only one primary per tenant (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_integrations_one_primary_per_tenant
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

