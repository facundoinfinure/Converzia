-- ============================================
-- Converzia: Enable RLS on Public Tables
-- Migration: 024_enable_rls_public_tables
-- ============================================
-- 
-- This migration enables Row Level Security on tables that are
-- currently exposed without RLS protection.
-- 
-- CRITICAL: This fixes security vulnerabilities where tables
-- are accessible via PostgREST without proper access control.
--

-- ============================================
-- 1. system_metrics - Admin Only Access
-- ============================================

ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Only Converzia admins can access system metrics
CREATE POLICY "system_metrics_admin_all"
  ON system_metrics
  FOR ALL
  USING (is_converzia_admin(auth.uid()));

COMMENT ON POLICY "system_metrics_admin_all" ON system_metrics IS 
  'Only Converzia platform admins can view and modify system metrics';

-- ============================================
-- 2. platform_costs - Admin Only Access
-- ============================================

ALTER TABLE platform_costs ENABLE ROW LEVEL SECURITY;

-- Only Converzia admins can access platform costs
CREATE POLICY "platform_costs_admin_all"
  ON platform_costs
  FOR ALL
  USING (is_converzia_admin(auth.uid()));

COMMENT ON POLICY "platform_costs_admin_all" ON platform_costs IS 
  'Only Converzia platform admins can view and modify platform costs';

-- ============================================
-- 3. role_permissions - Read All, Modify Admin
-- ============================================

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can read role permissions (needed for permission checks)
CREATE POLICY "role_permissions_read_all"
  ON role_permissions
  FOR SELECT
  USING (true);

-- Only admins can insert/update/delete role permissions
CREATE POLICY "role_permissions_admin_modify"
  ON role_permissions
  FOR INSERT
  WITH CHECK (is_converzia_admin(auth.uid()));

CREATE POLICY "role_permissions_admin_update"
  ON role_permissions
  FOR UPDATE
  USING (is_converzia_admin(auth.uid()))
  WITH CHECK (is_converzia_admin(auth.uid()));

CREATE POLICY "role_permissions_admin_delete"
  ON role_permissions
  FOR DELETE
  USING (is_converzia_admin(auth.uid()));

COMMENT ON POLICY "role_permissions_read_all" ON role_permissions IS 
  'All authenticated users can read role permissions for authorization checks';

COMMENT ON POLICY "role_permissions_admin_modify" ON role_permissions IS 
  'Only Converzia platform admins can modify role permissions';

-- ============================================
-- Verification Queries
-- ============================================
-- 
-- Run these to verify RLS is enabled:
-- 
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename IN ('system_metrics', 'platform_costs', 'role_permissions');
-- 
-- Expected: rowsecurity = true for all three tables
--
-- List policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('system_metrics', 'platform_costs', 'role_permissions')
-- ORDER BY tablename, policyname;
