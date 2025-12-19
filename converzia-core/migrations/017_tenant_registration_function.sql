-- ============================================
-- Converzia: Tenant Registration Function
-- Migration: 017_tenant_registration_function
-- ============================================
-- 
-- This migration adds a function that allows authenticated users
-- to register a new tenant with PENDING status and create a
-- PENDING_APPROVAL membership for themselves.
-- ============================================

-- Function to register a new tenant
-- This bypasses RLS using SECURITY DEFINER to allow users to register
CREATE OR REPLACE FUNCTION register_tenant(
  p_name TEXT,
  p_slug TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_website TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_vertical offer_type DEFAULT 'PROPERTY'
)
RETURNS TABLE(
  tenant_id UUID,
  membership_id UUID
) AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_membership_id UUID;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to register a tenant';
  END IF;
  
  -- Check if user already has a tenant
  IF EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'User already has a tenant membership';
  END IF;
  
  -- Check if slug already exists
  IF EXISTS (
    SELECT 1 FROM tenants WHERE slug = p_slug
  ) THEN
    RAISE EXCEPTION 'A tenant with this slug already exists';
  END IF;
  
  -- Create tenant with PENDING status
  INSERT INTO tenants (
    name,
    slug,
    status,
    contact_email,
    contact_phone,
    website,
    description,
    vertical
  )
  VALUES (
    p_name,
    p_slug,
    'PENDING',
    p_contact_email,
    p_contact_phone,
    NULLIF(p_website, ''),
    NULLIF(p_description, ''),
    p_vertical
  )
  RETURNING id INTO v_tenant_id;
  
  -- Create membership with PENDING_APPROVAL status
  INSERT INTO tenant_members (
    tenant_id,
    user_id,
    role,
    status
  )
  VALUES (
    v_tenant_id,
    v_user_id,
    'OWNER',
    'PENDING_APPROVAL'
  )
  RETURNING id INTO v_membership_id;
  
  -- Return the created IDs
  RETURN QUERY SELECT v_tenant_id, v_membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION register_tenant TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION register_tenant IS 'Allows authenticated users to register a new tenant. Creates tenant with PENDING status and membership with PENDING_APPROVAL status.';


