-- ============================================
-- Migration 032: Audit Logs Table
-- Creates audit logging infrastructure for tracking critical actions
-- ============================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- e.g., 'tenant_created', 'user_invited', 'credit_purchased', 'lead_deleted'
  entity_type TEXT NOT NULL, -- e.g., 'tenant', 'user', 'credit_ledger', 'lead'
  entity_id UUID, -- ID of the affected entity
  old_values JSONB, -- Previous state (for updates/deletes)
  new_values JSONB, -- New state (for creates/updates)
  metadata JSONB, -- Additional context
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite index for tenant + action queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action ON audit_logs(tenant_id, action, created_at DESC);

-- Composite index for user + tenant queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_tenant ON audit_logs(user_id, tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
-- Drop existing policies first to allow re-running migration
DROP POLICY IF EXISTS "admins_can_read_all_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "tenant_members_can_read_tenant_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "only_service_role_can_insert_audit_logs" ON audit_logs;

-- Only admins can read all audit logs
CREATE POLICY "admins_can_read_all_audit_logs"
  ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_converzia_admin = true
    )
  );

-- Tenant members can read their tenant's audit logs
CREATE POLICY "tenant_members_can_read_tenant_audit_logs"
  ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenant_members
      WHERE tenant_members.user_id = auth.uid()
      AND tenant_members.tenant_id = audit_logs.tenant_id
      AND tenant_members.status = 'ACTIVE'
    )
  );

-- Only system/service role can insert audit logs (via function)
-- Regular users cannot directly insert audit logs
CREATE POLICY "only_service_role_can_insert_audit_logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (false); -- Disable direct inserts, use function instead

-- ============================================
-- Function: log_audit_event
-- SECURITY DEFINER function to allow inserting audit logs
-- ============================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_tenant_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    tenant_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    metadata,
    ip_address,
    user_agent
  )
  VALUES (
    p_user_id,
    p_tenant_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values,
    p_metadata,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE audit_logs IS 'Audit trail for critical actions in the system';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (e.g., tenant_created, user_invited, credit_purchased)';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity affected (e.g., tenant, user, credit_ledger, lead)';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID of the affected entity';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous state (for updates/deletes), stored as JSONB';
COMMENT ON COLUMN audit_logs.new_values IS 'New state (for creates/updates), stored as JSONB';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context about the action';
COMMENT ON FUNCTION log_audit_event IS 'SECURITY DEFINER function to log audit events. Only callable by authenticated users.';
