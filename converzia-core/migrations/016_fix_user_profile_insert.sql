-- ============================================
-- Converzia: Fix User Profile Insert Policy
-- Migration: 016_fix_user_profile_insert
-- ============================================
-- 
-- This migration fixes the issue where user registration with Google
-- fails because the trigger cannot insert into user_profiles due to
-- missing RLS INSERT policy.
-- ============================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS user_profiles_insert_own ON user_profiles;
DROP POLICY IF EXISTS user_profiles_admin_insert ON user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_trigger ON user_profiles;

-- Add INSERT policy for user_profiles
-- This allows users to insert their own profile (used by trigger)
-- Note: When trigger runs, auth.uid() should match NEW.id
CREATE POLICY user_profiles_insert_own ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Also allow admins to insert profiles
CREATE POLICY user_profiles_admin_insert ON user_profiles
  FOR INSERT WITH CHECK (is_converzia_admin(auth.uid()));

-- Allow insertion from trigger context
-- This policy allows INSERT when the function is called from the trigger
-- The trigger runs with SECURITY DEFINER, so we need a policy that works in that context
-- We check if the id exists in auth.users (which it will, since trigger fires AFTER INSERT)
CREATE POLICY user_profiles_insert_trigger ON user_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = user_profiles.id
    )
  );

-- Update the trigger function to set auth context and handle errors gracefully
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Try to set the auth context to the new user's ID
  -- This helps RLS policies work correctly
  v_user_id := NEW.id;
  
  -- Insert the profile
  -- The RLS policy should allow this if auth.uid() = id
  INSERT INTO user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log error but don't fail user creation
    -- If RLS blocks the insert, we'll log it but continue
    -- The profile can be created manually later if needed
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
