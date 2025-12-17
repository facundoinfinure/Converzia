-- ============================================
-- Converzia: Test Users Seed
-- ============================================
-- 
-- IMPORTANTE: Este script asume que los usuarios ya existen en auth.users.
-- Los usuarios de Supabase Auth deben crearse primero via:
--   1. Dashboard de Supabase > Authentication > Users > Create user
--   2. O usando el CLI: supabase auth admin create-user
--
-- Después de crear los usuarios en auth, ejecutar este script
-- para crear los perfiles y memberships.
--
-- Contraseña sugerida para usuarios de prueba: Test123!
-- ============================================

-- ============================================
-- Step 1: Create Test Tenants
-- ============================================

-- Tenant 1: Demo Inmobiliaria
INSERT INTO tenants (
  id,
  name,
  slug,
  status,
  contact_email,
  contact_phone,
  website,
  description,
  vertical,
  activated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Demo Inmobiliaria',
  'demo-inmobiliaria',
  'ACTIVE',
  'owner1@test.com',
  '+54 11 1234-5678',
  'https://demo-inmobiliaria.com',
  'Inmobiliaria de demostración para testing',
  'PROPERTY',
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Tenant 2: Demo Automotriz
INSERT INTO tenants (
  id,
  name,
  slug,
  status,
  contact_email,
  contact_phone,
  website,
  description,
  vertical,
  activated_at
) VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'Demo Automotriz',
  'demo-automotriz',
  'ACTIVE',
  'owner2@test.com',
  '+54 11 8765-4321',
  'https://demo-automotriz.com',
  'Concesionaria de demostración para testing',
  'AUTO',
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Step 2: Create Pricing for Test Tenants
-- ============================================

INSERT INTO tenant_pricing (tenant_id, charge_model, cost_per_lead, packages)
SELECT 
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'PER_LEAD',
  10,
  '[
    {"id": "starter", "name": "Starter", "credits": 50, "price": 400},
    {"id": "growth", "name": "Growth", "credits": 100, "price": 700, "discount_pct": 12.5, "is_popular": true},
    {"id": "scale", "name": "Scale", "credits": 250, "price": 1500, "discount_pct": 25}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_pricing WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO tenant_pricing (tenant_id, charge_model, cost_per_lead, packages)
SELECT 
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'PER_LEAD',
  8,
  '[
    {"id": "starter", "name": "Starter", "credits": 50, "price": 350},
    {"id": "growth", "name": "Growth", "credits": 100, "price": 600, "discount_pct": 15, "is_popular": true},
    {"id": "scale", "name": "Scale", "credits": 250, "price": 1300, "discount_pct": 25}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_pricing WHERE tenant_id = 'b2c3d4e5-f6a7-8901-bcde-f23456789012'
);

-- ============================================
-- Step 3: Instructions for Creating Auth Users
-- ============================================
--
-- Run these commands in Supabase Dashboard > SQL Editor or via CLI:
--
-- For each user, create them in Supabase Auth first:
--
-- User 1: admin@converzia.io (Converzia Admin)
-- User 2: owner1@test.com (Demo Inmobiliaria - Owner)
-- User 3: admin1@test.com (Demo Inmobiliaria - Admin)
-- User 4: viewer1@test.com (Demo Inmobiliaria - Viewer)
-- User 5: owner2@test.com (Demo Automotriz - Owner)
-- User 6: admin2@test.com (Demo Automotriz - Admin)
-- User 7: viewer2@test.com (Demo Automotriz - Viewer)
--
-- After creating users in auth.users, get their UUIDs and update the script below.
-- ============================================

-- ============================================
-- Step 4: Create User Profiles
-- (Update UUIDs after creating users in auth.users)
-- ============================================

-- Note: Replace these placeholder UUIDs with actual UUIDs from auth.users
-- You can get them from Supabase Dashboard > Authentication > Users

-- Placeholder function to insert profiles
-- Uncomment and update UUIDs after creating auth users

/*
-- Converzia Admin
INSERT INTO user_profiles (id, email, full_name, is_converzia_admin)
VALUES (
  '00000000-0000-0000-0000-000000000001', -- Replace with actual UUID
  'admin@converzia.io',
  'Admin Converzia',
  TRUE
) ON CONFLICT (id) DO UPDATE SET is_converzia_admin = TRUE;

-- Demo Inmobiliaria Users
INSERT INTO user_profiles (id, email, full_name, is_converzia_admin)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'owner1@test.com', 'Owner Demo Inmobiliaria', FALSE),
  ('00000000-0000-0000-0000-000000000003', 'admin1@test.com', 'Admin Demo Inmobiliaria', FALSE),
  ('00000000-0000-0000-0000-000000000004', 'viewer1@test.com', 'Viewer Demo Inmobiliaria', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Demo Automotriz Users
INSERT INTO user_profiles (id, email, full_name, is_converzia_admin)
VALUES 
  ('00000000-0000-0000-0000-000000000005', 'owner2@test.com', 'Owner Demo Automotriz', FALSE),
  ('00000000-0000-0000-0000-000000000006', 'admin2@test.com', 'Admin Demo Automotriz', FALSE),
  ('00000000-0000-0000-0000-000000000007', 'viewer2@test.com', 'Viewer Demo Automotriz', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Demo Inmobiliaria Memberships
INSERT INTO tenant_members (tenant_id, user_id, role, status)
VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '00000000-0000-0000-0000-000000000002', 'OWNER', 'ACTIVE'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '00000000-0000-0000-0000-000000000003', 'ADMIN', 'ACTIVE'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '00000000-0000-0000-0000-000000000004', 'VIEWER', 'ACTIVE')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Demo Automotriz Memberships
INSERT INTO tenant_members (tenant_id, user_id, role, status)
VALUES 
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', '00000000-0000-0000-0000-000000000005', 'OWNER', 'ACTIVE'),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', '00000000-0000-0000-0000-000000000006', 'ADMIN', 'ACTIVE'),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', '00000000-0000-0000-0000-000000000007', 'VIEWER', 'ACTIVE')
ON CONFLICT (tenant_id, user_id) DO NOTHING;
*/

-- ============================================
-- Alternative: Create auth users programmatically
-- Run this in Supabase SQL Editor with service role
-- ============================================

-- This uses Supabase's admin functions to create users
-- Requires running in a context with service_role privileges

DO $$
DECLARE
  admin_user_id UUID;
  owner1_id UUID;
  admin1_id UUID;
  viewer1_id UUID;
  owner2_id UUID;
  admin2_id UUID;
  viewer2_id UUID;
BEGIN
  -- Check if we can create auth users (needs service role)
  -- This will fail gracefully if not running with proper permissions
  
  -- Create Converzia Admin
  BEGIN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@converzia.io',
      crypt('Test123!', gen_salt('bf')),
      NOW(),
      '{"full_name": "Admin Converzia"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    ) RETURNING id INTO admin_user_id;
    
    INSERT INTO user_profiles (id, email, full_name, is_converzia_admin)
    VALUES (admin_user_id, 'admin@converzia.io', 'Admin Converzia', TRUE);
    
    RAISE NOTICE 'Created admin user: %', admin_user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create admin user (may already exist or insufficient permissions): %', SQLERRM;
  END;
  
  -- Create Demo Inmobiliaria Users
  BEGIN
    -- Owner
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'owner1@test.com', crypt('Test123!', gen_salt('bf')), NOW(), '{"full_name": "Owner Demo Inmobiliaria"}'::jsonb, NOW(), NOW(), '', '', '', '')
    RETURNING id INTO owner1_id;
    
    INSERT INTO user_profiles (id, email, full_name, is_converzia_admin)
    VALUES (owner1_id, 'owner1@test.com', 'Owner Demo Inmobiliaria', FALSE);
    
    INSERT INTO tenant_members (tenant_id, user_id, role, status)
    VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', owner1_id, 'OWNER', 'ACTIVE');
    
    -- Admin
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'admin1@test.com', crypt('Test123!', gen_salt('bf')), NOW(), '{"full_name": "Admin Demo Inmobiliaria"}'::jsonb, NOW(), NOW(), '', '', '', '')
    RETURNING id INTO admin1_id;
    
    INSERT INTO user_profiles (id, email, full_name, is_converzia_admin)
    VALUES (admin1_id, 'admin1@test.com', 'Admin Demo Inmobiliaria', FALSE);
    
    INSERT INTO tenant_members (tenant_id, user_id, role, status)
    VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', admin1_id, 'ADMIN', 'ACTIVE');
    
    -- Viewer
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'viewer1@test.com', crypt('Test123!', gen_salt('bf')), NOW(), '{"full_name": "Viewer Demo Inmobiliaria"}'::jsonb, NOW(), NOW(), '', '', '', '')
    RETURNING id INTO viewer1_id;
    
    INSERT INTO user_profiles (id, email, full_name, is_converzia_admin)
    VALUES (viewer1_id, 'viewer1@test.com', 'Viewer Demo Inmobiliaria', FALSE);
    
    INSERT INTO tenant_members (tenant_id, user_id, role, status)
    VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', viewer1_id, 'VIEWER', 'ACTIVE');
    
    RAISE NOTICE 'Created Demo Inmobiliaria users: owner=%, admin=%, viewer=%', owner1_id, admin1_id, viewer1_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create Demo Inmobiliaria users: %', SQLERRM;
  END;
  
  -- Create Demo Automotriz Users
  BEGIN
    -- Owner
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'owner2@test.com', crypt('Test123!', gen_salt('bf')), NOW(), '{"full_name": "Owner Demo Automotriz"}'::jsonb, NOW(), NOW(), '', '', '', '')
    RETURNING id INTO owner2_id;
    
    INSERT INTO user_profiles (id, email, full_name, is_converzia_admin)
    VALUES (owner2_id, 'owner2@test.com', 'Owner Demo Automotriz', FALSE);
    
    INSERT INTO tenant_members (tenant_id, user_id, role, status)
    VALUES ('b2c3d4e5-f6a7-8901-bcde-f23456789012', owner2_id, 'OWNER', 'ACTIVE');
    
    -- Admin
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'admin2@test.com', crypt('Test123!', gen_salt('bf')), NOW(), '{"full_name": "Admin Demo Automotriz"}'::jsonb, NOW(), NOW(), '', '', '', '')
    RETURNING id INTO admin2_id;
    
    INSERT INTO user_profiles (id, email, full_name, is_converzia_admin)
    VALUES (admin2_id, 'admin2@test.com', 'Admin Demo Automotriz', FALSE);
    
    INSERT INTO tenant_members (tenant_id, user_id, role, status)
    VALUES ('b2c3d4e5-f6a7-8901-bcde-f23456789012', admin2_id, 'ADMIN', 'ACTIVE');
    
    -- Viewer
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'viewer2@test.com', crypt('Test123!', gen_salt('bf')), NOW(), '{"full_name": "Viewer Demo Automotriz"}'::jsonb, NOW(), NOW(), '', '', '', '')
    RETURNING id INTO viewer2_id;
    
    INSERT INTO user_profiles (id, email, full_name, is_converzia_admin)
    VALUES (viewer2_id, 'viewer2@test.com', 'Viewer Demo Automotriz', FALSE);
    
    INSERT INTO tenant_members (tenant_id, user_id, role, status)
    VALUES ('b2c3d4e5-f6a7-8901-bcde-f23456789012', viewer2_id, 'VIEWER', 'ACTIVE');
    
    RAISE NOTICE 'Created Demo Automotriz users: owner=%, admin=%, viewer=%', owner2_id, admin2_id, viewer2_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create Demo Automotriz users: %', SQLERRM;
  END;
  
END $$;

-- ============================================
-- Summary of Test Users
-- ============================================
-- 
-- | Email               | Password  | Role            | Tenant             |
-- |---------------------|-----------|-----------------|-------------------|
-- | admin@converzia.io  | Test123!  | Converzia Admin | (all access)      |
-- | owner1@test.com     | Test123!  | OWNER           | Demo Inmobiliaria |
-- | admin1@test.com     | Test123!  | ADMIN           | Demo Inmobiliaria |
-- | viewer1@test.com    | Test123!  | VIEWER          | Demo Inmobiliaria |
-- | owner2@test.com     | Test123!  | OWNER           | Demo Automotriz   |
-- | admin2@test.com     | Test123!  | ADMIN           | Demo Automotriz   |
-- | viewer2@test.com    | Test123!  | VIEWER          | Demo Automotriz   |
--
-- ============================================
